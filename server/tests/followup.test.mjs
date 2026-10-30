import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/test';
process.env.TZ='America/Sao_Paulo';
const {pool}=await import('../db.mjs');
const {createHistoryJob,controlHistoryJob,historyStep,approveHistoryMonth,enablePilotProtocol}=await import('../history.mjs');
const {followupReport,orderDate,followupOrder}=await import('../historyFollowup.mjs');
const {validateManifest}=await import('../historyPolicy.mjs');
const {rebuild}=await import('../records.mjs');
const {historyReconciliation,attachHistoryReports}=await import('../historyReconciliation.mjs');

const report=(hash,dateField)=>({fileSha256:hash.repeat(64),exportedAt:'2026-10-28T10:00:00Z',filters:{dateField,otherFilters:'none'}});
const manifest={year:2026,phase:'day',peakDay:'2026-10-15',cutoff:'2026-10-15',followupCutoff:'2026-10-27',osDateField:'data_termino_executado',maxCalls:500,
  reports:{attendance:report('a','data_cadastro'),serviceOrders:report('b','data_termino_executado'),
    followup:{...report('c','data_cadastro'),filters:{dateField:'data_cadastro',otherFilters:'none',relationship:'id_atendimento',followupCutoff:'2026-10-27'}}}};
const attendance={id_atendimento:101,protocolo:'202610150001',codigo_cliente:12,cliente:{codigo_cliente:12,nome_razaosocial:'Cliente de teste'},
  descricao_abertura:'Instalacao',data_cadastro:'15/10/2026',usuario_abertura:'Beatriz',tipo_atendimento:'Instalacao',status:'Finalizado',ordem_servico_count:6};
const otherAttendance={...attendance,id_atendimento:102,protocolo:'202610150002',usuario_abertura:'Carlos',ordem_servico_count:0};
const os={id_ordem_servico:201,id_atendimento:101,numero_ordem_servico:'201',cliente:attendance.cliente,tipo:'INSTALACAO',status:'finalizado',
  data_cadastro:'15/10/2026 08:00:00',data_inicio_programado:'15/10/2026 09:00:00',data_inicio_executado:'20/10/2026 09:00:00',data_termino_executado:'20/10/2026 10:00:00'};
const pending={...os,id_ordem_servico:202,numero_ordem_servico:'202',status:'Pendente',data_inicio_programado:null,data_inicio_executado:null,data_termino_executado:null};
const cancelled={...pending,id_ordem_servico:203,numero_ordem_servico:'203',status:'Cancelado'};
const sameDay={...os,id_ordem_servico:204,numero_ordem_servico:'204',data_inicio_programado:'14/10/2026 09:00:00',data_inicio_executado:'15/10/2026 09:00:00',data_termino_executado:'15/10/2026 10:00:00'};
const earlierAttendance={...os,id_ordem_servico:205,numero_ordem_servico:'205',id_atendimento:103,data_inicio_executado:'15/10/2026 21:00:00',data_termino_executado:'2026-10-16T01:30:00Z'};
const orphan={...sameDay,id_ordem_servico:206,numero_ordem_servico:'206',id_atendimento:null,atendimento:null};
const nextMonth={...pending,id_ordem_servico:207,numero_ordem_servico:'207',data_inicio_programado:'02/11/2026 09:00:00'};
const createdAfterCutoff={...pending,id_ordem_servico:208,numero_ordem_servico:'208',data_cadastro:'28/10/2026 08:00:00'};
const evidence={month:'2026-10',reviewer:'Operador Teste',confirmFilters:true,attendance:{reportSha256:'a'.repeat(64),ids:['101','102']},
  serviceOrders:{reportSha256:'b'.repeat(64),ids:['204','205','206']},followup:{reportSha256:'c'.repeat(64),ids:['201','202','203','204','207']}};

async function fixture(run) {
  const pg=new PGlite();
  try {
    for(const name of ['001_initial.sql','002_history.sql','003_attendance_followups.sql']) await pg.exec(await readFile(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
    const query=(sql,params=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:true}]}):pg.query(sql,params);
    const adapter={query,connect:async()=>({query,release(){}})};
    pool.query=query;pool.connect=adapter.connect;
    await run(adapter);
  } finally {await pg.close();}
}
function fakeClient({incomplete=false,wrongParent=false}={}) {
  const calls=[];
  return {calls,page:async(stream,day,page,dateField)=>{
    calls.push({stream,day,page,dateField});
    return {records:stream==='attendance'?[attendance,otherAttendance,{...attendance,id_atendimento:103,data_cadastro:'14/10/2026'}]:stream==='attendanceChanges'?[attendance]:[sameDay,earlierAttendance,orphan,os],complete:true};
  },clientAttendances:async(code,day)=>{
    calls.push({customer:code,day});
    return [{...attendance,ordens_servico:[wrongParent?{...os,id_atendimento:999}:os,pending,cancelled,sameDay,nextMonth,...(incomplete?[]:[createdAfterCutoff])]},
      {...otherAttendance,ordens_servico:[]}];
  }};
}
async function collect(db,client) {
  const id=await createHistoryJob(db,structuredClone(manifest));
  await controlHistoryJob(db,id,'start');
  let status;
  for(let i=0;i<24;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
  return {id,status};
}

test('corte do acompanhamento exige conclusão, referências próprias e dias completos',()=>{
  assert.equal(validateManifest(manifest,'2026-10-28').peakDay,'2026-10-15');
  const today=structuredClone(manifest);today.followupCutoff='2026-10-28';today.reports.followup.filters.followupCutoff=today.followupCutoff;
  assert.throws(()=>validateManifest(today,'2026-10-28'),/CORTE/);
  assert.throws(()=>validateManifest({...manifest,reports:{...manifest.reports,followup:undefined}},'2026-10-28'),/RELATORIOS/);
  const invalid=structuredClone(manifest);invalid.followupCutoff='2026-10-14';invalid.reports.followup.filters.followupCutoff=invalid.followupCutoff;
  assert.throws(()=>validateManifest(invalid,'2026-10-28'),/ANTERIOR/);
  assert.throws(()=>validateManifest({...manifest,osDateField:'data_cadastro'},'2026-10-28'),/CAMPO_DATA|CONCLUSAO/);
});

test('OS preserva hora, converte offset para São Paulo e não inventa datas para pendentes',()=>{
  assert.equal(orderDate('2026-10-16T01:30:45Z'),'15/10/2026 22:30:45');
  assert.equal(orderDate('2026-10-16 01:30:00'),'16/10/2026 01:30:00');
  assert.throws(()=>orderDate('2026-10-15'),/DATA/);
  assert.throws(()=>orderDate('31/02/2026 10:00:00'),/DATA/);
  assert.equal(followupOrder(pending,attendance,'2026-10-27').outcome,'pending_observed');
  assert.equal(followupOrder(cancelled,attendance,'2026-10-27').outcome,'cancelled_observed');
  assert.equal(followupOrder({...os,data_termino_executado:'28/10/2026 10:00:00'},attendance,'2026-10-27').outcome,'concluded_after_cutoff');
  assert.equal(followupOrder(createdAfterCutoff,attendance,'2026-10-27'),null);
});

test('dia 15: produção por conclusão separada dos vínculos futuros, sem atribuir OS ao cliente errado',async()=>fixture(async db=>{
  const client=fakeClient(),{id,status}=await collect(db,client);
  assert.equal(status.state,'awaiting_validation',JSON.stringify(status));
  assert.deepEqual(status.totals.sort((a,b)=>a.kind.localeCompare(b.kind)).map(r=>r.unique_records),[2,3]);
  assert.equal(client.calls.filter(c=>c.customer).length,1,'enriquece cliente distinto mesmo com autor já conhecido');
  assert.deepEqual(client.calls.filter(c=>c.stream).map(c=>c.stream),['attendance','attendanceChanges','serviceOrderCompletions'],'consulta de conclusão não é repetida');
  assert.ok(client.calls.every(c=>c.day==='2026-10-15'),'não amplia consultas externas para os dias de acompanhamento');
  const draft=await followupReport(db,id);
  assert.equal(draft.attendanceCount,2);assert.equal(draft.orderCount,5);assert.equal(draft.attendancesWithoutOrders,1);
  assert.deepEqual(draft.completionsByDay,{'2026-10-20':1,'2026-10-15':1});
  assert.equal(draft.outcomes.pending_observed,2);assert.equal(draft.outcomes.cancelled_observed,1);
  assert.equal(draft.orders.find(o=>o.id_ordem_servico==='207').data_inicio_programado,'02/11/2026 09:00:00','preserva vínculo que atravessa mês');
  assert.equal((await followupReport(db,id,{publishedOnly:true})).orderCount,0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
  await assert.rejects(approveHistoryMonth(db,id,{...evidence,followup:{...evidence.followup,ids:['204']}}),/RECONCILIACAO_ACOMPANHAMENTO/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0,'erro nos vínculos também reverte a produção');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance_followup_snapshots')).rows[0].n,0);
  await approveHistoryMonth(db,id,evidence);
  assert.equal((await followupReport(db,id,{publishedOnly:true})).orderCount,5);
  const source=(await db.query("SELECT id,payload FROM source_records WHERE kind='serviceOrders' ORDER BY id")).rows;
  assert.deepEqual(source.map(r=>r.id),['hubsoft:204','hubsoft:205','hubsoft:206']);
  assert.ok(source.every(r=>r.payload.data_referencia_bi==='data_termino_executado'));
  assert.equal(source[1].payload.id_atendimento,'103','OS concluída no dia pode ter atendimento anterior');
  const dates=(await db.query("SELECT (event_date AT TIME ZONE 'America/Sao_Paulo')::date::text AS day FROM commercial_records WHERE kind='serviceOrders'")).rows;
  assert.equal(dates.length,3);assert.ok(dates.every(r=>r.day==='2026-10-15'),'BI usa conclusão, não programação');
  const sales=(await db.query("SELECT payload FROM commercial_records WHERE kind='sales'")).rows;
  assert.equal(sales.length,1,'órfã e atendimento anterior não são atribuídos a outro atendimento por cliente');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance_order_followups')).rows[0].n,5);
  const second=await collect(db,fakeClient());
  await approveHistoryMonth(db,second.id,evidence);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM attendance_order_followups')).rows[0].n,5,'reexecutar o mesmo corte não duplica vínculos');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,5,'reexecutar não duplica entidades');
}));

test('vínculos incompletos ou pai divergente pausam sem publicar nem perder o checkpoint',async()=>fixture(async db=>{
  for(const options of [{incomplete:true},{wrongParent:true}]) {
    const {id,status}=await collect(db,fakeClient(options));
    assert.equal(status.state,'paused');
    assert.equal(status.error_code,options.incomplete?'VINCULOS_OS_INCOMPLETOS':'VINCULO_OS_DIVERGENTE');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM history_pages WHERE job_id=$1 AND NOT processed',[id])).rows[0].n,1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM history_followup_attendances WHERE job_id=$1',[id])).rows[0].n,0);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
}));

test('conclusão sem programação pode entrar; OS sem conclusão não recebe uma hora ou data substituta',async()=>fixture(async db=>{
  const client=fakeClient();
  const original=client.page;
  client.page=async(...args)=>{
    const result=await original(...args);
    if(args[0]==='serviceOrderCompletions') result.records=result.records.filter(o=>o.id_ordem_servico!==201).map(o=>({...o,data_inicio_programado:null}));
    return result;
  };
  const {id,status}=await collect(db,client);
  assert.equal(status.state,'awaiting_validation',JSON.stringify(status));
  await approveHistoryMonth(db,id,evidence);
  await rebuild(db);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='serviceOrders'")).rows[0].n,3);
  const missing=fakeClient();missing.page=async(stream)=>({records:stream==='serviceOrderCompletions'?[pending]:[],complete:true});
  assert.equal((await collect(db,missing)).status.error_code,'HUBSOFT_OS_CONCLUSAO_AUSENTE');
}));

test('conferência por planilha é local, mantém IDs canônicos e não publica escopo divergente ou referência pendente',async()=>fixture(async db=>{
  const {id,status}=await collect(db,fakeClient());
  assert.equal(status.state,'awaiting_validation');
  const refs=structuredClone(manifest.reports);
  refs.attendance.keyField='protocolo';refs.attendance.keys=['202610150001','202610150002'];
  refs.serviceOrders.keyField='numero_ordem_servico';refs.serviceOrders.keys=['204','205','206'];
  refs.serviceOrders.exportFilters={dateField:'data_cadastro'};
  refs.followup={pending:true,filters:structuredClone(refs.followup.filters)};
  const partial=await attachHistoryReports(db,id,refs);
  assert.equal(partial.publishable,false);
  assert.equal(partial.reports.attendance.status,'matched');
  assert.equal(partial.reports.serviceOrders.blocker,'ESCOPO_RELATORIO_NAO_COMPARAVEL');
  assert.equal(partial.reports.followup.blocker,'REFERENCIA_ACOMPANHAMENTO_PENDENTE');
  const proof={...evidence,attendance:{reportSha256:refs.attendance.fileSha256,keys:refs.attendance.keys},serviceOrders:{reportSha256:refs.serviceOrders.fileSha256,keys:refs.serviceOrders.keys}};
  await assert.rejects(approveHistoryMonth(db,id,proof),/ACOMPANHAMENTO_PENDENTE/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
  refs.followup={...manifest.reports.followup,keyField:'numero_ordem_servico',keys:evidence.followup.ids};
  await attachHistoryReports(db,id,refs);
  await assert.rejects(approveHistoryMonth(db,id,{...proof,followup:{reportSha256:refs.followup.fileSha256,keys:refs.followup.keys}}),/ESCOPO_RELATORIO/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
  refs.serviceOrders.exportFilters.dateField='data_termino_executado';
  await attachHistoryReports(db,id,refs);
  const result=await historyReconciliation(db,id);
  assert.equal(result.publishable,true);
  assert.deepEqual(result.reports.attendance.mapping.map(r=>r.id),['101','102']);
  await approveHistoryMonth(db,id,{...proof,followup:{reportSha256:refs.followup.fileSha256,keys:refs.followup.keys}});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,5);
  await assert.rejects(attachHistoryReports(db,id,refs),/ESTADO_NAO_PERMITE/);
}));

test('piloto retoma a página já salva por protocolo com cache próprio, sem apagar consultas por cliente',async()=>fixture(async db=>{
  const m={...structuredClone(manifest),peakDay:'2026-10-01',cutoff:'2026-10-01'};
  const first={...attendance,data_cadastro:'01/10/2026',ordem_servico_count:0};
  const second={...otherAttendance,data_cadastro:'01/10/2026',ordem_servico_count:0};
  const calls=[];
  const client={page:async stream=>{calls.push(stream);return {records:stream==='attendance'?[first,second]:stream==='attendanceChanges'?[first]:[],complete:true};},
    clientAttendances:async()=>{calls.push('client');return [];},
    attendanceDetail:async protocol=>{calls.push(`protocol:${protocol}`);return {...(protocol===first.protocolo?first:second),ordens_servico:[],cliente:{...first.cliente,cpf_cnpj:'do-not-persist'},token:'do-not-persist'};}};
  const id=await createHistoryJob(db,m);
  await controlHistoryJob(db,id,'start');
  let status;
  for(let i=0;i<5;i++){status=await historyStep(db,client,id);if(status.state==='paused')break;}
  assert.equal(status.error_code,'HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO');
  const original=(await db.query('SELECT records FROM history_pages WHERE job_id=$1',[id])).rows[0].records;
  const enabled=await enablePilotProtocol(db,id);
  assert.equal(enabled.enrichment_strategy,'protocol');assert.equal(enabled.state,'paused');
  assert.equal((await db.query('SELECT manifest FROM history_jobs WHERE id=$1',[id])).rows[0].manifest.maxCalls,500);
  await controlHistoryJob(db,id,'start');
  await db.query('UPDATE history_jobs SET next_at=now() WHERE id=$1',[id]);
  for(let i=0;i<20;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
  assert.equal(status.state,'awaiting_validation',JSON.stringify(status));
  assert.equal(calls.filter(c=>c==='client').length,1,'modo novo não tenta novamente a consulta por cliente');
  assert.equal(calls.filter(c=>c==='attendance').length,1,'página existente não é consultada novamente');
  assert.equal(calls.filter(c=>c.startsWith('protocol:')).length,2,'cada atendimento é consultado uma vez, inclusive entre fluxos');
  assert.deepEqual((await db.query("SELECT records FROM history_pages WHERE job_id=$1 AND stream='attendance'",[id])).rows[0].records,original);
  assert.equal((await db.query('SELECT jsonb_array_length(records) AS n FROM history_clients WHERE job_id=$1',[id])).rows[0].n,0);
  const cache=(await db.query("SELECT value FROM application_settings WHERE key LIKE $1",[`hubsoft_history_protocol:${id}:%`])).rows;
  assert.equal(cache.length,2);assert.equal(JSON.stringify(cache).includes('do-not-persist'),false);
  const records=(await db.query("SELECT payload FROM history_records WHERE job_id=$1 ORDER BY upstream_id",[id])).rows;
  assert.deepEqual(records.map(r=>r.payload.usuario_abertura),['Beatriz','Carlos']);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
  await assert.rejects(enablePilotProtocol(db,id),/ESTADO_NAO_PERMITE_EXCECAO/);
}));

test('piloto por protocolo rejeita identidade, cliente, data e campos inválidos antes de armazenar cache',async()=>fixture(async db=>{
  const m={...structuredClone(manifest),peakDay:'2026-10-01',cutoff:'2026-10-01'};
  const raw={...attendance,data_cadastro:'01/10/2026',ordem_servico_count:0,usuario_abertura:null};
  const good={...raw,usuario_abertura:'Beatriz',ordens_servico:[]};
  const cases=[
    [{...good,id_atendimento:999},'HUBSOFT_ATENDIMENTO_ID_DIVERGENTE'],
    [{...good,protocolo:'999'},'HUBSOFT_PROTOCOLO_DIVERGENTE'],
    [{...good,cliente:{codigo_cliente:999}},'HUBSOFT_CLIENTE_DIVERGENTE'],
    [{...good,data_cadastro:'02/10/2026'},'HUBSOFT_ATENDIMENTO_DIA_DIVERGENTE'],
    [{...good,usuario_abertura:''},'HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES'],
    [{...good,deleted_at:'2026-10-02'},'EXCLUSAO_EXIGE_RECONCILIACAO']
  ];
  for(const [response,error] of cases) {
    const id=await createHistoryJob(db,m);
    await db.query("UPDATE history_jobs SET state='paused',error_code='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO' WHERE id=$1",[id]);
    await enablePilotProtocol(db,id);
    await controlHistoryJob(db,id,'start');
    const client={page:async()=>({records:[raw],complete:true}),attendanceDetail:async()=>response};
    await historyStep(db,client,id);
    const status=await historyStep(db,client,id);
    assert.equal(status.state,'paused');assert.equal(status.error_code,error);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM application_settings WHERE key LIKE $1',[`hubsoft_history_protocol:${id}:%`])).rows[0].n,0);
  }
  const id=await createHistoryJob(db,m);
  await db.query("UPDATE history_jobs SET state='paused',error_code='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO' WHERE id=$1",[id]);
  await enablePilotProtocol(db,id);await controlHistoryJob(db,id,'start');
  await db.query("INSERT INTO hubsoft_call_metrics(job_id,method,path,status,latency_ms) SELECT $1,'GET','/test',200,1 FROM generate_series(1,500)",[id]);
  const status=await historyStep(db,{page:async()=>{throw new Error('must not fetch');}},id);
  assert.equal(status.error_code,'ORCAMENTO_ATINGIDO');assert.equal(status.pages.pages,0);
}));

test('retomada completa campos pelo detalhe, preserva páginas concluídas e expõe somente diagnóstico seguro',async()=>fixture(async db=>{
  const m={...structuredClone(manifest),peakDay:'2026-10-01',cutoff:'2026-10-01'};
  const raw={...attendance,data_cadastro:'01/10/2026',usuario_abertura:null,descricao_abertura:null,tipo_atendimento:{id_tipo_atendimento:1},ordem_servico_count:0};
  const detail={...raw,descricao_abertura:'Instalação confirmada',tipo_atendimento:'Instalação',usuario_abertura:'Beatriz',ordens_servico:[]};
  const prior={...detail,id_atendimento:100,protocolo:'202610010000'};
  const id=await createHistoryJob(db,m);
  await db.query("UPDATE history_jobs SET state='paused',error_code='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO' WHERE id=$1",[id]);
  await enablePilotProtocol(db,id);
  await db.query("INSERT INTO history_pages(job_id,day,stream,page,records,complete,processed) VALUES($1,'2026-10-01','attendance',0,$2::jsonb,false,true),($1,'2026-10-01','attendance',1,$3::jsonb,true,false)",[id,JSON.stringify([prior]),JSON.stringify([raw])]);
  await db.query("INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,'2026-10','attendance','100',$2::jsonb,'direct')",[id,JSON.stringify(prior)]);
  await db.query("INSERT INTO history_followup_attendances(job_id,month,attendance_id,opened_on,observed_at,reported_orders,received_orders) VALUES($1,'2026-10','100','2026-10-01',now(),0,0)",[id]);
  let fetched=0;
  const client={page:async stream=>{assert.notEqual(stream,'attendance','páginas de atendimentos já estão salvas');return {records:[],complete:true};},attendanceDetail:async()=>{fetched++;return detail;}};
  await controlHistoryJob(db,id,'start');
  let status;
  for(let i=0;i<15;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
  assert.equal(status.state,'awaiting_validation',JSON.stringify(status));assert.equal(fetched,1);
  const saved=(await db.query("SELECT payload FROM history_records WHERE job_id=$1 AND upstream_id='101'",[id])).rows[0].payload;
  assert.equal(saved.descricao_abertura,'Instalação confirmada');assert.equal(saved.tipo_atendimento,'Instalação');assert.equal(saved.usuario_abertura,'Beatriz');
  assert.deepEqual((await db.query("SELECT payload FROM history_records WHERE job_id=$1 AND upstream_id='100'",[id])).rows[0].payload,prior);
  assert.deepEqual((await db.query("SELECT records FROM history_pages WHERE job_id=$1 AND stream='attendance' AND page=1",[id])).rows[0].records,[raw]);
  const failed=await createHistoryJob(db,m);
  await db.query("UPDATE history_jobs SET state='paused',error_code='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO' WHERE id=$1",[failed]);
  await enablePilotProtocol(db,failed);await controlHistoryJob(db,failed,'start');
  const bad={page:async()=>({records:[raw],complete:true}),attendanceDetail:async()=>({...detail,usuario_abertura:null})};
  await historyStep(db,bad,failed);
  const error=await historyStep(db,bad,failed);
  assert.equal(error.state,'paused');assert.equal(error.error_code,'HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES');
  assert.deepEqual(error.diagnostic,{kind:'attendance',missingFields:['usuario_abertura'],invalidFields:[]});
  const diagnostic=(await db.query('SELECT value FROM application_settings WHERE key=$1',[`hubsoft_history_diagnostic:${failed}`])).rows[0].value;
  assert.deepEqual(diagnostic,error.diagnostic);assert.equal(JSON.stringify(diagnostic).includes('Beatriz'),false);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
}));

test('dados de negócio realmente ausentes não bloqueiam coleta; publicação exige revisão explícita',async()=>fixture(async db=>{
  const m={...structuredClone(manifest),peakDay:'2026-10-01',cutoff:'2026-10-01'};
  const raw={...attendance,protocolo:'202610010001',data_cadastro:'01/10/2026',usuario_abertura:null,descricao_abertura:null,tipo_atendimento:null,ordem_servico_count:0};
  const detail={...raw,usuario_abertura:'Beatriz',ordens_servico:[]};
  const order={...orphan,data_cadastro:'01/10/2026 08:00:00',data_inicio_programado:'01/10/2026 09:00:00',data_inicio_executado:'01/10/2026 09:00:00',data_termino_executado:'01/10/2026 10:00:00'};
  const id=await createHistoryJob(db,m);
  await db.query("UPDATE history_jobs SET state='paused',error_code='HUBSOFT_ATENDIMENTO_NAO_RESOLVIDO' WHERE id=$1",[id]);
  await enablePilotProtocol(db,id);await controlHistoryJob(db,id,'start');
  let details=0;
  const client={page:async stream=>({records:stream==='attendance'?[raw]:stream==='serviceOrderCompletions'?[order]:[],complete:true}),attendanceDetail:async()=>{details++;return detail;}};
  let status;
  for(let i=0;i<14;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
  assert.equal(status.state,'awaiting_validation',JSON.stringify(status));assert.equal(details,1);
  assert.equal(status.totals.find(r=>r.kind==='attendance').incomplete_records,1);
  const stored=(await db.query("SELECT payload FROM history_records WHERE job_id=$1 AND kind='attendance'",[id])).rows[0].payload;
  assert.equal(stored.classification_status,'incomplete');assert.equal(stored.descricao_abertura,'');assert.equal(stored.tipo_atendimento,'');
  const proof={month:'2026-10',reviewer:'Teste',confirmFilters:true,attendance:{reportSha256:m.reports.attendance.fileSha256,ids:['101']},serviceOrders:{reportSha256:m.reports.serviceOrders.fileSha256,ids:[String(order.id_ordem_servico)]},followup:{reportSha256:m.reports.followup.fileSha256,ids:[]}};
  await assert.rejects(approveHistoryMonth(db,id,proof),/REVISAO_CAMPOS_INCOMPLETOS/);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,0);
  await approveHistoryMonth(db,id,{...proof,confirmIncompleteRecords:true});
  assert.equal((await db.query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='attendance'")).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales'")).rows[0].n,0);
  const report=await historyReconciliation(db,id);
  assert.equal(report.quality.incompleteAttendances,1);assert.equal(report.quality.requiresExplicitReview,true);
}));
