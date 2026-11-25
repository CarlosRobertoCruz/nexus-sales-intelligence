import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {HubsoftClient} from '../hubsoft.mjs';
import {normalized} from '../historyNormalization.mjs';
import {upsertRows,rebuild} from '../records.mjs';
import {planServiceLocations,captureServiceLocations,applyServiceLocations,planServiceEvidenceRefresh,archiveStaleServiceEvidence} from '../locationServiceRepair.mjs';

process.env.TZ='America/Sao_Paulo';
const scope='2025-11,2025-12',eventId='renewal:protocolo:20251211172356164035',selection={kind:'renewals',eventId};
const activeKey=`location_service_evidence:2025-12:renewals:${eventId}`;
const identityKey=`location_service_identity:2025-12:renewals:${eventId}`;
const budgetKey=`location_service_budget:v1:${scope}`;
const attendance={id_atendimento:'215627',protocolo:'20251211172356164035',codigo_cliente:'4849',nome_razaosocial:'Ficticio',
  data_cadastro:'11/12/2025',usuario_abertura:'Beatriz',descricao_abertura:'Renovação 600 Mega Combo Plus',tipo_atendimento:'RENOVAÇÃO DE CONTRATO',status:'Resolvido'};
const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'fake',HUBSOFT_CLIENT_SECRET:'fake',HUBSOFT_USERNAME:'fake',HUBSOFT_PASSWORD:'fake',HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_AUTOMATIC_ENABLED:'true'};
function client({customer='4849',service='99'}={}){
  const calls=[];let token;
  const gate={interval:1000,token:async work=>token??(token=await work()),invalidateToken:async()=>{token=null;},perform:async(meta,send)=>{
    const response=await send();if(response.error)throw response.error;return response.data;
  }};
  const api=new HubsoftClient(env,async(url,request)=>{
    const u=new URL(url);calls.push({method:request.method,url:u});
    if(u.pathname==='/oauth/token')return Response.json({access_token:'NAO_PERSISTIR',expires_in:3600});
    if(u.pathname.endsWith('/cliente/atendimento'))return Response.json({atendimentos:[{...attendance,codigo_cliente:customer,servico:{id_cliente_servico:service,senha:'NAO_PERSISTIR'}}]});
    if(u.pathname.endsWith('/cliente'))return Response.json({clientes:[{codigo_cliente:customer,servicos:[{id_cliente_servico:service,endereco_instalacao:{bairro:'Muriqui',cidade:'Mangaratiba'}}]}]});
    throw new Error('Unexpected route');
  },async()=>{},gate);
  return {api,calls};
}
async function database({stale=true}={}){
  const pg=new PGlite();
  for(const name of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql'])await pg.exec(await readFile(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
  let busy=false;
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:!busy}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await upsertRows(db,'attendance',[normalized('attendance',attendance)],'hubsoft');
  await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',{
    id_ordem_servico:'1',numero_ordem_servico:'1',id_atendimento:'999',codigo_cliente:'999',nome_razaosocial:'Outro ficticio',
    tipo:'SUPORTE',status:'Finalizado',data_inicio_programado:'11/12/2025 09:00:00',data_inicio_executado:'11/12/2025 09:00:00',data_termino_executado:'11/12/2025 10:00:00'
  }),data_referencia_bi:'data_termino_executado'}],'hubsoft');
  await rebuild(db);
  await captureServiceLocations(db,client().api,scope,{allEvents:true,env});
  await query('UPDATE application_settings SET value=$2 WHERE key=$1',[budgetKey,{used:1033,maximum:1500}]);
  if(stale)await query(`UPDATE source_records SET payload=payload||'{"revision_tag":"current"}'::jsonb WHERE kind='attendance'`);
  return {pg,db,query,busy:v=>{busy=v;}};
}
const settings=async q=>(await q('SELECT key,value FROM application_settings ORDER BY key')).rows;
const sources=async q=>(await q('SELECT * FROM source_records ORDER BY kind,id')).rows;
const events=async q=>(await q('SELECT * FROM commercial_records ORDER BY kind,id')).rows;

test('previa e arquivamento sao locais, preservam valores/orcamento/outros casos e exigem recaptura estrita',async()=>{
  const {db,query,pg}=await database();const {api,calls}=client();
  try{
    await query("INSERT INTO application_settings(key,value) VALUES('location_service_evidence:2025-11:other','{\"keep\":true}')");
    await query("INSERT INTO application_settings(key,value) VALUES('hubsoft_history_protocol:old:215627','{\"keep\":true}')");
    const beforeSources=await sources(query),beforeEvents=await events(query);
    const old=(await query('SELECT key,value FROM application_settings WHERE key=ANY($1::text[]) ORDER BY key',[[activeKey,identityKey]])).rows;
    assert.equal((await planServiceLocations(db,scope,{allEvents:true})).invalidEvidenceOrSource,1);
    await assert.rejects(captureServiceLocations(db,api,scope,{allEvents:true,env}),/EVIDENCIA_DIVERGENTE/);assert.equal(calls.length,0);
    const plan=await planServiceEvidenceRefresh(db,scope,selection);
    assert.equal(plan.attendanceId,'215627');assert.equal(plan.customer,'4849');assert.equal(plan.serviceId,'99');
    assert.equal(plan.state,'stale_evidence');assert.equal(plan.checkpointsToArchive,2);assert.notEqual(plan.currentFingerprint,plan.previousFingerprint);
    assert.equal(plan.requiresFreshCapture,true);assert.equal(plan.published,false);
    const result=await archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash});
    assert.equal(result.state,'needs_fresh_capture');assert.equal(result.archivedCheckpoints,2);assert.equal(result.budgetUnchanged,true);
    assert.deepEqual(await sources(query),beforeSources);assert.deepEqual(await events(query),beforeEvents);
    for(const row of old){
      assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[row.key])).rows.length,0);
      assert.deepEqual((await query('SELECT value FROM application_settings WHERE key=$1',[`${result.auditKey}:checkpoint:${row.key}`])).rows[0].value,row.value);
    }
    for(const name of ['location_service_evidence:2025-11:other','hubsoft_history_protocol:old:215627'])
      assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[name])).rows[0].value.keep,true);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[budgetKey])).rows[0].value.used,1033);
    const pending=await planServiceLocations(db,scope,{allEvents:true});assert.equal(pending.invalidEvidenceOrSource,0);assert.equal(pending.uncaptured,1);assert.equal(pending.readyForReview,0);
    assert.equal(calls.length,0);
    const fresh=await captureServiceLocations(db,api,scope,{allEvents:true,env});assert.equal(fresh.captured,1);assert.equal(fresh.callsReserved,1036);
    const current=(await query('SELECT value FROM application_settings WHERE key=$1',[activeKey])).rows[0].value;
    assert.equal(current.fingerprint,plan.currentFingerprint);
    assert.equal((await archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash})).archivedCheckpoints,0);
    assert.deepEqual((await query('SELECT value FROM application_settings WHERE key=$1',[activeKey])).rows[0].value,current);
    assert.equal((await planServiceLocations(db,scope,{allEvents:true})).readyForReview,1);
    const applied=await applyServiceLocations(db,scope,{allEvents:true,acceptCurrentServiceAddress:true});assert.equal(applied.updatedRenewals,1);
    const after=await events(query);
    for(let i=0;i<after.length;i++){
      const {location:_before,...payloadBefore}=beforeEvents[i].payload;
      const {location:_after,...payloadAfter}=after[i].payload;
      assert.deepEqual(payloadAfter,payloadBefore);assert.equal(after[i].event_date.getTime(),beforeEvents[i].event_date.getTime());
    }
    const audit=(await query('SELECT value FROM application_settings WHERE key=$1',[result.auditKey])).rows[0].value;
    assert.equal(JSON.stringify(audit).includes('Ficticio'),false);assert.equal(JSON.stringify(audit).includes('NAO_PERSISTIR'),false);
  }finally{await pg.close();}
});

test('mudanca de fonte/checkpoint depois da previa, falta de aceite e hash errado nao arquivam nada',async()=>{
  const {db,query,pg}=await database();
  try{
    const plan=await planServiceEvidenceRefresh(db,scope,selection);
    const before=await settings(query);
    await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,expectedPreview:plan.previewHash}),/ACEITE/);
    await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true}),/PREVIA/);
    await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:'0'.repeat(64)}),/PREVIA_DIVERGENTE/);
    assert.deepEqual(await settings(query),before);
    await query(`UPDATE source_records SET payload=payload||'{"revision_tag":"newer"}'::jsonb WHERE kind='attendance'`);
    await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash}),/PREVIA_DIVERGENTE/);
    assert.deepEqual(await settings(query),before);
    const newPlan=await planServiceEvidenceRefresh(db,scope,selection);
    await query(`UPDATE application_settings SET value=value||'{"observedAt":"2026-01-01T00:00:00Z"}'::jsonb WHERE key=$1`,[identityKey]);
    const changed=await settings(query);
    await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:newPlan.previewHash}),/PREVIA_DIVERGENTE/);
    assert.deepEqual(await settings(query),changed);
  }finally{await pg.close();}
});

test('fonte invalida, servico conflitante, pendencia concorrente e evidencia adulterada permanecem bloqueados',async()=>{
  const {db,query,pg}=await database();
  try{
    const a=(await query("SELECT payload FROM source_records WHERE kind='attendance'")).rows[0].payload;
    const e=(await query('SELECT value FROM application_settings WHERE key=$1',[activeKey])).rows[0].value;
    for(const patch of [{tipo_atendimento:'SUPORTE'},{deleted_at:'2026-11-25'},{id_cliente_servico:'100'}]){
      await query("UPDATE source_records SET payload=$1 WHERE kind='attendance'",[{...a,...patch}]);
      await assert.rejects(planServiceEvidenceRefresh(db,scope,selection));
    }
    await query("UPDATE source_records SET payload=$1 WHERE kind='attendance'",[a]);
    for(const patch of [{version:2},{source:'unknown'},{fingerprint:'invalid'},{observedAt:'invalid'},{id_cliente_servico:''}]){
      await query('UPDATE application_settings SET value=$2 WHERE key=$1',[activeKey,{...e,...patch}]);
      await assert.rejects(planServiceEvidenceRefresh(db,scope,selection));
    }
    await query('UPDATE application_settings SET value=$2 WHERE key=$1',[activeKey,e]);
    const pending=`location_service_pending:2025-12:renewals:${eventId}`;
    await query('INSERT INTO application_settings(key,value) VALUES($1,$2)',[pending,{code:'LOCALIDADE_CLIENTE_DIVERGENTE'}]);
    await assert.rejects(planServiceEvidenceRefresh(db,scope,selection),/PENDENCIA/);
    assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_service_evidence_archive:%'")).rows[0].n,0);
  }finally{await pg.close();}
});

test('falha ao gravar auditoria reverte renomeacoes; lock impede concorrencia',async()=>{
  const {db,query,pg,busy}=await database();
  try{
    const plan=await planServiceEvidenceRefresh(db,scope,selection),before=await settings(query);
    busy(true);await assert.rejects(archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash}),/SINCRONIZACAO/);busy(false);
    const broken={connect:async()=>({release(){},query:(sql,args)=>sql.startsWith('INSERT INTO application_settings')&&args?.[0]?.startsWith('location_service_evidence_archive:')?Promise.reject(new Error('SIMULATED_AUDIT_FAILURE')):query(sql,args)})};
    await assert.rejects(archiveStaleServiceEvidence(broken,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash}),/SIMULATED/);
    assert.deepEqual(await settings(query),before);
  }finally{await pg.close();}
});

test('cache atual nao e arquivado e recaptura apos arquivo continua recusando outro cliente',async()=>{
  const {db,query,pg}=await database({stale:false});
  try{
    await assert.rejects(planServiceEvidenceRefresh(db,scope,selection),/JA_ATUAL/);
    await query(`UPDATE source_records SET payload=payload||'{"revision_tag":"new"}'::jsonb WHERE kind='attendance'`);
    const plan=await planServiceEvidenceRefresh(db,scope,selection);
    await archiveStaleServiceEvidence(db,scope,{...selection,acceptArchive:true,expectedPreview:plan.previewHash});
    const before=await sources(query),commercial=await events(query);
    await assert.rejects(captureServiceLocations(db,client({customer:'4850'}).api,scope,{allEvents:true,env}),/CLIENTE_DIVERGENTE/);
    const different=client({service:'100'});
    await assert.rejects(captureServiceLocations(db,different.api,scope,{allEvents:true,env}),/SERVICO_DIVERGENTE/);
    assert.equal(different.calls.filter(c=>c.url.pathname.endsWith('/cliente')).length,0);
    await assert.rejects(captureServiceLocations(db,client({customer:'4850',service:'100'}).api,scope,
      {allEvents:true,deferClientConflicts:true,env}),/SERVICO_DIVERGENTE/);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[
      `location_service_pending:2025-12:renewals:${eventId}`
    ])).rows.length,0);
    assert.deepEqual(await sources(query),before);assert.deepEqual(await events(query),commercial);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[activeKey])).rows.length,0);
    assert.equal((await query('SELECT value FROM application_settings WHERE key=$1',[`${'location_service_evidence_archive:v1:'+plan.previewHash}:checkpoint:${activeKey}`])).rows.length,1);
  }finally{await pg.close();}
});

test('CLI rejeita selecao aberta e arquivamento sem hash antes de importar o banco',()=>{
  const cases=[['plan-refresh',scope],['plan-refresh',scope,'all',eventId],['plan-refresh','2024-01','renewals',eventId],
    ['plan-refresh',scope,'renewals',eventId,'--all-events'],['archive-stale',scope,'renewals',eventId],
    ['archive-stale',scope,'renewals',eventId,'--accept-archive','--expect-preview','fake']];
  for(const args of cases){
    const result=spawnSync(process.execPath,['server/jobs/repair-service-locations.mjs',...args],{cwd:new URL('../..',import.meta.url),encoding:'utf8',env:{...process.env,DATABASE_URL:'invalid'}});
    assert.equal(result.status,1);assert.doesNotMatch(result.stderr,/DATABASE|ECONN/);
    assert.match(result.stderr,/COMANDO_INVALIDO|LOCALIDADE_|MESES_LOCALIZACAO_INVALIDOS/);
  }
});
