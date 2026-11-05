import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Os cortes mensais seguem o fuso usado pelo contêiner de produção.
process.env.TZ='America/Sao_Paulo';
process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/test';
const {validateInstallationContextScope,planInstallationContext,captureInstallationContext,applyInstallationContext}=await import('../installationContext.mjs');
const {upsertRows,rebuild}=await import('../records.mjs');
const {HubsoftClient}=await import('../hubsoft.mjs');
const {HubsoftGate}=await import('../hubsoftGate.mjs');
const jobId='65a3be4d-9fe8-4ded-82c9-7497260b90bf';
const scope={version:1,jobId,month:'2026-10',openingMonth:'2026-09',targets:[1,2,3].map(i=>({
  orderId:String(200+i),orderNumber:String(500+i),attendanceId:String(100+i),protocol:`20260930000${i}`,
}))};
const env={HUBSOFT_HISTORY_ENABLED:'true',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_REQUESTS_PER_SECOND:'1',
  HUBSOFT_API_URL:'https://hubsoft.example.invalid',HUBSOFT_CLIENT_ID:'fake-client',HUBSOFT_CLIENT_SECRET:'fake-secret',HUBSOFT_USERNAME:'fake-user',HUBSOFT_PASSWORD:'fake-password'};
const detail=i=>({id_atendimento:String(100+i),protocolo:`20260930000${i}`,cliente:{codigo_cliente:String(20+i),nome_razaosocial:'Cliente de teste',cpf_cnpj:'NAO_GUARDAR'},
  descricao_abertura:'Instalação 600 Mega Combo Plus',data_cadastro:'30/09/2026',usuario_abertura:{name:'Beatriz',email:'NAO_GUARDAR'},
  tipo_atendimento:'INSTALAÇÃO',status:'Resolvido',password:'NAO_GUARDAR'});

async function fixture() {
  const pg=new PGlite();
  for(const name of ['001_initial.sql','002_history.sql']) await pg.exec(await readFile(new URL(`../../database/migrations/${name}`,import.meta.url),'utf8'));
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:true}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await query(`INSERT INTO history_jobs(id,phase,manifest,state,approved,month_index)
    VALUES($1,'october',$2::jsonb,'complete',true,1)`,[jobId,JSON.stringify({cutoff:'2026-10-31',osDateField:'data_termino_executado',maxCalls:5000})]);
  await query("INSERT INTO history_months(job_id,month,state,reconciliation) VALUES($1,'2026-10','published',$2::jsonb)",[jobId,JSON.stringify({reviewer:'Operador de teste',attendance:1,serviceOrders:3})]);
  await upsertRows(db,'attendance',[{...detail(9),cliente:undefined,codigo_cliente:'29',nome_razaosocial:'Cliente de teste',usuario_abertura:'Beatriz',
    tipo_atendimento:'RENOVAÇÃO DE CONTRATO',data_cadastro:'01/10/2026'}],'hubsoft');
  for(let i=1;i<=3;i++) {
    const order={id_ordem_servico:String(200+i),numero_ordem_servico:String(500+i),id_atendimento:String(100+i),
      codigo_cliente:String(20+i),nome_razaosocial:'Cliente de teste',tipo_ordem_servico:'INSTALAÇÃO',status:'Finalizado',
      data_inicio_programado:'01/10/2026 08:00:00',data_inicio_executado:'01/10/2026 08:00:00',data_termino_executado:'01/10/2026 09:00:00',data_referencia_bi:'data_termino_executado'};
    await upsertRows(db,'serviceOrders',[order],'hubsoft');
    await query("INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,'2026-10','serviceOrders',$2,$3::jsonb,'direct')",[jobId,String(200+i),JSON.stringify(order)]);
  }
  await rebuild(db);
  const count=async(table,where='')=>(await query(`SELECT count(*)::int AS n FROM ${table} ${where}`)).rows[0].n;
  return {pg,db,query,count};
}

test('contexto exige escopo pontual do mês e recusa duplicidades ou mais de três consultas',()=>{
  assert.equal(validateInstallationContextScope(scope),scope);
  for(const invalid of [
    {...scope,month:'2026-09'}, {...scope,openingMonth:'2026-08'}, {...scope,jobId:'11111111-1111-4111-8111-111111111111'},
    {...scope,targets:[]}, {...scope,targets:[...scope.targets,scope.targets[0]]},
    {...scope,targets:[scope.targets[0],scope.targets[0]]},
  ]) assert.throws(()=>validateInstallationContextScope(invalid),/ESCOPO_CONTEXTO_INVALIDO|CONTEXTO_IDENTIDADE_DUPLICADA/);
});

test('captura três detalhes com gate compartilhado, token reutilizado e checkpoints; aplicação preserva outubro',async()=>{
  const {pg,db,query,count}=await fixture();
  try {
    const calls=[],startReconciliation=(await query('SELECT reconciliation FROM history_months')).rows[0].reconciliation;
    let now=Date.now();
    const gate=new HubsoftGate(db,env,{now:()=>now,sleep:async ms=>{now+=ms;}});
    const client=new HubsoftClient(env,async(url,options)=>{
      const parsed=new URL(url);calls.push({method:options.method,at:now,path:parsed.pathname});
      if(options.method==='POST') return new Response(JSON.stringify({access_token:'fake-token',expires_in:3600}));
      assert.equal(parsed.searchParams.get('limit'),'1');
      const i=scope.targets.findIndex(target=>target.protocol===parsed.searchParams.get('termo_busca'))+1;
      assert.ok(i>0);return new Response(JSON.stringify({status:'suscess',atendimentos:[detail(i)]}));
    },undefined,gate);
    const plan=await planInstallationContext(db,scope);
    assert.equal(plan.maximumDetailQueries,3);assert.equal(calls.length,0);
    const capture=await captureInstallationContext(db,client,scope,env);
    assert.equal(capture.ready,true);assert.equal(capture.published,false);assert.equal(capture.detailQueries,3);
    assert.equal(calls.filter(call=>call.method==='POST').length,1);
    const gets=calls.filter(call=>call.method==='GET');assert.equal(gets.length,3);
    assert.ok(gets[1].at-gets[0].at>=1000);assert.ok(gets[2].at-gets[1].at>=1000);
    assert.equal(await count('hubsoft_call_metrics'),4);assert.equal(gate.jobId,jobId);
    assert.equal(await count('source_records'),4,'captura não publica atendimentos');
    assert.equal(await count('commercial_records',"WHERE kind='sales'"),0);
    assert.equal(JSON.stringify((await query("SELECT value FROM application_settings WHERE key LIKE 'hubsoft_installation_context:%'")).rows).includes('NAO_GUARDAR'),false);
    const resumed=await captureInstallationContext(db,client,scope,env);
    assert.equal(resumed.reused,3);assert.equal(resumed.detailQueries,0);assert.equal(calls.length,4);
    await assert.rejects(applyInstallationContext(db,scope,{}),/CARGA_HISTORICA_DESATIVADA/);
    const result=await applyInstallationContext(db,scope,env);
    assert.equal(result.contexts,3);assert.equal(await count('commercial_records',"WHERE kind='sales'"),3);
    assert.equal(await count('commercial_records',"WHERE kind='attendance'"),1);
    assert.equal(await count('commercial_records',"WHERE kind='renewals'"),1);
    assert.equal(await count('commercial_records',"WHERE event_date < '2026-10-01 00:00:00-03'::timestamptz"),0,'não apresenta setembro como mês parcial');
    assert.equal(await count('source_records'),7);assert.equal(await count('history_records'),3);
    assert.deepEqual((await query('SELECT reconciliation FROM history_months')).rows[0].reconciliation,startReconciliation);
    const context=(await query("SELECT payload FROM source_records WHERE id='hubsoft:101' AND kind='attendance'")).rows[0].payload;
    assert.equal(context.publication_scope,'installation_context');assert.equal(context.data_cadastro,'30/09/2026');
    assert.equal(context.installation_context_order_ids,'201');
    await applyInstallationContext(db,scope,env);
    assert.equal(await count('source_records'),7);assert.equal(await count('commercial_records',"WHERE kind='sales'"),3);assert.equal(calls.length,4);
    await upsertRows(db,'attendance',[{...context,publication_scope:'manual_staging',descricao_abertura:'Mudança manual'}],'hubsoft');
    assert.equal((await query("SELECT payload FROM source_records WHERE id='hubsoft:101' AND kind='attendance'")).rows[0].payload.descricao_abertura,context.descricao_abertura);
    const {publication_scope,installation_context_order_ids,context_job_id,context_observed_at,...published}=context;
    void publication_scope;void installation_context_order_ids;void context_job_id;void context_observed_at;
    await upsertRows(db,'attendance',[{...published,descricao_abertura:'Publicação integral posterior'}],'hubsoft');
    await applyInstallationContext(db,scope,env);
    const current=(await query("SELECT payload FROM source_records WHERE id='hubsoft:101' AND kind='attendance'")).rows[0].payload;
    assert.equal(current.publication_scope,undefined);assert.equal(current.descricao_abertura,'Publicação integral posterior');
  } finally {await pg.close();}
});

test('identidade, cliente, abertura, qualidade e OS devem coincidir antes de salvar contexto',async()=>{
  const {pg,db,query,count}=await fixture();
  try {
    const single={...scope,targets:[scope.targets[0]]};let requests=0;
    const fake={gate:{interval:1000},attendanceDetail:async()=>{requests++;return detail(1);}};
    await assert.rejects(captureInstallationContext(db,fake,single,{}),/CARGA_HISTORICA_DESATIVADA/);
    await assert.rejects(captureInstallationContext(db,{...fake,gate:{interval:500}},single,env),/CONTEXTO_EXIGE_GATE_1_REQ_S/);
    assert.equal(requests,0);
    for(const changes of [
      {id_atendimento:'999'}, {protocolo:'999'}, {codigo_cliente:'999'},
      {data_cadastro:'01/10/2026'}, {data_cadastro:'30/09/2025'},
      {tipo_atendimento:'SUPORTE'}, {usuario_abertura:null}, {descricao_abertura:''},
      {deleted_at:'2026-11-01'}, {classification_status:'incomplete'},
    ]) {
      const client={gate:{interval:1000},attendanceDetail:async()=>({...detail(1),...changes})};
      await assert.rejects(captureInstallationContext(db,client,single,env));
      assert.equal(await count('application_settings',"WHERE key LIKE 'hubsoft_installation_context:%'"),0);
    }
    await query("UPDATE history_jobs SET approved=false WHERE id=$1",[jobId]);
    await assert.rejects(planInstallationContext(db,single),/OUTUBRO_PUBLICADO_OBRIGATORIO/);
    await query("UPDATE history_jobs SET approved=true WHERE id=$1",[jobId]);
    await query("UPDATE source_records SET payload=payload||'{\"data_inicio_executado\":\"01/10/2026 10:00:00\"}'::jsonb WHERE kind='serviceOrders' AND id='hubsoft:201'");
    await assert.rejects(captureInstallationContext(db,fake,single,env),/CONTEXTO_EXECUCAO_INVALIDA/);
    assert.equal(await count('source_records'),4);
  } finally {await pg.close();}
});

test('retomada reaproveita os detalhes validados e aplicação incompleta faz rollback integral',async()=>{
  const {pg,db,query,count}=await fixture();
  try {
    const calls=[];let failed=false;
    const client={gate:{interval:1000},attendanceDetail:async protocol=>{
      calls.push(protocol);const i=scope.targets.findIndex(target=>target.protocol===protocol)+1;
      if(i===2&&!failed) {failed=true;throw Object.assign(new Error('HUBSOFT_LIMITE_AGUARDE'),{code:'HUBSOFT_LIMITE_AGUARDE'});}
      return detail(i);
    }};
    await assert.rejects(captureInstallationContext(db,client,scope,env),/HUBSOFT_LIMITE_AGUARDE/);
    assert.equal(await count('application_settings',"WHERE key LIKE 'hubsoft_installation_context:%'"),1);
    await assert.rejects(applyInstallationContext(db,scope,env),/CONTEXTO_CACHE_DIVERGENTE/);
    assert.equal(await count('source_records'),4);assert.equal(await count('commercial_records',"WHERE kind='sales'"),0);
    const resumed=await captureInstallationContext(db,client,scope,env);
    assert.equal(resumed.reused,1);assert.equal(calls.filter(protocol=>protocol===scope.targets[0].protocol).length,1);
    const before=(await query("SELECT payload FROM source_records WHERE id='hubsoft:202' AND kind='serviceOrders'")).rows[0].payload;
    await query("UPDATE source_records SET payload=payload||'{\"codigo_cliente\":\"999\"}'::jsonb WHERE kind='serviceOrders' AND id='hubsoft:202'");
    await assert.rejects(applyInstallationContext(db,scope,env),/CONTEXTO_CACHE_DIVERGENTE/);
    assert.equal(await count('source_records'),4,'primeiro contexto também é revertido');
    await query("UPDATE source_records SET payload=$1::jsonb WHERE id='hubsoft:202' AND kind='serviceOrders'",[JSON.stringify(before)]);
    await applyInstallationContext(db,scope,env);
    assert.equal(await count('commercial_records',"WHERE kind='sales'"),3);
  } finally {await pg.close();}
});

async function legacyOrders(query) {
  const raw=[];
  for(let i=1;i<=3;i++) {
    const {rows}=await query("SELECT payload FROM source_records WHERE kind='serviceOrders' AND id=$1",[`hubsoft:${200+i}`]);
    const {codigo_cliente,numero_ordem_servico,...order}=rows[0].payload;
    raw.push({...order,numero:numero_ordem_servico,cliente:`(${codigo_cliente}) Cliente de teste`,atendimento:{id_atendimento:order.id_atendimento,protocolo:scope.targets[i-1].protocol}});
    await query("UPDATE source_records SET payload=payload-'codigo_cliente' WHERE kind='serviceOrders' AND id=$1",[`hubsoft:${200+i}`]);
  }
  await query(`INSERT INTO history_pages(job_id,day,stream,page,records,complete,processed)
    VALUES($1,'2026-10-01','serviceOrderCompletions',0,$2::jsonb,true,true)`,[jobId,JSON.stringify(raw)]);
  return raw;
}

test('código ausente é recuperado do snapshot da mesma OS e só publicado após validar os atendimentos',async()=>{
  const {pg,db,query,count}=await fixture();
  try {
    await legacyOrders(query);
    const history=JSON.stringify((await query('SELECT payload FROM history_records ORDER BY upstream_id')).rows);
    const snapshots=JSON.stringify((await query('SELECT records FROM history_pages')).rows);
    const plan=await planInstallationContext(db,scope);
    assert.ok(plan.targets.every(target=>target.clientRecoveredFromSnapshot));
    assert.equal(await count('source_records',"WHERE kind='serviceOrders' AND payload ? 'codigo_cliente'"),0,'plano não corrige origem');
    const client={gate:{interval:1000},attendanceDetail:async protocol=>detail(scope.targets.findIndex(t=>t.protocol===protocol)+1)};
    await captureInstallationContext(db,client,scope,env);
    assert.equal(await count('source_records',"WHERE kind='serviceOrders' AND payload ? 'codigo_cliente'"),0,'captura ainda não publica');
    const cached=(await query("SELECT key,value FROM application_settings WHERE key LIKE 'hubsoft_installation_context:%' ORDER BY key")).rows;
    await query('DELETE FROM application_settings WHERE key=$1',[cached[2].key]);
    await assert.rejects(applyInstallationContext(db,scope,env),/CONTEXTO_CACHE_DIVERGENTE/);
    assert.equal(await count('source_records',"WHERE kind='serviceOrders' AND payload ? 'codigo_cliente'"),0,'falha reverte também os códigos das OS anteriores');
    await query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',[cached[2].key,JSON.stringify(cached[2].value)]);
    await applyInstallationContext(db,scope,env);
    assert.equal(await count('commercial_records',"WHERE kind='sales'"),3);
    assert.equal(await count('commercial_records',"WHERE kind='renewals'"),1);
    assert.equal(await count('source_records',"WHERE kind='serviceOrders' AND payload ? 'codigo_cliente'"),3);
    assert.equal(JSON.stringify((await query('SELECT payload FROM history_records ORDER BY upstream_id')).rows),history);
    assert.equal(JSON.stringify((await query('SELECT records FROM history_pages')).rows),snapshots);
    await applyInstallationContext(db,scope,env);
    assert.equal(await count('source_records'),7);assert.equal(await count('commercial_records',"WHERE kind='sales'"),3);
  } finally {await pg.close();}
});

test('recuperação exige snapshots inequívocos e nunca aceita cliente diferente no detalhe',async()=>{
  const {pg,db,query,count}=await fixture();
  try {
    const raw=await legacyOrders(query);
    const single={...scope,targets:[scope.targets[0]]};
    for(const change of [
      {numero:'999'}, {id_atendimento:'999'}, {atendimento:{protocolo:'999'}}, {deleted_at:'2026-11-05'},
      {cliente:'Cliente sem código'}, {codigo_cliente:'999'},
    ]) {
      await query('UPDATE history_pages SET records=$1::jsonb',[JSON.stringify([{...raw[0],...change}])]);
      await assert.rejects(planInstallationContext(db,single));
    }
    await query('UPDATE history_pages SET records=$1::jsonb',[JSON.stringify([raw[0],{...raw[0],cliente:'(999) Outro cliente'}])]);
    await assert.rejects(planInstallationContext(db,single),/CONTEXTO_CLIENTE_DIVERGENTE/);
    await query('UPDATE history_pages SET records=$1::jsonb',[JSON.stringify(raw)]);
    await assert.rejects(captureInstallationContext(db,{gate:{interval:1000},attendanceDetail:async()=>({...detail(1),codigo_cliente:'999'})},single,env),/CONTEXTO_ATENDIMENTO_DIVERGENTE/);
    assert.equal(await count('application_settings',"WHERE key LIKE 'hubsoft_installation_context:%'"),0);
    await query('UPDATE history_pages SET processed=false');
    await assert.rejects(planInstallationContext(db,single),/CONTEXTO_CLIENTE_SEM_EVIDENCIA/);
    assert.equal(await count('source_records',"WHERE kind='serviceOrders' AND payload ? 'codigo_cliente'"),0);
  } finally {await pg.close();}
});
