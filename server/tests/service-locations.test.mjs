import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {HubsoftClient} from '../hubsoft.mjs';
import {serviceIdentity} from '../locationFields.mjs';
import {projectHistoryRecord} from '../historyProjection.mjs';
import {normalized} from '../historyNormalization.mjs';
import {upsertRows,rebuild} from '../records.mjs';
import {planServiceLocations,captureServiceLocations,applyServiceLocations} from '../locationServiceRepair.mjs';

const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'fake',HUBSOFT_CLIENT_SECRET:'fake',HUBSOFT_USERNAME:'fake',HUBSOFT_PASSWORD:'fake',
  HUBSOFT_HISTORY_IP_COORDINATED:'true',HUBSOFT_AUTOMATIC_ENABLED:'true'};
const attendance={id_atendimento:'101',protocolo:'202610010001',codigo_cliente:'12',cliente:{codigo_cliente:'12',nome_razaosocial:'Ficticio'},
  nome_razaosocial:'Ficticio',data_cadastro:'01/10/2026',usuario_abertura:'Beatriz',descricao_abertura:'Instalação 600 Mega Combo Plus',tipo_atendimento:'INSTALAÇÃO',status:'Resolvido'};
const order={id_ordem_servico:'201',numero_ordem_servico:'301',id_atendimento:'101',codigo_cliente:'12',cliente:attendance.cliente,tipo:'INSTALAÇÃO',status:'Finalizado',
  data_inicio_programado:'02/10/2026 09:00:00',data_inicio_executado:'02/10/2026 09:00:00',data_termino_executado:'02/10/2026 10:00:00'};
const detail=()=>({...attendance,servico:{id_cliente_servico:'99',senha:'NAO_PERSISTIR'},ordens_servico:[{...order,servico:{id_cliente_servico:'99'}}]});
const services=()=>[{id_cliente_servico:'88',endereco_instalacao:{bairro:'Ibicuí',cidade:'Mangaratiba'}},
  {id_cliente_servico:'99',senha:'NAO_PERSISTIR',endereco_cobranca:{bairro:'NAO_USAR'},endereco_instalacao:{bairro:'Cachoeira',cidade:'Mangaratiba',completo:'NAO_PERSISTIR'}}];
function client(response={}) {
  const calls=[];let token;
  const gate={interval:1000,token:async work=>token??(token=await work()),invalidateToken:async()=>{token=null;},perform:async(meta,send)=>{
    const result=await send();if(result.status===429)throw Object.assign(new Error('HUBSOFT_LIMITE_AGUARDE'),{code:'HUBSOFT_LIMITE_AGUARDE'});
    if(result.error)throw result.error;return result.data;
  }};
  const api=new HubsoftClient(env,async(url,options)=>{
    const u=new URL(url);calls.push({url:u,method:options.method,redirect:options.redirect});
    if(u.pathname==='/oauth/token')return Response.json({access_token:'fake-token',expires_in:3600});
    if(u.pathname.endsWith('/cliente/atendimento'))return Response.json({atendimentos:[response.details?.[u.searchParams.get('termo_busca')]??response.detail??detail()]});
    if(u.pathname.endsWith('/cliente')) {
      if(response.failClientOnce){response.failClientOnce=false;return Response.json({}, {status:429});}
      const cancelled=u.searchParams.get('cancelado')==='sim';
      if(response.inactiveClient&&u.searchParams.get('inativo')!=='todos')return Response.json({clientes:[]});
      if(response.failCancelledOnce&&cancelled){response.failCancelledOnce=false;return Response.json({}, {status:429});}
      // Model the real API: installation addresses are an explicitly requested relation.
      const includeAddress=u.searchParams.get('relacoes')==='endereco_instalacao';
      if(!includeAddress)return Response.json({clientes:[{codigo_cliente:'12',servicos:services().map(({endereco_instalacao:_address,...service})=>service)}]});
      if(response.omitAddressOnce){response.omitAddressOnce=false;return Response.json({clientes:[{codigo_cliente:'12',servicos:services().map(({endereco_instalacao:_address,...service})=>service)}]});}
      if(response.emptyActive&&!cancelled)return Response.json({clientes:[]});
      return Response.json({clientes:[{codigo_cliente:response.clientCode??'12',senha:'NAO_PERSISTIR',servicos:cancelled?(response.cancelled??services()):(response.services??services())}]});
    }
    throw new Error('Unexpected route');
  },async()=>{},gate);
  return {api,calls,gate};
}
async function database() {
  const pg=new PGlite();
  for(const name of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql'])await pg.exec(await readFile(new URL('../../database/migrations/'+name,import.meta.url),'utf8'));
  let busy=false;
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:!busy}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await upsertRows(db,'attendance',[normalized('attendance',attendance)],'hubsoft');
  await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order),data_referencia_bi:'data_termino_executado'}],'hubsoft');
  await rebuild(db);
  return {db,query,pg,busy:value=>{busy=value;}};
}
const rows=async query=>(await query('SELECT kind,id,event_date,payload FROM commercial_records ORDER BY kind,id')).rows;
const nonGeo=values=>values.map(row=>{const {location:_location,...payload}=row.payload;return {...row,payload};});

test('servico.id_cliente_servico documentado e preservado sem credenciais e IDs divergentes sao recusados',()=>{
  assert.equal(serviceIdentity(detail()),'99');
  assert.equal(projectHistoryRecord(detail()).id_cliente_servico,'99');
  assert.equal(JSON.stringify(projectHistoryRecord(detail())).includes('NAO_PERSISTIR'),false);
  assert.throws(()=>serviceIdentity({id_cliente_servico:'98',servico:{id_cliente_servico:'99'}}),/HUBSOFT_SERVICO_DIVERGENTE/);
  assert.throws(()=>serviceIdentity({servico:{id_cliente_servico:9007199254740992}}),/IDENTIFICADOR_INVALIDO/);
});

test('consulta cliente usa codigo exato, limit=1, sem redirects e retorna somente geografia da instalacao',async()=>{
  const {api,calls}=client();
  const result=await api.clientInstallationServices('12');
  assert.deepEqual(result[1],{id_cliente_servico:'99',bairro:'Cachoeira',cidade:'Mangaratiba'});
  assert.equal(JSON.stringify(result).includes('NAO_PERSISTIR'),false);
  const request=calls.find(call=>call.url.pathname.endsWith('/cliente'));
  assert.equal(request.method,'GET');assert.equal(request.redirect,'error');
  assert.equal(request.url.searchParams.get('busca'),'codigo_cliente');assert.equal(request.url.searchParams.get('termo_busca'),'12');
  assert.equal(request.url.searchParams.get('limit'),'1');assert.equal(request.url.searchParams.get('ultima_conexao'),'nao');
  assert.equal(request.url.searchParams.get('incluir_contrato'),'nao');
  assert.equal(request.url.searchParams.get('relacoes'),'endereco_instalacao');
  assert.equal(request.url.searchParams.get('inativo'),'todos');
  await assert.rejects(api.clientInstallationServices('nome'),/CLIENTE_INVALIDO/);
  await assert.rejects(api.request('POST','/api/v1/integracao/cliente',{}),/BLOQUEADO/);
});

test('captura exata nao publica; apply exige ciencia do endereco atual, preserva totais e e idempotente',async()=>{
  const {db,query,pg}=await database();const {api,calls,gate}=client();
  try {
    const before=await rows(query),sources=(await query('SELECT * FROM source_records ORDER BY kind,id')).rows;
    const plan=await planServiceLocations(db,'2026-10');assert.equal(plan.missingSales,1);assert.equal(plan.readyForReview,0);
    assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_service_%'")).rows[0].n,0);
    const capture=await captureServiceLocations(db,api,'2026-10',{env});
    assert.equal(capture.captured,1);assert.equal(capture.callsThisRun,3);assert.equal(api.gate,gate);
    assert.deepEqual(await rows(query),before);assert.deepEqual((await query('SELECT * FROM source_records ORDER BY kind,id')).rows,sources);
    const cache=(await query("SELECT value FROM application_settings WHERE key LIKE 'location_service_%'")).rows;
    assert.equal(JSON.stringify(cache).includes('NAO_PERSISTIR'),false);
    const reviewed=await planServiceLocations(db,'2026-10');assert.equal(reviewed.readyForReview,1);
    assert.deepEqual(reviewed.readyByLocation,[{location:'Muriqui',sales:1}]);
    const count=calls.length;assert.equal((await captureServiceLocations(db,api,'2026-10',{env})).reused,1);assert.equal(calls.length,count);
    await assert.rejects(applyServiceLocations(db,'2026-10'),/REVISAO_ENDERECO_ATUAL/);
    const applied=await applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true});assert.equal(applied.updatedSales,1);
    assert.deepEqual(nonGeo(await rows(query)),nonGeo(before));
    assert.equal((await rows(query)).find(row=>row.kind==='sales').payload.location,'Muriqui');
    const source=(await query("SELECT payload FROM source_records WHERE kind='serviceOrders'")).rows[0].payload;
    assert.equal(source.id_cliente_servico,'99');assert.equal(source.location_recovery.source,'hubsoft_exact_service_current_installation_address');
    assert.equal((await query('SELECT count(*)::int AS n FROM source_records')).rows[0].n,2);
    assert.equal((await applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true})).updatedSales,0);
  }finally{await pg.close();}
});

test('servico cancelado usa consulta limitada propria e nao escolhe primeiro servico do cliente',async()=>{
  const {db,query,pg}=await database();const {api,calls}=client({services:[services()[0]]});
  try {
    const result=await captureServiceLocations(db,api,'2026-10',{env});assert.equal(result.captured,1);assert.equal(result.callsThisRun,4);
    assert.deepEqual(calls.filter(call=>call.url.pathname.endsWith('/cliente')).map(call=>call.url.searchParams.get('cancelado')),['nao','sim']);
    const evidence=(await query("SELECT value FROM application_settings WHERE key LIKE 'location_service_evidence:%'")).rows[0].value;
    assert.equal(evidence.id_cliente_servico,'99');assert.equal(evidence.bairro,'Cachoeira');
  }finally{await pg.close();}
});

test('cliente/protocolo/OS/execucao/servico divergentes e endereco ausente nao sao associados',async()=>{
  const {db,query,pg}=await database();
  try {
    const samples=[
      {detail:{...detail(),protocolo:'999'}},
      {detail:{...detail(),cliente:{codigo_cliente:'98'}}},
      {detail:{...detail(),ordens_servico:[{...order,id_ordem_servico:'202'}]}},
      {detail:{...detail(),ordens_servico:[{...order,tipo:'SUPORTE'}]}},
      {detail:{...detail(),ordens_servico:[{...order,data_termino_executado:'02/10/2026 11:00:00'}]}},
      {detail:{...detail(),ordens_servico:[{...order,servico:{id_cliente_servico:'98'}}]}},
      {clientCode:'98'},
      {services:[{id_cliente_servico:'99',endereco_cobranca:{bairro:'Muriqui'}}]},
      {services:[{id_cliente_servico:'99'},{id_cliente_servico:'99'}]},
    ];
    for(const response of samples) {
      await query("DELETE FROM application_settings WHERE key LIKE 'location_service_%'");
      const {api}=client(response);
      await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}));
      assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_service_evidence:%'")).rows[0].n,0);
    }
  }finally{await pg.close();}
});

test('429 preserva checkpoint de identidade, restaura gate e retomada nao repete protocolo',async()=>{
  const {db,pg}=await database();const {api,calls,gate}=client({failClientOnce:true});
  try {
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/HUBSOFT_LIMITE_AGUARDE/);assert.equal(api.gate,gate);
    await captureServiceLocations(db,api,'2026-10',{env});
    assert.equal(calls.filter(call=>call.url.pathname.endsWith('/cliente/atendimento')).length,1);
  }finally{await pg.close();}
});

test('gate compartilhado, teto persistido, escopo, fonte alterada e limite por execucao sao respeitados',async()=>{
  const {db,query,pg,busy}=await database();const {api,calls}=client();
  try {
    busy(true);await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/SINCRONIZACAO_EM_ANDAMENTO/);assert.equal(calls.length,0);busy(false);
    await assert.rejects(captureServiceLocations(db,api,'2024-10',{env}));
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env,maxCalls:101}));
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env:{...env,HUBSOFT_HISTORY_IP_COORDINATED:'false'}}));
    await query("INSERT INTO application_settings(key,value) VALUES('location_service_budget:v1:2026-10','{\"used\":500}')");
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/ORCAMENTO_ATINGIDO/);assert.equal(calls.length,0);
    await query("DELETE FROM application_settings WHERE key LIKE 'location_service_%'");
    await captureServiceLocations(db,api,'2026-10',{env});
    await query(`UPDATE source_records SET payload=jsonb_set(payload,'{codigo_cliente}','"98"') WHERE kind='serviceOrders'`);
    const before=await rows(query);await assert.rejects(applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true}),/VINCULO_DIVERGENTE/);
    assert.deepEqual(await rows(query),before);
  }finally{await pg.close();}
});

test('timestamps ISO equivalentes e preservacao da precisao original da OS sao aceitos',async()=>{
  const {db,pg}=await database();const {api}=client({detail:{...detail(),ordens_servico:[{...order,data_inicio_executado:'2026-10-02T12:00:00Z',data_termino_executado:'2026-10-02T13:00:00Z'}]}});
  try {assert.equal((await captureServiceLocations(db,api,'2026-10',{env})).captured,1);}finally{await pg.close();}
});

test('cliente sem servico ativo pode ser encontrado no filtro de cancelados',async()=>{
  const {db,pg}=await database();const {api}=client({emptyActive:true});
  try{assert.equal((await captureServiceLocations(db,api,'2026-10',{env})).captured,1);}finally{await pg.close();}
});

test('apply aborta integralmente quando uma cidade existente diverge da evidencia',async()=>{
  const {db,query,pg}=await database();const {api}=client();
  try {
    await query(`UPDATE source_records SET payload=jsonb_set(payload,'{cidade}','"Angra dos Reis"') WHERE kind='serviceOrders'`);
    await captureServiceLocations(db,api,'2026-10',{env});
    const before=await rows(query),sourceBefore=(await query('SELECT * FROM source_records ORDER BY kind,id')).rows;
    await assert.rejects(applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true}),/CIDADE_EXISTENTE_DIVERGENTE/);
    assert.deepEqual(await rows(query),before);assert.deepEqual((await query('SELECT * FROM source_records ORDER BY kind,id')).rows,sourceBefore);
  }finally{await pg.close();}
});

test('nova sincronizacao sem geografia conserva evidencia somente para a mesma OS/cliente/servico/execucao',async()=>{
  const {db,query,pg}=await database();const {api}=client();
  try {
    await captureServiceLocations(db,api,'2026-10',{env});
    await applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true});
    await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order),data_referencia_bi:'data_termino_executado'}],'hubsoft');
    await rebuild(db);
    assert.equal((await rows(query)).find(row=>row.kind==='sales').payload.location,'Muriqui');
    let source=(await query("SELECT payload FROM source_records WHERE kind='serviceOrders'")).rows[0].payload;
    assert.equal(source.id_cliente_servico,'99');assert.ok(source.location_recovery);
    await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',{...order,servico:{id_cliente_servico:'98'}}),data_referencia_bi:'data_termino_executado'}],'hubsoft');
    source=(await query("SELECT payload FROM source_records WHERE kind='serviceOrders'")).rows[0].payload;
    assert.equal(source.id_cliente_servico,'98');assert.equal(source.location_recovery,undefined);assert.equal(source.bairro,'');
  }finally{await pg.close();}
});


test('endereco omitido preserva identidade e retomada captura a relacao sem repetir protocolo',async()=>{
  const {db,query,pg}=await database();const {api,calls}=client({omitAddressOnce:true});
  try {
    const before=await rows(query);
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/LOCALIDADE_ENDERECO_NAO_RETORNADO/);
    assert.equal((await planServiceLocations(db,'2026-10')).readyForReview,0);
    assert.deepEqual(await rows(query),before);
    const result=await captureServiceLocations(db,api,'2026-10',{env});
    assert.equal(result.captured,1);assert.equal(result.callsThisRun,1);assert.equal(result.callsReserved,4);
    assert.equal(calls.filter(call=>call.url.pathname.endsWith('/cliente/atendimento')).length,1);
    assert.ok(calls.filter(call=>call.url.pathname.endsWith('/cliente')).every(call=>call.url.searchParams.get('relacoes')==='endereco_instalacao'));
    assert.deepEqual((await planServiceLocations(db,'2026-10')).readyByLocation,[{location:'Muriqui',sales:1}]);
    assert.deepEqual(await rows(query),before);
  }finally{await pg.close();}
});


test('cliente inativo com servico cancelado e incluido sem ampliar busca por codigo exato',async()=>{
  const {db,pg}=await database();const {api,calls}=client({inactiveClient:true,emptyActive:true});
  try {
    assert.equal((await captureServiceLocations(db,api,'2026-10',{env})).captured,1);
    const requests=calls.filter(call=>call.url.pathname.endsWith('/cliente'));
    assert.deepEqual(requests.map(call=>call.url.searchParams.get('cancelado')),['nao','sim']);
    assert.ok(requests.every(call=>call.url.searchParams.get('inativo')==='todos'&&call.url.searchParams.get('termo_busca')==='12'&&call.url.searchParams.get('limit')==='1'));
  }finally{await pg.close();}
});

async function secondSale(db) {
  const secondAttendance={...attendance,id_atendimento:'102',protocolo:'202610010002'};
  const secondOrder={...order,id_ordem_servico:'202',numero_ordem_servico:'302',id_atendimento:'102'};
  await upsertRows(db,'attendance',[normalized('attendance',secondAttendance)],'hubsoft');
  await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',secondOrder),data_referencia_bi:'data_termino_executado'}],'hubsoft');
  await rebuild(db);
  return {...secondAttendance,servico:{id_cliente_servico:'100'},ordens_servico:[{...secondOrder,servico:{id_cliente_servico:'100'}}]};
}

test('servico ausente fica pendente, demais vendas avancam e retomada nao repete consultas sem evidencia nova',async()=>{
  const {db,query,pg}=await database();
  try {
    const second=await secondSale(db);
    const response={details:{'202610010002':second},services:[{id_cliente_servico:'100',endereco_instalacao:{bairro:'Praia Grande',cidade:'Mangaratiba'}}],cancelled:[]};
    const {api,calls}=client(response),before=await rows(query);
    const result=await captureServiceLocations(db,api,'2026-10',{env,maxCalls:10});
    assert.equal(result.captured,1);assert.equal(result.unresolvedSales,1);assert.equal(result.callsThisRun,6);
    const plan=await planServiceLocations(db,'2026-10');
    assert.equal(plan.readyForReview,1);assert.equal(plan.unresolvedSales,1);assert.equal(plan.uncaptured,0);
    assert.deepEqual(plan.unresolvedByReason,[{code:'LOCALIDADE_SERVICO_NAO_ENCONTRADO',sales:1}]);
    assert.deepEqual(plan.readyByLocation,[{location:'Praia Grande',sales:1}]);
    assert.deepEqual(await rows(query),before);
    const count=calls.length;
    const repeated=await captureServiceLocations(db,api,'2026-10',{env,maxCalls:10});
    assert.equal(repeated.reused,1);assert.equal(repeated.unresolvedSales,1);assert.equal(repeated.callsThisRun,0);assert.equal(calls.length,count);
    const applied=await applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true});
    assert.equal(applied.updatedSales,1);assert.equal(applied.pendingSales,1);
    assert.deepEqual(nonGeo(await rows(query)),nonGeo(before));
    assert.equal((await rows(query)).find(row=>row.payload.id==='hubsoft:201'&&row.kind==='sales').payload.location,'Não informada');
  }finally{await pg.close();}
});

test('reconsulta explicita de pendente usa checkpoint e orcamento, encontra somente servico exato e limpa pendencia',async()=>{
  const {db,query,pg}=await database();const response={services:[services()[0]],cancelled:[]};const {api,calls}=client(response);
  try {
    const first=await captureServiceLocations(db,api,'2026-10',{env});
    assert.equal(first.unresolvedSales,1);assert.equal(first.callsReserved,4);
    response.services=services();
    const resumed=await captureServiceLocations(db,api,'2026-10',{env,retryUnresolved:true});
    assert.equal(resumed.captured,1);assert.equal(resumed.unresolvedSales,0);assert.equal(resumed.callsThisRun,1);assert.equal(resumed.callsReserved,5);
    assert.equal(calls.filter(call=>call.url.pathname.endsWith('/cliente/atendimento')).length,1);
    assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_service_pending:%'")).rows[0].n,0);
    assert.equal((await planServiceLocations(db,'2026-10')).readyForReview,1);
  }finally{await pg.close();}
});

test('miss legado sem clientes inativos nao impede reconsulta ativa com filtro novo',async()=>{
  const {db,query,pg}=await database();const response={emptyActive:true,failCancelledOnce:true};const {api,calls}=client(response);
  try {
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/HUBSOFT_LIMITE_AGUARDE/);
    await query("UPDATE application_settings SET value=value-'lookupVersion' WHERE key LIKE 'location_service_active_miss:%'");
    response.emptyActive=false;
    const count=calls.length;
    const resumed=await captureServiceLocations(db,api,'2026-10',{env});
    assert.equal(resumed.captured,1);assert.equal(resumed.callsThisRun,1);assert.equal(resumed.callsReserved,5);
    assert.equal(calls.slice(count).filter(call=>call.url.pathname.endsWith('/cliente'))[0].url.searchParams.get('cancelado'),'nao');
    assert.equal(calls.filter(call=>call.url.pathname.endsWith('/cliente/atendimento')).length,1);
  }finally{await pg.close();}
});

test('pendencia nao autoriza ignorar fonte alterada nem substituir servico por outro',async()=>{
  const {db,query,pg}=await database();const {api,calls}=client({services:[services()[0]],cancelled:[]});
  try {
    await captureServiceLocations(db,api,'2026-10',{env});
    const count=calls.length;
    await query("UPDATE source_records SET payload=payload||$1::jsonb WHERE kind='serviceOrders'",[JSON.stringify({id_cliente_servico:'77'})]);
    const plan=await planServiceLocations(db,'2026-10');assert.equal(plan.invalidEvidenceOrSource,1);
    await assert.rejects(captureServiceLocations(db,api,'2026-10',{env}),/LOCALIDADE_EVIDENCIA_DIVERGENTE/);
    assert.equal(calls.length,count);
    assert.equal((await applyServiceLocations(db,'2026-10',{acceptCurrentServiceAddress:true})).updatedSales,0);
  }finally{await pg.close();}
});
