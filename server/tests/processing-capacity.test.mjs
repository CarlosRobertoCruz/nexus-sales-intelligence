import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {MAX_ROWS,upsertRows,worksheetRecords,classifyStoredRows} from '../records.mjs';
import {classifyCommercialRows,buildCancellationDetail,createCancellationDetailBuilder} from '../../server-dist/commercial.js';
import {publishAutomaticMonth,controlAutomaticSync} from '../automaticSync.mjs';
import {automaticManifest} from '../automaticPolicy.mjs';
import {createHistoryJob,historyStatus} from '../history.mjs';

const parent='11111111-1111-4111-8111-111111111111';
const a={id_atendimento:'60001',protocolo:'202607010001',codigo_cliente:'12',nome_razaosocial:'Cliente ficticio',data_cadastro:'01/07/2026',
  usuario_abertura:'Beatriz',status:'Resolvido',tipo_atendimento:'INSTALAÇÃO',descricao_abertura:'Instalação 600 Mega Combo Plus',bairro:'Cachoeira'};
const o={id_ordem_servico:'70001',numero_ordem_servico:'70001',id_atendimento:a.id_atendimento,codigo_cliente:a.codigo_cliente,nome_razaosocial:a.nome_razaosocial,
  tipo_ordem_servico:'INSTALAÇÃO',status:'Finalizado',data_inicio_programado:'02/07/2026 09:00',data_inicio_executado:'02/07/2026 09:00',data_termino_executado:'02/07/2026 10:00',data_referencia_bi:'data_termino_executado'};
const sheet=records=>{const headers=[...new Set(records.flatMap(Object.keys))];return {fileName:'Base central',rows:[headers,...records.map(r=>headers.map(k=>r[k]??null))]};};

test('classificacao direta preserva resultados da planilha e contexto nativo/legado',()=>{
  const variants=[
    {a:[a],o:[o]},
    {a:[{...a,publication_scope:'installation_context',installation_context_order_ids:o.id_ordem_servico}, {...a,id_atendimento:'60002',protocolo:'202607020001',tipo_atendimento:'SUPORTE'}],o:[o]},
    {a:[{...a,id_atendimento:undefined}],o:[{...o,id_ordem_servico:undefined,id_atendimento:undefined}]},
  ];
  for(const v of variants){
    const raw=[...v.a.map(payload=>({kind:'attendance',payload})),...v.o.map(payload=>({kind:'serviceOrders',payload}))];
    assert.deepEqual(classifyStoredRows(raw),classifyCommercialRows(sheet(v.a),sheet(v.o)));
  }
});

test('indice de relatos conserva ordem, referencias, cliente, datas e total de OS disponiveis',()=>{
  const orders=Array.from({length:150},(_,i)=>({...o,id_ordem_servico:String(i+1),numero_ordem_servico:String(i+1),
    id_atendimento:i%7===0?'60001':String(500+i),codigo_cliente:i%3===0?'12':i%4===0?'':'99',
    data_cadastro:i%5===0?'03/07/2026 10:00':'01/07/2026 10:00',descricao_servico:'Ficticio '+i}));
  const indexed=createCancellationDetailBuilder(orders);
  for(const change of [{},{codigo_cliente:''},{id_atendimento:''},{descricao_fechamento:'Ordem de serviço nº 17'},{codigo_cliente:'99',descricao_fechamento:'Ordem de serviço 7'},{data_fechamento:'01/07/2026'}]) {
    const row={...a,...change};assert.deepEqual(indexed(row),buildCancellationDetail(row,orders));
  }
});

test('arquivo acima de 50 mil continua recusado antes de interpretar celulas',()=>{
  assert.equal(MAX_ROWS,50000);
  assert.throws(()=>worksheetRecords({rows:Array(50002)},'attendance'),/PLANILHA_INVALIDA_OU_MUITO_GRANDE/);
});

test('job pausado retoma e publica acima de 50 mil fontes sem repetir consultas ou apagar historico',async()=>{
  const pg=new PGlite();let maximumInsertBatch=0;
  const query=(sql,args=[])=>{
    if(sql.includes('advisory'))return Promise.resolve({rows:[{locked:true}]});
    if(sql.includes('INSERT INTO commercial_records'))maximumInsertBatch=Math.max(maximumInsertBatch,JSON.parse(args[1]).length);
    return pg.query(sql,args);
  };
  const db={query,connect:async()=>({query,release(){}})};
  try {
    for(const name of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql'])await pg.exec(await readFile(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
    await query(`INSERT INTO source_records(kind,id,payload,source)
      SELECT 'attendance','hubsoft:'||i,jsonb_build_object('id_atendimento',i::text,'protocolo',(2000000000000+i)::text,
        'codigo_cliente','99','nome_razaosocial','Ficticio','data_cadastro','01/01/2025','usuario_abertura','Beatriz','status','Resolvido','tipo_atendimento','SUPORTE'), 'hubsoft'
      FROM generate_series(1,50000) AS i`);
    await query("INSERT INTO history_jobs(id,phase,manifest,state,approved) VALUES($1,'october','{\"osDateField\":\"data_termino_executado\"}','complete',true)",[parent]);
    const config={version:1,startDate:'2025-01-01',approvedOctoberJob:parent,backfillFrom:'2025-01',backfillThrough:'last_closed_month',dailyAt:'02:00',reviewDays:30,maxCalls:5000};
    const manifest=automaticManifest(config,'backfill',['2026-07'],'2026-07-01','2026-07-31','2026-11-12');
    const id=await createHistoryJob(db,manifest);
    await query("INSERT INTO history_months(job_id,month) VALUES($1,'2026-07')",[id]);
    await query(`INSERT INTO history_pages(job_id,day,stream,page,records,complete,processed)
      SELECT $1,d::date,stream,0,'[]',true,true FROM generate_series('2026-07-01'::date,'2026-07-31'::date,'1 day') AS d
      CROSS JOIN unnest(ARRAY['attendance','attendanceChanges','serviceOrderCompletions']) AS stream`,[id]);
    for(const [kind,payload] of [['attendance',a],['serviceOrders',o]])await query('INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
      [id,'2026-07',kind,payload[kind==='attendance'?'id_atendimento':'id_ordem_servico'],JSON.stringify(payload),'direct']);
    await query("UPDATE history_jobs SET state='paused',error_code='BASE_ATINGIU_LIMITE_50000_REGISTROS' WHERE id=$1",[id]);
    await query("INSERT INTO automatic_sync(id,config,enabled,active_job,error_code) VALUES(1,$1::jsonb,true,$2,'BASE_ATINGIU_LIMITE_50000_REGISTROS')",[JSON.stringify(config),id]);
    await controlAutomaticSync(db,'resume',{HUBSOFT_AUTOMATIC_ENABLED:'true',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_REQUESTS_PER_SECOND:'1'});
    assert.equal((await historyStatus(db,id)).state,'running');
    assert.deepEqual((await query('SELECT count(*)::int AS pages,count(*) FILTER(WHERE processed)::int AS processed FROM history_pages WHERE job_id=$1',[id])).rows[0],{pages:93,processed:93});
    await query("UPDATE history_jobs SET state='awaiting_validation' WHERE id=$1",[id]);
    await publishAutomaticMonth(db,id);
    assert.equal((await historyStatus(db,id)).state,'complete');
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,50002);
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='attendance'")).rows[0].n,50001);
    assert.equal((await query("SELECT count(*)::int AS n FROM commercial_records WHERE kind='sales'")).rows[0].n,1);
    assert.equal((await query('SELECT count(*)::int AS n FROM hubsoft_call_metrics')).rows[0].n,0);
    assert.equal(maximumInsertBatch,1000);
    await upsertRows(db,'attendance',[a],'hubsoft');
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,50002);
    // The cumulative ceiling is gone, but a single oversized history job still cannot publish.
    const oversized=await createHistoryJob(db,manifest);
    await query("UPDATE history_jobs SET state='awaiting_validation' WHERE id=$1",[oversized]);
    await query(`INSERT INTO history_pages(job_id,day,stream,page,records,complete,processed)
      SELECT $1,d::date,stream,0,'[]',true,true FROM generate_series('2026-07-01'::date,'2026-07-31'::date,'1 day') AS d
      CROSS JOIN unnest(ARRAY['attendance','attendanceChanges','serviceOrderCompletions']) AS stream`,[oversized]);
    await query(`INSERT INTO history_records(job_id,month,kind,upstream_id,payload,origin)
      SELECT $1,'2026-07','attendance',i::text,jsonb_build_object('id_atendimento',i::text),'direct'
      FROM generate_series(1,50001) AS i`,[oversized]);
    const publishedBefore=(await query("SELECT payload FROM commercial_records WHERE kind='sales'")).rows;
    await assert.rejects(publishAutomaticMonth(db,oversized),/BASE_ATINGIU_LIMITE_50000_REGISTROS/);
    assert.deepEqual((await query("SELECT payload FROM commercial_records WHERE kind='sales'")).rows,publishedBefore);
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,50002);
  }finally{await pg.close();}
});
