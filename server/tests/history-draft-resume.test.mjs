import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {automaticManifest} from '../automaticPolicy.mjs';
import {configureAutomaticSync,controlAutomaticSync,automaticTick} from '../automaticSync.mjs';
import {automaticEnrichmentStep} from '../automaticEnrichment.mjs';
import {createHistoryJob,historyStep} from '../history.mjs';
import {isAbandonedAttendanceDraft} from '../historyDrafts.mjs';

const parent='11111111-1111-4111-8111-111111111111';
const config={version:1,startDate:'2025-01-01',approvedOctoberJob:parent,backfillFrom:'2025-01',backfillThrough:'last_closed_month',dailyAt:'02:00',reviewDays:30,maxCalls:5000};
const env={HUBSOFT_AUTOMATIC_ENABLED:'true',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_REQUESTS_PER_SECOND:'1'};
const draft={id_atendimento:231161,protocolo:'202607240001',data_cadastro:'24/07/2026',rascunho:true,
  descricao_abertura:'',tipo_atendimento:'',ordem_servico_count:0,status:'Pendente'};
const attendance={id_atendimento:231162,protocolo:'202607240002',data_cadastro:'24/07/2026',codigo_cliente:12,
  cliente:{codigo_cliente:12,nome_razaosocial:'Cliente ficticio'},usuario_abertura:'Beatriz',rascunho:false,
  tipo_atendimento:'RENOVAÇÃO DE CONTRATO',descricao_abertura:'Renovação de contrato 600 Mega Combo Plus',
  status:'Resolvido',ordem_servico_count:0,ordens_servico:[]};
const manifest=()=>automaticManifest(config,'daily',['2026-07'],'2026-07-24','2026-07-24','2026-11-10');
async function database() {
  const pg=new PGlite();
  for(const file of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql']) {
    await pg.exec(await readFile(new URL('../../database/migrations/'+file,import.meta.url),'utf8'));
  }
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:true}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await query("INSERT INTO history_jobs(id,phase,manifest,state,approved) VALUES($1,'october',$2::jsonb,'complete',true)",
    [parent,JSON.stringify({osDateField:'data_termino_executado'})]);
  return {pg,query,db};
}

test('retoma pagina salva com rascunho sem cliente nem autor, preserva auditoria e exclui indicadores',async()=>{
  const {pg,query,db}=await database();
  try {
    await configureAutomaticSync(db,config);
    const id=await createHistoryJob(db,manifest());
    await query("UPDATE history_jobs SET state='paused',error_code='IDENTIFICADOR_INVALIDO' WHERE id=$1",[id]);
    await query("UPDATE automatic_sync SET enabled=true,active_job=$1,error_code='IDENTIFICADOR_INVALIDO'",[id]);
    const page=[draft,attendance];
    await query("INSERT INTO history_pages(job_id,day,stream,page,records,complete) VALUES($1,'2026-07-24','attendance',0,$2::jsonb,true)",[id,JSON.stringify(page)]);
    const cache={record:attendance,observedAt:'2026-11-10T12:00:00Z'};
    await query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)',
      [`hubsoft_history_protocol:${id}:${attendance.id_atendimento}`,JSON.stringify(cache)]);
    const calls=[];
    const client={gate:{interval:1000},page:async(stream)=>{
      calls.push(stream);
      assert.notEqual(stream,'attendance','nao refazer a pagina ja salva');
      return {complete:true,records:stream==='serviceOrderCompletions'?[{
        id_ordem_servico:300,numero:300,tipo:'SUPORTE',status:'Finalizado',codigo_cliente:12,cliente:attendance.cliente,
        data_cadastro:'24/07/2026 08:00:00',data_inicio_programado:'24/07/2026 09:00:00',
        data_inicio_executado:'24/07/2026 09:00:00',data_termino_executado:'24/07/2026 10:00:00'
      }]:[]};
    },attendanceDetail:async()=>assert.fail('nao consultar detalhe de rascunho nem repetir o cache valido')};
    await controlAutomaticSync(db,'resume',env);
    let state;
    for(let step=0;step<12;step++) {
      state=await automaticTick(db,client,env);
      if(state.error_code||!state.active_job) break;
    }
    assert.equal(state.error_code,null,JSON.stringify(state));
    assert.equal(state.active_job,null);
    assert.deepEqual(calls,['attendanceChanges','serviceOrderCompletions']);
    const preserved=(await query("SELECT records,processed FROM history_pages WHERE job_id=$1 AND stream='attendance'",[id])).rows[0];
    assert.deepEqual(preserved.records,page);assert.equal(preserved.processed,true);
    const source=(await query("SELECT payload FROM source_records WHERE kind='attendance' AND id='hubsoft:231161'")).rows[0].payload;
    assert.equal(source.classification_status,'discarded_draft');
    assert.equal(source.classification_reason,'abandoned_draft');
    assert.equal(source.codigo_cliente,'');assert.equal(source.nome_razaosocial,'');assert.equal(source.usuario_abertura,'');
    assert.equal(source.data_cadastro,'24/07/2026');assert.equal(source.protocolo,draft.protocolo);
    const commercial=(await query("SELECT kind,count(*)::int AS count FROM commercial_records GROUP BY kind")).rows;
    assert.equal(commercial.find(r=>r.kind==='attendance').count,1);
    assert.equal(commercial.find(r=>r.kind==='renewals').count,1);
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales'")).rows[0].n,0);
    const followup=await createHistoryJob(db,manifest());
    assert.equal(await automaticEnrichmentStep(db,client,{id:followup,manifest:manifest()},'2026-07'),false,
      'o ciclo diario seguinte nao tenta enriquecer o rascunho descartado');
  } finally {await pg.close();}
});

test('sem cliente continua bloqueando atendimento com conteudo, OS ou sem evidencia de rascunho',async()=>{
  const {pg,query,db}=await database();
  try {
    for(const change of [
      {rascunho:false}, {descricao_abertura:'Cliente solicitou cancelamento'},
      {tipo_atendimento:'INSTALAÇÃO'}, {ordem_servico_count:1}, {ordem_servico_count:undefined},
      {ordens_servico:[{id_ordem_servico:300}]}, {descricao_fechamento:'Cliente confirmou a instalação'},
      {atendimento_mensagem:[{mensagem:'Solicito cancelamento'}]}
    ]) {
      const row={...draft,...change};
      assert.equal(isAbandonedAttendanceDraft(row),false,JSON.stringify(change));
      const id=await createHistoryJob(db,manifest());
      await query("UPDATE history_jobs SET state='running' WHERE id=$1",[id]);
      await query("INSERT INTO history_pages(job_id,day,stream,page,records,complete) VALUES($1,'2026-07-24','attendance',0,$2::jsonb,true)",[id,JSON.stringify([row])]);
      const state=await historyStep(db,{gate:{interval:1000},page:async()=>assert.fail('pagina ja salva'),
        attendanceDetail:async()=>assert.fail('cliente ausente nao e autorizado pela regra de rascunho')},id);
      assert.equal(state.state,'paused');assert.equal(state.error_code,'IDENTIFICADOR_INVALIDO');
      assert.equal((await query('SELECT count(*)::int AS n FROM history_records WHERE job_id=$1',[id])).rows[0].n,0);
    }
  } finally {await pg.close();}
});

test('rascunho abandonado ainda exige identidade, protocolo e data validos',async()=>{
  const {pg,query,db}=await database();
  try {
    for(const change of [{id_atendimento:null},{protocolo:''},{data_cadastro:'invalida'},
      {id_atendimento:Number.MAX_SAFE_INTEGER+1},{protocolo:Number.MAX_SAFE_INTEGER+1}]) {
      const id=await createHistoryJob(db,manifest());
      await query("UPDATE history_jobs SET state='running' WHERE id=$1",[id]);
      await query("INSERT INTO history_pages(job_id,day,stream,page,records,complete) VALUES($1,'2026-07-24','attendance',0,$2::jsonb,true)",[id,JSON.stringify([{...draft,...change}])]);
      const state=await historyStep(db,{gate:{interval:1000},page:async()=>assert.fail('pagina ja salva')},id);
      assert.equal(state.state,'paused');
      assert.equal((await query('SELECT count(*)::int AS n FROM history_records WHERE job_id=$1',[id])).rows[0].n,0);
      assert.equal((await query('SELECT processed FROM history_pages WHERE job_id=$1',[id])).rows[0].processed,false);
    }
  } finally {await pg.close();}
});
