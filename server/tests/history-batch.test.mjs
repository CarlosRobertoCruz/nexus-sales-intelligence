import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateManifest,monthsFor,daysFor,usesProtocolPilot} from '../historyPolicy.mjs';
process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/test';
process.env.TZ='America/Sao_Paulo';
const {pool}=await import('../db.mjs');
const {createHistoryJob,controlHistoryJob,historyStep,approveHistoryMonth,enableHistoryProtocol,historyStatus}=await import('../history.mjs');
const {upsertRows,rebuild}=await import('../records.mjs');
const parentId='11111111-1111-4111-8111-111111111111';
const refs=month=>Object.fromEntries(['attendance','serviceOrders'].map((kind,index)=>[kind,{
  fileSha256:(index?'b':'a').repeat(64),exportedAt:'2026-11-09',keyField:kind==='attendance'?'protocolo':'numero_ordem_servico',keys:[],
  filters:{dateField:kind==='attendance'?'data_cadastro':'data_termino_executado',otherFilters:'none',addressType:'instalacao'},
  exportFilters:{dateField:kind==='attendance'?'data_cadastro':'data_termino_executado',start:`${month}-01`,end:`${month}-${month==='2026-02'?'28':'31'}`,otherFilters:'none',addressType:'instalacao'},
}]));
const manifest=()=>({year:2026,phase:'history',months:['2026-01','2026-02'],cutoff:'2026-02-28',osDateField:'data_termino_executado',
  maxCalls:5000,autoPublish:false,approvedOctoberJob:parentId,monthReports:{'2026-01':refs('2026-01'),'2026-02':refs('2026-02')}});

test('lote exige um ou dois meses explícitos consecutivos e nunca seleciona nove meses por padrão',()=>{
  const m=manifest();assert.equal(validateManifest(m).phase,'history');assert.deepEqual(monthsFor(m),['2026-01','2026-02']);
  assert.equal(daysFor(m,'2026-01').length+daysFor(m,'2026-02').length,59);
  for(const months of [undefined,[],['2026-01','2026-02','2026-03'],['2026-02','2026-01'],['2026-01','2026-03'],['2026-01','2026-01'],['2025-12'],['2026-10']])
    assert.throws(()=>validateManifest({...m,months}),/MESES_LOTE_INVALIDOS/);
  assert.throws(()=>daysFor(m,'2026-03'),/MES_FORA_DO_LOTE/);
  for(const change of [{cutoff:'2026-02-27'},{osDateField:'data_cadastro'},{maxCalls:5001},{autoPublish:true},
    {monthReports:{...m.monthReports,'2026-03':refs('2026-03')}}]) assert.throws(()=>validateManifest({...m,...change}));
  const single={...m,months:['2026-09'],cutoff:'2026-09-30',monthReports:{'2026-09':refs('2026-09')}};
  single.monthReports['2026-09'].attendance.exportFilters.end='2026-09-30';
  single.monthReports['2026-09'].serviceOrders.exportFilters.end='2026-09-30';
  assert.equal(validateManifest(single).months.length,1);
  const wrong=structuredClone(m);wrong.monthReports['2026-01'].serviceOrders.exportFilters.dateField='data_cadastro';
  assert.throws(()=>validateManifest(wrong),/FILTROS_RELATORIO_FORA_DO_MES/);
});

test('protocolo é vinculado a job, meses e corte, com orçamento total limitado',()=>{
  const id='22222222-2222-4222-8222-222222222222',m=manifest();
  assert.equal(usesProtocolPilot(m,id),false);
  const enabled={...m,enrichmentStrategy:'protocol',protocolException:{enabled:true,jobId:id,months:m.months,cutoff:m.cutoff}};
  assert.equal(usesProtocolPilot(enabled,id),true);
  for(const change of [{maxCalls:5001},{autoPublish:true},{months:['2026-08','2026-09']},{cutoff:'2026-03-31'},
    {protocolException:{...enabled.protocolException,month:'2026-10',months:undefined}},{protocolException:{...enabled.protocolException,enabled:false}}])
    assert.throws(()=>usesProtocolPilot({...enabled,...change},id),/EXCECAO/);
  assert.throws(()=>usesProtocolPilot(enabled,parentId),/EXCECAO/);
});

test('dois meses são coletados, reconciliados e publicados separadamente, com pausa e outubro preservado',async()=>{
  const pg=new PGlite();
  try {
    for(const file of ['001_initial.sql','002_history.sql','003_attendance_followups.sql']) await pg.exec(await readFile(new URL('../../database/migrations/'+file,import.meta.url),'utf8'));
    const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:true}]}):pg.query(sql,args);
    const db={query,connect:async()=>({query,release(){}})};pool.query=query;pool.connect=db.connect;
    const m=manifest();
    await assert.rejects(createHistoryJob(db,m),/PILOTO_OUTUBRO_OBRIGATORIO/);
    await query("INSERT INTO history_jobs(id,phase,manifest,state,approved) VALUES($1,'october',$2::jsonb,'complete',true)",[parentId,JSON.stringify({osDateField:'data_termino_executado'})]);
    const raw=(month,id)=>({id_atendimento:id,protocolo:`2026${month}020001`,codigo_cliente:'12',cliente:{codigo_cliente:'12',nome_razaosocial:'Teste'},
      data_cadastro:`02/${month}/2026`,descricao_abertura:'Instalação 600 Mega Combo Plus',tipo_atendimento:'INSTALAÇÃO',status:'Resolvido',usuario_abertura:'Beatriz'});
    const os=(month,id,parent)=>({id_ordem_servico:id,numero_ordem_servico:String(id),id_atendimento:parent,codigo_cliente:'12',cliente:{codigo_cliente:'12',nome_razaosocial:'Teste'},
      tipo:'INSTALAÇÃO',status:'Finalizado',data_cadastro:`02/${month}/2026 08:00:00`,data_inicio_programado:`02/${month}/2026 09:00:00`,
      data_inicio_executado:`02/${month}/2026 09:00:00`,data_termino_executado:`02/${month}/2026 10:00:00`});
    await upsertRows(db,'attendance',[{...raw('10',900),nome_razaosocial:'Teste'}],'hubsoft');
    await upsertRows(db,'serviceOrders',[{...os('10',990,900),nome_razaosocial:'Teste',tipo_ordem_servico:'INSTALAÇÃO',data_referencia_bi:'data_termino_executado'}],'hubsoft');
    await rebuild(db);
    const october=JSON.stringify((await query("SELECT kind,id,payload FROM source_records ORDER BY kind,id")).rows);
    m.monthReports['2026-01'].attendance.keys=['202601020001'];m.monthReports['2026-01'].serviceOrders.keys=['201'];
    m.monthReports['2026-02'].attendance.keys=['202602020001'];m.monthReports['2026-02'].serviceOrders.keys=['202'];
    const id=await createHistoryJob(db,m);const permission=await enableHistoryProtocol(db,id);
    assert.equal(permission.state,'planned');assert.equal(permission.enrichment_strategy,'protocol');assert.equal(permission.calls.calls,0);
    const calls=[];
    const client={gate:{interval:1000},page:async(stream,day)=>{
      assert.ok(m.months.includes(day.slice(0,7)));calls.push(`${stream}:${day}`);
      const month=day.slice(5,7),parent=month==='01'?101:102;
      return {records:day.endsWith('-02')?(stream==='attendance'?[{...raw(month,parent),usuario_abertura:null}]:stream==='serviceOrderCompletions'?[os(month,parent+100,parent)]:[]):[],complete:true};
    },clientAttendances:()=>assert.fail('não deve consultar cliente após opt-in'),attendanceDetail:async protocol=>{
      calls.push(`detail:${protocol}`);return raw(protocol.slice(4,6),protocol.startsWith('202601')?101:102);
    }};
    await controlHistoryJob(db,id,'start');
    await assert.rejects(enableHistoryProtocol(db,id),/ESTADO_NAO_PERMITE_EXCECAO/);
    let status;
    for(let i=0;i<250;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
    assert.equal(status.state,'awaiting_validation');assert.equal(status.current_month,'2026-01');
    assert.equal(calls.some(call=>call.includes('2026-02')||call.includes('202602')),false);
    assert.equal(JSON.stringify((await query("SELECT kind,id,payload FROM source_records ORDER BY kind,id")).rows),october);
    const evidence=month=>({month,reviewer:'Teste',confirmFilters:true,
      ...Object.fromEntries(['attendance','serviceOrders'].map(kind=>[kind,{reportSha256:m.monthReports[month][kind].fileSha256,keys:m.monthReports[month][kind].keys}]))});
    await assert.rejects(approveHistoryMonth(db,id,evidence('2026-02')),/EVIDENCIA_INVALIDA/);
    await approveHistoryMonth(db,id,evidence('2026-01'));
    const before=calls.length;status=await historyStep(db,client,id);assert.equal(calls.length,before);
    assert.equal(status.current_month,'2026-02');assert.ok(new Date(status.next_at).getTime()>Date.now()+290000);
    await query('UPDATE history_jobs SET next_at=now() WHERE id=$1',[id]); // Test clock only.
    for(let i=0;i<250;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
    assert.equal(status.state,'awaiting_validation');assert.equal(status.current_month,'2026-02');
    const done=await approveHistoryMonth(db,id,evidence('2026-02'));assert.equal(done.state,'complete');assert.equal(done.approved,true);assert.equal(done.current_month,null);
    const after=calls.length;await historyStep(db,client,id);assert.equal(calls.length,after);
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales'")).rows[0].n,3);
    assert.equal(JSON.stringify((await query("SELECT kind,id,payload FROM source_records WHERE id IN ('hubsoft:900','hubsoft:990') ORDER BY kind,id")).rows),october);
    assert.deepEqual((await historyStatus(db,id)).months,['2026-01','2026-02']);
    const second=await createHistoryJob(db,{...m,maxCalls:1});
    assert.ok(new Date((await historyStatus(db,second)).next_at).getTime()>Date.now()+290000,'lote seguinte respeita pausa do anterior');
    await enableHistoryProtocol(db,second);await controlHistoryJob(db,second,'start');
    await query('UPDATE history_jobs SET next_at=now() WHERE id=$1',[second]);
    await query("INSERT INTO hubsoft_call_metrics(job_id,method,path,status,latency_ms) VALUES($1,'GET','/test',200,1)",[second]);
    const stopped=await historyStep(db,client,second);assert.equal(stopped.state,'paused');assert.equal(stopped.error_code,'ORCAMENTO_ATINGIDO');
    assert.equal(calls.length,after,'esgotamento não inicia chamada nem apaga dados anteriores');
  } finally {await pg.close();}
});
