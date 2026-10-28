import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const fail=code=>Object.assign(new Error(code),{code});
export function retryDelay(response,data,now=Date.now()) {
  const h=response.headers.get('retry-after');
  const seconds=h && /^\d+(\.\d+)?$/.test(h) ? Number(h) : h ? Math.max(0,(Date.parse(h)-now)/1000) : NaN;
  const body=typeof data?.retry_after==='number' || typeof data?.retry_after==='string' ? Number(data.retry_after) : NaN;
  const valid=[seconds,body].filter(n=>Number.isFinite(n)&&n>=0);
  return valid.length ? Math.max(1,...valid) : 60;
}
export function safePolicy(value) { return ['oauth','integracao','integration'].includes(value?.toLowerCase()) ? value.toLowerCase() : value ? 'unknown' : null; }

// O mesmo registro e locks coordenam API manual e todos os workers do Sales.
// Outros programas no IP precisam aderir ao gate ou usar janela exclusiva.
export class HubsoftGate {
  constructor(pool,env,{sleep=delay,now=Date.now}={}) {
    this.pool=pool; this.env=env; this.sleep=sleep; this.now=now; this.jobId=null;
    const rate=Number(env.HUBSOFT_REQUESTS_PER_SECOND??1);
    if(![1,2].includes(rate)) throw fail('HUBSOFT_RITMO_INVALIDO');
    this.interval=1000/rate;
  }
  scope() { return createHash('sha256').update([this.env.HUBSOFT_API_URL,this.env.HUBSOFT_CLIENT_ID,this.env.HUBSOFT_USERNAME].join('|')).digest('hex'); }
  key() { return createHash('sha256').update(this.env.HUBSOFT_CLIENT_SECRET??'').digest(); }
  encrypt(value) {
    const iv=randomBytes(12), c=createCipheriv('aes-256-gcm',this.key(),iv);
    return this.seal(c,iv,value);
  }
  seal(c,iv,value) { const bytes=Buffer.concat([c.update(value,'utf8'),c.final()]); return Buffer.concat([iv,c.getAuthTag(),bytes]).toString('base64'); }
  decrypt(value) { const bytes=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',this.key(),bytes.subarray(0,12)); d.setAuthTag(bytes.subarray(12,28)); return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8'); }
  async locked(key,work) {
    const db=await this.pool.connect(); let locked=false;
    try {
      locked=(await db.query('SELECT pg_try_advisory_lock($1) AS locked',[key])).rows[0].locked;
      if(!locked) throw fail('HUBSOFT_FILA_OCUPADA');
      return await work(db);
    } finally { try {if(locked) await db.query('SELECT pg_advisory_unlock($1)',[key]);} finally {db.release();} }
  }
  async token(work) {
    return this.locked(73190604,async db=>{
      const state=(await db.query('SELECT token_cipher,token_expires_at,token_scope FROM hubsoft_gate WHERE id=1')).rows[0];
      if(!state) throw fail('HUBSOFT_MIGRACAO_NECESSARIA');
      if(state.token_cipher && state.token_scope===this.scope() && new Date(state.token_expires_at).getTime()>this.now()) {
        try { return {access_token:this.decrypt(state.token_cipher),expires_in:(new Date(state.token_expires_at).getTime()-this.now())/1000}; } catch { /* chave rotacionada: renovar uma vez */ }
      }
      const token=await work();
      if(typeof token.access_token!=='string'||!Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=0) throw fail('HUBSOFT_TOKEN_INVALIDO');
      await db.query('UPDATE hubsoft_gate SET token_cipher=$1,token_expires_at=$2,token_scope=$3 WHERE id=1',[this.encrypt(token.access_token),new Date(this.now()+Number(token.expires_in)*1000),this.scope()]);
      return token;
    });
  }
  async invalidateToken() { await this.pool.query('UPDATE hubsoft_gate SET token_cipher=NULL,token_expires_at=NULL WHERE id=1'); }
  async perform(meta,send) {
    return this.locked(73190603,async db=>{
      const state=(await db.query('SELECT * FROM hubsoft_gate WHERE id=1')).rows[0];
      if(!state) throw fail('HUBSOFT_MIGRACAO_NECESSARIA');
      const cooldown=new Date(state.cooldown_until).getTime();
      if(cooldown>this.now()) throw Object.assign(fail('HUBSOFT_LIMITE_AGUARDE'),{retryAt:cooldown});
      const next=Math.max(new Date(state.next_at).getTime(),meta.method==='POST'?new Date(state.oauth_next_at).getTime():0);
      await this.sleep(Math.max(0,next-this.now()));
      if(this.jobId) {
        const budget=(await db.query(`SELECT (manifest->>'maxCalls')::int AS maximum,
          (SELECT count(*) FROM hubsoft_call_metrics WHERE job_id=$1) AS used FROM history_jobs WHERE id=$1`,[this.jobId])).rows[0];
        if(!budget || Number(budget.used)>=budget.maximum) throw fail('ORCAMENTO_ATINGIDO');
      }
      const started=this.now();
      // Reservar antes do envio também impede rajada após falha/reinício.
      await db.query("UPDATE hubsoft_gate SET next_at=$1,oauth_next_at=CASE WHEN $2 THEN $3 ELSE oauth_next_at END WHERE id=1",[new Date(started+this.interval),meta.method==='POST',new Date(started+2100)]);
      let status=null,policy=null,retry=null;
      try {
        const result=await send(); status=result.status; policy=safePolicy(result.policy);
        if(status===429) {
          retry=result.retrySeconds;
          await db.query('UPDATE hubsoft_gate SET cooldown_until=$1 WHERE id=1',[new Date(this.now()+retry*1000)]);
          throw Object.assign(fail('HUBSOFT_LIMITE_AGUARDE'),{retryAt:this.now()+retry*1000});
        }
        if(result.error) throw result.error;
        return result.data;
      } finally {
        await db.query('INSERT INTO hubsoft_call_metrics(job_id,method,path,status,latency_ms,policy,retry_after_seconds) VALUES($1,$2,$3,$4,$5,$6,$7)',[this.jobId,meta.method,meta.path,status,Math.max(0,this.now()-started),policy,retry]);
      }
    });
  }
}
