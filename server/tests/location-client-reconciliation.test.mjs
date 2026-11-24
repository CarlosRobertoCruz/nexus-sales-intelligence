import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {HubsoftClient} from '../hubsoft.mjs';
import {normalized} from '../historyNormalization.mjs';
import {upsertRows,rebuild} from '../records.mjs';
import {CLIENT_RECONCILIATION_CASE as spec,planClientReconciliation,captureClientReconciliation,applyClientReconciliation} from '../locationClientReconciliation.mjs';
import {captureServiceLocations,planServiceLocations} from '../locationServiceRepair.mjs';

process.env.TZ='America/Sao_Paulo';
const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'fake',HUBSOFT_CLIENT_SECRET:'fake',HUBSOFT_USERNAME:'fake',HUBSOFT_PASSWORD:'fake',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_AUTOMATIC_ENABLED:'true'};
const attendance={id_atendimento:spec.attendanceId,protocolo:spec.protocol,codigo_cliente:spec.oldCustomer,nome_razaosocial:'Pessoa ficticia',
  usuario_abertura:'Beatriz',data_cadastro:'09/12/2025',descricao_abertura:'Instalação 600 Mega Combo Plus',tipo_atendimento:'INSTALAÇÃO',status:'Resolvido'};
const order={id_ordem_servico:spec.orderId,numero_ordem_servico:spec.orderNumber,id_atendimento:spec.attendanceId,codigo_cliente:spec.oldCustomer,
  nome_razaosocial:'Pessoa ficticia',tipo:'INSTALAÇÃO',status:'Finalizado',data_cadastro:'09/12/2025 16:15:19',
  data_inicio_programado:'12/12/2025 09:00:00',data_inicio_executado:spec.started,data_termino_executado:spec.finished};
const fresh=()=>({...attendance,codigo_cliente:spec.newCustomer,cliente:{codigo_cliente:spec.newCustomer},
  servico:{id_cliente_servico:spec.serviceId,senha:'NAO_PERSISTIR'},
  ordens_servico:[{...order,codigo_cliente:spec.newCustomer,cliente:{codigo_cliente:spec.newCustomer},servico:{id_cliente_servico:spec.serviceId}}]});
const listed=()=>({...attendance,codigo_cliente:spec.newCustomer,cliente_servico:{id_cliente_servico:spec.serviceId,cliente:{codigo_cliente:spec.newCustomer}}});
function client(options={}){
  const calls=[];let token;
  const gate={interval:1000,token:async work=>token??(token=await work()),invalidateToken:async()=>{token=null;},perform:async(meta,send)=>{
    const response=await send();if(response.status===429)throw Object.assign(new Error('HUBSOFT_LIMITE_AGUARDE'),{code:'HUBSOFT_LIMITE_AGUARDE'});
    if(response.error)throw response.error;return response.data;
  }};
  const api=new HubsoftClient(env,async(url,request)=>{
    const u=new URL(url);calls.push({url:u,method:request.method,redirect:request.redirect});
    if(u.pathname==='/oauth/token')return Response.json({access_token:'NAO_PERSISTIR',expires_in:3600});
    if(u.pathname.endsWith('/cliente/atendimento'))return Response.json({atendimentos:[options.detail??fresh()]});
    if(u.pathname.endsWith('/atendimento/todos')){
      if(options.failList)return Response.json({}, {status:429});
      return Response.json({atendimentos:options.list??[listed()],paginacao:{pagina_atual:1,ultima_pagina:1}});
    }
    if(u.pathname.endsWith('/cliente'))return Response.json({clientes:[{codigo_cliente:spec.newCustomer,servicos:[{id_cliente_servico:spec.serviceId,endereco_instalacao:{bairro:'Muriqui',cidade:'Mangaratiba'}}]}]});
    throw new Error('Unexpected route');
  },async()=>{},gate);
  return {api,calls,gate};
}
async function database(){
  const pg=new PGlite();
  for(const name of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql'])await pg.exec(await readFile(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
  let busy=false;
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:!busy}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await upsertRows(db,'attendance',[normalized('attendance',attendance)],'hubsoft');
  await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order),data_referencia_bi:'data_termino_executado'}],'hubsoft');
  await rebuild(db);
  return {db,query,pg,busy:v=>{busy=v;}};
}
const sources=async q=>(await q('SELECT * FROM source_records ORDER BY kind,id')).rows;
const events=async q=>(await q('SELECT * FROM commercial_records ORDER BY kind,id')).rows;
const settings=async q=>(await q('SELECT key,value FROM application_settings ORDER BY key')).rows;
const budgetKey=`location_service_budget:v1:${spec.scope}`;
const casePrefix=`location_client_reconciliation:${spec.caseId}`;

test('previa offline, captura limitada e apply auditado preservam indicadores, historico e orcamento; idempotencia e retomada',async()=>{
  const {db,query,pg}=await database();const {api,calls,gate}=client();
  try{
    await query('INSERT INTO application_settings(key,value) VALUES($1,$2)',[budgetKey,{used:913,maximum:1500}]);
    const checkpoint=`location_service_identity:2025-12:hubsoft:${spec.orderId}`;
    await query('INSERT INTO application_settings(key,value) VALUES($1,$2)',[checkpoint,{fingerprint:'historical',id_cliente_servico:spec.serviceId}]);
    await query("INSERT INTO application_settings(key,value) VALUES('location_service_evidence:2025-11:other','{\"untouched\":true}')");
    await query("INSERT INTO application_settings(key,value) VALUES('hubsoft_history_protocol:old:215431','{\"record\":{\"codigo_cliente\":\"8211\"}}')");
    const beforeSources=await sources(query),beforeEvents=await events(query);
    const before=await planClientReconciliation(db);
    assert.equal(before.state,'needs_capture');assert.equal(before.checkpointsToArchive,1);assert.equal(before.commercialChanges,0);assert.equal(calls.length,0);
    await assert.rejects(applyClientReconciliation(db),/ACEITE/);
    const proof=await captureClientReconciliation(db,api,{env});
    assert.equal(api.gate,gate);assert.equal(proof.state,'ready_for_review');assert.equal(proof.callsThisRun,3);assert.equal(proof.callsReserved,916);
    assert.deepEqual(await sources(query),beforeSources);assert.deepEqual(await events(query),beforeEvents);
    assert.equal(calls.filter(c=>c.url.pathname.endsWith('/cliente')).length,0);
    const list=calls.find(c=>c.url.pathname.endsWith('/atendimento/todos'));
    assert.equal(list.url.searchParams.get('pagina'),'1');assert.equal(list.url.searchParams.get('itens_por_pagina'),'50');
    assert.equal(list.url.searchParams.get('data_inicio'),'2025-12-09');assert.equal(list.url.searchParams.get('data_fim'),'2025-12-09');
    assert.ok(calls.every(c=>c.redirect==='error'&&(c.method==='GET'||c.url.pathname==='/oauth/token')));
    assert.equal(JSON.stringify(await settings(query)).includes('NAO_PERSISTIR'),false);
    await assert.rejects(applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:'0'.repeat(64)}),/PREVIA_DIVERGENTE/);
    assert.deepEqual(await sources(query),beforeSources);
    assert.equal((await planClientReconciliation(db)).previewHash,proof.previewHash);
    const result=await applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:proof.previewHash});
    assert.equal(result.updatedSources,2);assert.equal(result.commercialChanges,0);assert.equal(result.geographyPublished,false);
    assert.deepEqual(await events(query),beforeEvents);
    const after=await sources(query);
    for(let i=0;i<after.length;i++){
      assert.equal(after[i].payload.codigo_cliente,spec.newCustomer);
      const {client_reconciliation:_marker,...payload}=after[i].payload;
      assert.deepEqual(payload,{...beforeSources[i].payload,codigo_cliente:spec.newCustomer});
    }
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[checkpoint])).rows.length,0);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[`${casePrefix}:archive:${checkpoint}`])).rows[0].value.fingerprint,'historical');
    assert.equal((await query("SELECT value FROM application_settings WHERE key='location_service_evidence:2025-11:other'")).rows[0].value.untouched,true);
    assert.equal((await query("SELECT value FROM application_settings WHERE key='hubsoft_history_protocol:old:215431'")).rows[0].value.record.codigo_cliente,'8211');
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[budgetKey])).rows[0].value.used,916);
    assert.equal((await applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:proof.previewHash})).updatedSources,0);
    assert.equal((await planClientReconciliation(db)).state,'already_applied');
    // The ordinary strict repair can now validate this exact customer/service without an exception flag.
    const capture=await captureServiceLocations(db,api,spec.scope,{env});assert.equal(capture.captured,1);
    assert.equal((await planServiceLocations(db,spec.scope)).readyForReview,1);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[budgetKey])).rows[0].value.used,918);
  }finally{await pg.close();}
});

test('retorno divergente, exclusao, outra OS/execucao/servico, listagem ausente e 429 nao geram prova nem alteram fonte',async()=>{
  const {db,query,pg}=await database();
  try{
    const before=await sources(query),commercial=await events(query);
    const samples=[
      {detail:{...fresh(),id_atendimento:'215432'}},
      {detail:{...fresh(),protocolo:'999'}},
      {detail:{...fresh(),cliente:{codigo_cliente:'14927'}}},
      {detail:{...fresh(),data_cadastro:'10/12/2025'}},
      {detail:{...fresh(),deleted_at:'2026-11-24'}},
      {detail:{...fresh(),ordens_servico:[{...fresh().ordens_servico[0],id_ordem_servico:'47912'}]}},
      {detail:{...fresh(),ordens_servico:[{...fresh().ordens_servico[0],tipo:'SUPORTE'}]}},
      {detail:{...fresh(),ordens_servico:[{...fresh().ordens_servico[0],data_termino_executado:'12/12/2025 14:53:34'}]}},
      {detail:{...fresh(),ordens_servico:[{...fresh().ordens_servico[0],servico:{id_cliente_servico:'22710'}}]}},
      {detail:{...fresh(),ordens_servico:[{...fresh().ordens_servico[0],servico:undefined}]}},
      {list:[]}, {list:[listed(),listed()]},
      {list:[{...listed(),codigo_cliente:'8211',cliente_servico:{cliente:{codigo_cliente:'8211'}}}]},
      {list:[{...listed(),deleted_at:'2026-11-24'}]}, {failList:true}
    ];
    for(const sample of samples){
      const {api,gate}=client(sample);
      await assert.rejects(captureClientReconciliation(db,api,{env}));assert.equal(api.gate,gate);
      assert.deepEqual(await sources(query),before);assert.deepEqual(await events(query),commercial);
      assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_client_reconciliation:%'")).rows[0].n,0);
    }
    assert.ok((await query('SELECT value FROM application_settings WHERE key=$1',[budgetKey])).rows[0].value.used>0);
  }finally{await pg.close();}
});

test('orcamento e lock do coletor sao compartilhados e nenhuma chamada ocorre sem coordenacao ou verba',async()=>{
  const {db,query,pg,busy}=await database();const {api,calls}=client();
  try{
    await assert.rejects(captureClientReconciliation(db,api,{env:{...env,HUBSOFT_HISTORY_IP_COORDINATED:'false'}}),/GATE/);
    busy(true);await assert.rejects(captureClientReconciliation(db,api,{env}),/SINCRONIZACAO/);busy(false);
    for(const used of [1497,1500,1501,-1]){
      await query('INSERT INTO application_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[budgetKey,{used}]);
      await assert.rejects(captureClientReconciliation(db,api,{env}),/ORCAMENTO/);
    }
    assert.equal(calls.length,0);
  }finally{await pg.close();}
});

test('fonte/checkpoint alterado, prova adulterada ou expirada e hash antigo impedem apply',async()=>{
  const {db,query,pg}=await database();const {api}=client();
  try{
    const proof=await captureClientReconciliation(db,api,{env});
    const original=(await query('SELECT value FROM application_settings WHERE key=$1',[proof.proofKey])).rows[0].value;
    for(const patch of [{serviceId:'22710'},{newCustomer:'14927'},{observedAt:'2000-01-01T00:00:00Z'},{sourceFingerprint:'invalid'},{detailVerified:false}]){
      await query('UPDATE application_settings SET value=$2 WHERE key=$1',[proof.proofKey,{...original,...patch}]);
      await assert.rejects(applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:proof.previewHash}),/PROVA/);
    }
    await query('UPDATE application_settings SET value=$2 WHERE key=$1',[proof.proofKey,original]);
    await query("INSERT INTO application_settings(key,value) VALUES('location_service_pending:2025-12:hubsoft:47911','{}')");
    await assert.rejects(applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:proof.previewHash}),/PROVA/);
    assert.equal((await sources(query))[0].payload.codigo_cliente,spec.oldCustomer);
    assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE '%:archive:%'")).rows[0].n,0);
  }finally{await pg.close();}
});

test('mudanca colateral em detalhes de cancelamento bloqueia a reconciliacao antes de HTTP',async()=>{
  const {db,query,pg}=await database();const {api,calls}=client();
  try{
    await upsertRows(db,'attendance',[normalized('attendance',{...attendance,id_atendimento:'999',protocolo:'999',data_cadastro:'13/12/2025',
      tipo_atendimento:'CANCELAMENTO',descricao_abertura:'Cancelamento realizado.',descricao_fechamento:'Contrato cancelado.',data_fechamento:'13/12/2025'})],'hubsoft');
    await rebuild(db);
    const before=await events(query);
    await assert.rejects(captureClientReconciliation(db,api,{env}),/ALTERARIA_INDICADORES/);
    assert.equal(calls.length,0);assert.deepEqual(await events(query),before);
  }finally{await pg.close();}
});

test('falha na auditoria reverte fontes e arquivamento; importacao futura nao pode desfazer cliente reconciliado',async()=>{
  const {db,query,pg}=await database();const {api}=client();
  try{
    const proof=await captureClientReconciliation(db,api,{env});const before=await sources(query);
    const broken={connect:async()=>({release(){},query:(sql,args)=>sql.startsWith('INSERT INTO application_settings')&&args?.[0]===`${casePrefix}:applied`?Promise.reject(new Error('SIMULATED_AUDIT_FAILURE')):query(sql,args)})};
    await assert.rejects(applyClientReconciliation(broken,{acceptClientChange:true,expectedPreview:proof.previewHash}),/SIMULATED/);
    assert.deepEqual(await sources(query),before);
    await applyClientReconciliation(db,{acceptClientChange:true,expectedPreview:proof.previewHash});
    await assert.rejects(upsertRows(db,'attendance',[normalized('attendance',attendance)],'hubsoft'),/CLIENTE_RECONCILIADO_DIVERGENTE/);
    await upsertRows(db,'attendance',[normalized('attendance',{...attendance,codigo_cliente:spec.newCustomer})],'hubsoft');
    assert.equal((await query("SELECT payload FROM source_records WHERE kind='attendance'")).rows[0].payload.client_reconciliation.newCustomer,spec.newCustomer);
    await assert.rejects(upsertRows(db,'attendance',[normalized('attendance',attendance)],'hubsoft'),/CLIENTE_RECONCILIADO_DIVERGENTE/);
  }finally{await pg.close();}
});

test('CLI nao aceita IDs arbitrarios, outras flags ou aplicacao sem previa antes de importar banco',()=>{
  for(const args of [['capture','213646'],['plan','--all-events'],['apply'],['apply','--accept-client-change'],['apply','--accept-client-change','--expect-preview','fake']]){
    const result=spawnSync(process.execPath,['server/jobs/reconcile-location-client.mjs',...args],{cwd:new URL('../..',import.meta.url),encoding:'utf8',env:{...process.env,DATABASE_URL:'invalid'}});
    assert.equal(result.status,1);assert.match(result.stderr,/COMANDO_INVALIDO|RECONCILIACAO_PREVIA_OBRIGATORIA/);assert.doesNotMatch(result.stderr,/DATABASE|ECONN/);
  }
});
