import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {validateAutomaticConfig,automaticManifest,validateAutomaticManifest,saoPauloDay,shiftDay} from '../automaticPolicy.mjs';
import {validateManifest,daysFor,usesProtocolPilot} from '../historyPolicy.mjs';
import {configureAutomaticSync,automaticTick,controlAutomaticSync,publishAutomaticMonth,dailyWindow} from '../automaticSync.mjs';
import {createHistoryJob,historyStep,historyStatus,approveHistoryMonth} from '../history.mjs';
import {upsertRows,rebuild} from '../records.mjs';
import {normalized} from '../historyNormalization.mjs';
const parent='11111111-1111-4111-8111-111111111111';
const config={version:1,startDate:'2025-01-01',approvedOctoberJob:parent,backfillFrom:'2025-01',backfillThrough:'last_closed_month',dailyAt:'02:00',reviewDays:30,maxCalls:5000};
const env={HUBSOFT_AUTOMATIC_ENABLED:'true',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_REQUESTS_PER_SECOND:'1'};
const br=day=>day.slice(8)+'/'+day.slice(5,7)+'/'+day.slice(0,4);
const attendance=(id,day,status='Resolvido')=>({id_atendimento:String(id),protocolo:`2026${id}0001`,codigo_cliente:'12',cliente:{codigo_cliente:'12',nome_razaosocial:'Teste'},
  data_cadastro:br(day),usuario_abertura:'Beatriz',status,tipo_atendimento:'RENOVAÇÃO DE CONTRATO',descricao_abertura:'Renovação de contrato 600 Mega Combo Plus',ordem_servico_count:0,ordens_servico:[]});
const order=(id,parentId,day)=>({id_ordem_servico:String(id),numero:String(id),id_atendimento:String(parentId),
  atendimento:{id_atendimento:String(parentId),protocolo:`2026${parentId}0001`},codigo_cliente:'12',cliente:{codigo_cliente:'12',nome_razaosocial:'Teste'},
  tipo:'INSTALAÇÃO',status:'Finalizado',data_cadastro:br(day)+' 08:00:00',data_inicio_programado:br(day)+' 09:00:00',
  data_inicio_executado:br(day)+' 09:00:00',data_termino_executado:br(day)+' 10:00:00'});
async function database() {
  const pg=new PGlite();
  for(const file of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql']) await pg.exec(await readFile(new URL('../../database/migrations/'+file,import.meta.url),'utf8'));
  let busy=false;
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:!busy}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await query("INSERT INTO history_jobs(id,phase,manifest,state,approved) VALUES($1,'october',$2::jsonb,'complete',true)",[parent,JSON.stringify({osDateField:'data_termino_executado'})]);
  return {db,pg,query,setBusy:value=>{busy=value;}};
}

test('automação começa em 2025, aceita virada de ano e divide 30 dias sem exceder dois meses',()=>{
  assert.deepEqual(validateAutomaticConfig(config),config);
  for(const change of [{startDate:'2024-01-01'},{year:2026},{reviewDays:365},{maxCalls:100000},{backfillFrom:'2026-01'},{backfillThrough:'2026-12'}]) assert.throws(()=>validateAutomaticConfig({...config,...change}));
  const m=automaticManifest(config,'backfill',['2025-01','2025-02'],'2025-01-01','2025-02-28','2026-11-10');
  assert.equal(validateManifest(m).validation,'api_snapshot');assert.equal(usesProtocolPilot(m),true);
  assert.equal(daysFor(m,'2025-02').length,28);
  const crossing=automaticManifest(config,'backfill',['2025-12','2026-01'],'2025-12-01','2026-01-31','2026-11-10');
  assert.equal(daysFor(crossing,'2025-12').length,31);
  for(const change of [{months:['2025-01','2025-03']},{months:['2025-01','2025-02','2025-03']},{cutoff:'2025-02-27'},
    {from:'2024-12-01'},{maxCalls:5001},{validation:'human_report'},{mode:'daily'},{autoPublish:false}]) assert.throws(()=>validateAutomaticManifest({...m,...change}));
  const first=dailyWindow('2026-03-02');
  assert.deepEqual(first.months,['2026-01','2026-02']);
  const three=dailyWindow('2026-03-02','2025-01-01','2026-01-31');
  assert.deepEqual(three.months,['2026-01','2026-02']);assert.equal(three.cutoff,'2026-02-28');
  assert.equal(dailyWindow('2026-03-02','2025-01-01',shiftDay(three.cutoff,1)).from,'2026-03-01');
  assert.equal(dailyWindow('2027-01-05').cutoff,'2027-01-04');
  assert.equal(dailyWindow('2025-01-02').from,'2025-01-01');
  const output=execFileSync(process.execPath,['server/jobs/automatic-sync.mjs','plan','deploy/automatic-sync.example.json'],{cwd:new URL('../..',import.meta.url),env:{...process.env,DATABASE_URL:''},encoding:'utf8'});
  assert.equal(JSON.parse(output).enabled,false);
});

test('worker retoma, atualiza antigos, recupera contexto 2025 e publica sem simular relatórios',async()=>{
  const {db,query,pg,setBusy}=await database();
  try {
    const base=attendance(800,'2026-10-01');base.tipo_atendimento='INSTALAÇÃO';
    await upsertRows(db,'attendance',[normalized('attendance',base)],'hubsoft');
    await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order(900,800,'2026-10-01')),data_referencia_bi:'data_termino_executado'}],'hubsoft');
    const pending=attendance(110,'2025-01-02','Pendente'),changed=attendance(111,'2026-01-03','Pendente');
    await upsertRows(db,'attendance',[normalized('attendance',pending),normalized('attendance',changed)],'hubsoft');await rebuild(db);
    const preserved=(await query("SELECT payload FROM source_records WHERE id='hubsoft:800'")).rows[0].payload;
    await configureAutomaticSync(db,config);
    const calls=[],today=saoPauloDay(),recent=shiftDay(today,-2),now=new Date(today+'T23:59:59-03:00');
    const oldParent={...attendance(700,'2025-12-20'),tipo_atendimento:'INSTALAÇÃO',descricao_abertura:'Instalação 600 Mega Combo Plus'};
    const fresh=attendance(112,recent);
    const details=[{...pending,status:'Resolvido'},{...changed,status:'Resolvido'},oldParent,fresh];
    const client={gate:{interval:1000},page:async(stream,day,page)=>{
      assert.equal(page,0);calls.push(`${stream}:${day}`);
      return {records:stream==='attendance'&&day===recent?[{...fresh,usuario_abertura:null}]:
        stream==='attendanceChanges'&&day===recent?[changed]:stream==='serviceOrderCompletions'&&day===recent?[order(701,700,recent),order(702,700,recent)]:[],complete:true};
    },attendanceDetail:async protocol=>{calls.push(`detail:${protocol}`);const row=details.find(r=>r.protocolo===protocol);assert.ok(row);return row;}};
    await automaticTick(db,client,env,{now});assert.equal(calls.length,0);
    await assert.rejects(controlAutomaticSync(db,'enable',{}),/DESATIVADA/);
    await controlAutomaticSync(db,'enable',env);
    let status=await automaticTick(db,client,env,{now});assert.equal(status.job.phase,'automatic');
    const id=status.active_job;assert.equal(calls.length,0);
    await automaticTick(db,client,env,{now});const checkpoint=calls.length;
    await controlAutomaticSync(db,'pause',env);await automaticTick(db,client,env,{now});assert.equal(calls.length,checkpoint);
    await controlAutomaticSync(db,'resume',env);setBusy(true);
    await assert.rejects(automaticTick(db,client,env,{now}),/EM_ANDAMENTO/);assert.equal(calls.length,checkpoint);setBusy(false);
    for(let i=0;i<300;i++) {
      await query("UPDATE history_jobs SET next_at=now()-interval '1 day' WHERE id=$1",[id]); // advance test clock only
      status=await automaticTick(db,client,env,{now});if(!status.active_job||status.error_code)break;
    }
    assert.equal(status.error_code,null);assert.equal(status.active_job,null);
    const job=await historyStatus(db,id);assert.equal(job.state,'complete');assert.equal(job.approved,false);
    assert.equal(calls.filter(call=>call===`detail:${oldParent.protocolo}`).length,1);
    assert.equal(calls.filter(call=>call===`detail:${fresh.protocolo}`).length,1);
    const context=(await query("SELECT payload FROM source_records WHERE id='hubsoft:700'")).rows[0].payload;
    assert.equal(context.publication_scope,'installation_context');assert.equal(context.installation_context_order_ids,'701,702');
    const source=(await query("SELECT payload FROM source_records WHERE id='hubsoft:110'")).rows[0].payload;
    assert.equal(source.status,'Resolvido');assert.equal(source.data_cadastro,'02/01/2025');
    assert.deepEqual((await query("SELECT payload FROM source_records WHERE id='hubsoft:800'")).rows[0].payload,preserved);
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales'")).rows[0].n,3);
    const audits=(await query('SELECT reconciliation FROM history_months WHERE job_id=$1',[id])).rows;
    assert.ok(audits.every(r=>r.reconciliation.validation==='api_snapshot'&&r.reconciliation.externalReportReconciled===false));
    const before=calls.length;
    await query("UPDATE automatic_sync SET next_at=now()-interval '1 day'");
    status=await automaticTick(db,client,env,{now});
    assert.equal(calls.length,before);assert.equal(status.job.phase,'automatic');
    assert.deepEqual(status.job.months,['2025-01','2025-02']); // no repeated daily cycle
  }finally{await pg.close();}
});

test('publica produção de janeiro de 2025 e não persiste atendimentos anteriores ao corte',async()=>{
  const {db,query,pg}=await database();
  try {
    const m=automaticManifest(config,'daily',['2025-01'],'2025-01-01','2025-01-02','2026-11-10');
    const id=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[id]);
    const a={...attendance(20,'2025-01-01'),tipo_atendimento:'INSTALAÇÃO',descricao_abertura:'Instalação 600 Mega Combo Plus'};
    const before={...attendance(22,'2024-12-20'),tipo_atendimento:'INSTALAÇÃO',descricao_abertura:'Instalação 600 Mega Combo Plus'};
    const client={gate:{interval:1000},page:async(stream,day)=>({complete:true,records:
      stream==='attendance'&&day==='2025-01-01'?[a]:stream==='attendanceChanges'&&day==='2025-01-01'?[before]:
        stream==='serviceOrderCompletions'&&day==='2025-01-02'?[order(30,20,day),order(31,22,day)]:[]}),
      attendanceDetail:async protocol=>protocol===a.protocolo?a:before};
    let status;for(let i=0;i<25;i++){status=await historyStep(db,client,id);if(status.state!=='running')break;}
    assert.equal(status.state,'awaiting_validation');await publishAutomaticMonth(db,id);
    const rows=(await query('SELECT kind,payload FROM source_records')).rows;
    assert.equal(rows.filter(r=>r.kind==='attendance').length,1);
    assert.equal(rows.find(r=>r.kind==='attendance').payload.data_cadastro,'01/01/2025');
    assert.equal(rows.find(r=>r.payload.id_ordem_servico==='31').payload.context_status,'before_scope');
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales' AND event_date >= '2025-01-01' AND event_date < '2026-01-01'")).rows[0].n,1);
    assert.equal((await query("SELECT count(*)::int AS n FROM history_pages p CROSS JOIN LATERAL jsonb_array_elements(p.records) AS r(item) WHERE p.stream LIKE 'attendance%' AND r.item->>'id_atendimento'='22'")).rows[0].n,0);
  }finally{await pg.close();}
});

test('ausência na origem e erro de publicação preservam o painel; orçamento pausa sem repetir chamadas',async()=>{
  const {db,query,pg}=await database();
  try {
    const a=attendance(10,'2026-01-01');
    await upsertRows(db,'attendance',[normalized('attendance',a)],'hubsoft');
    await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order(11,10,'2026-01-01')),data_referencia_bi:'data_termino_executado'}],'hubsoft');await rebuild(db);
    const before=(await query('SELECT kind,id,payload FROM source_records ORDER BY kind,id')).rows;
    const m=automaticManifest(config,'daily',['2026-01'],'2026-01-01','2026-01-01','2026-11-10');
    const id=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[id]);
    let count=0;const client={gate:{interval:1000},page:async()=>{count++;return {records:[],complete:true};}};
    for(let i=0;i<10;i++){const r=await historyStep(db,client,id);if(r.state==='awaiting_validation')break;}
    await assert.rejects(publishAutomaticMonth(db,id),/REGISTRO_PUBLICADO_AUSENTE_NA_API/);
    await assert.rejects(approveHistoryMonth(db,id,{}),/AUTOMACAO_USA_VALIDACAO_TECNICA/);
    assert.deepEqual((await query('SELECT kind,id,payload FROM source_records ORDER BY kind,id')).rows,before);
    const budgetId=await createHistoryJob(db,{...m,maxCalls:1});await query("UPDATE history_jobs SET state='running' WHERE id=$1",[budgetId]);
    await query("INSERT INTO hubsoft_call_metrics(job_id,method,path,status,latency_ms) VALUES($1,'POST','/oauth/token',200,1)",[budgetId]);
    const used=count;const status=await historyStep(db,client,budgetId);
    assert.equal(status.state,'paused');assert.equal(status.error_code,'ORCAMENTO_ATINGIDO');assert.equal(count,used);
    const retryId=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[retryId]);
    let attempts=0;const limited={gate:{interval:1000},page:async()=>{attempts++;throw Object.assign(new Error('limited'),{code:'HUBSOFT_LIMITE_AGUARDE',retryAt:Date.now()+120000});}};
    const wait=await historyStep(db,limited,retryId);assert.equal(wait.state,'running');assert.ok(new Date(wait.next_at)>new Date(Date.now()+110000));
    await historyStep(db,limited,retryId);assert.equal(attempts,1);
    for(let i=0;i<2;i++){await query("UPDATE history_jobs SET next_at=now()-interval '1 day' WHERE id=$1",[retryId]);await historyStep(db,limited,retryId);}
    assert.equal((await historyStatus(db,retryId)).state,'paused');assert.equal(attempts,3);
    const incompleteId=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[incompleteId]);
    const incomplete={...a,descricao_abertura:'',tipo_atendimento:''};
    const bad={gate:{interval:1000},page:async stream=>({records:stream==='attendance'?[incomplete]:[],complete:true}),attendanceDetail:async()=>incomplete};
    for(let i=0;i<12;i++){const r=await historyStep(db,bad,incompleteId);if(r.state==='awaiting_validation')break;}
    await assert.rejects(publishAutomaticMonth(db,incompleteId),/REVISAO_CAMPOS_INCOMPLETOS_OBRIGATORIA/);
    assert.deepEqual((await query('SELECT kind,id,payload FROM source_records ORDER BY kind,id')).rows,before);
    const repeatId=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[repeatId]);
    const repeated={gate:{interval:1000},page:async()=>({records:[a],complete:false}),attendanceDetail:async()=>a};
    let repeatedStatus;
    for(let i=0;i<5;i++){repeatedStatus=await historyStep(db,repeated,repeatId);if(repeatedStatus.state!=='running')break;}
    assert.equal(repeatedStatus.error_code,'HUBSOFT_PAGINAS_REPETIDAS');
    const wrongId=await createHistoryJob(db,m);await query("UPDATE history_jobs SET state='running' WHERE id=$1",[wrongId]);
    const wrongDate=await historyStep(db,{gate:{interval:1000},page:async()=>({records:[{...a,data_cadastro:'02/01/2026'}],complete:true})},wrongId);
    assert.equal(wrongDate.error_code,'HUBSOFT_FILTRO_DE_DATA_DIVERGENTE');
  }finally{await pg.close();}
});
