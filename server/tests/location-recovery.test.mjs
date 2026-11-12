import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {repairLocations,locationRepairMonths} from '../locationRecovery.mjs';
import {normalized} from '../historyNormalization.mjs';
import {upsertRows,rebuild} from '../records.mjs';

const job='11111111-1111-4111-8111-111111111111';
const attendance={id_atendimento:'101',protocolo:'202510010001',data_cadastro:'01/10/2025',cliente:{codigo_cliente:'12',nome_razaosocial:'Ficticio'},
  codigo_cliente:'12',usuario_abertura:'Beatriz',descricao_abertura:'Instalação 600 Mega Combo Plus',tipo_atendimento:'INSTALAÇÃO',status:'Resolvido',id_cliente_servico:'77'};
const order={id_ordem_servico:'201',numero:'201',id_atendimento:'101',codigo_cliente:'12',cliente:attendance.cliente,tipo:'INSTALAÇÃO',status:'Finalizado',
  data_inicio_programado:'02/10/2025 09:00:00',data_inicio_executado:'02/10/2025 09:00:00',data_termino_executado:'02/10/2025 10:00:00'};
async function database() {
  const pg=new PGlite();
  for(const file of ['001_initial.sql','002_history.sql','003_attendance_followups.sql','004_automatic_sync.sql'])await pg.exec(await readFile(new URL('../../database/migrations/'+file,import.meta.url),'utf8'));
  let busy=false;
  const query=(sql,args=[])=>sql.includes('advisory')?Promise.resolve({rows:[{locked:!busy}]}):pg.query(sql,args);
  const db={query,connect:async()=>({query,release(){}})};
  await upsertRows(db,'attendance',[{...normalized('attendance',attendance),sync_job_id:job}],'hubsoft');
  await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',order),data_referencia_bi:'data_termino_executado'}],'hubsoft');
  await rebuild(db);
  const cacheKey=`hubsoft_history_protocol:${job}:101`;
  const saveCache=async(change={})=>query('INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [cacheKey,JSON.stringify({record:{...attendance,cliente_servico:{id_cliente_servico:'77',endereco_instalacao:{bairro:{nome:'VILA MURIQUI'},cidade:{nome:'Mangaratiba'}}},...change},observedAt:'2026-11-10T12:00:00Z'})]);
  return {db,query,pg,saveCache,setBusy:value=>{busy=value;}};
}
const events=async query=>(await query('SELECT kind,id,event_date,payload FROM commercial_records ORDER BY kind,id')).rows;
const omitLocation=rows=>rows.map(row=>{const {location:_location,...payload}=row.payload;return {...row,payload};});

test('plan e somente leitura; apply recupera cache validado, preserva contagens e e idempotente',async()=>{
  const {db,query,pg,saveCache}=await database();
  try {
    await saveCache();
    const sourceBefore=(await query('SELECT * FROM source_records ORDER BY kind,id')).rows;
    const before=await events(query);
    const plan=await repairLocations(db,['2025-10']);
    assert.equal(plan.mode,'plan');assert.equal(plan.sourceUpdates,1);assert.equal(plan.cacheMatches,1);
    assert.equal(plan.before[0].sales.withoutLocation,1);assert.equal(plan.after[0].sales.withoutLocation,0);
    assert.deepEqual((await query('SELECT * FROM source_records ORDER BY kind,id')).rows,sourceBefore);
    assert.deepEqual(await events(query),before);
    assert.equal((await query("SELECT count(*)::int AS n FROM application_settings WHERE key LIKE 'location_repair:%'")).rows[0].n,0);
    const applied=await repairLocations(db,['2025-10'],{apply:true});
    assert.equal(applied.sourceUpdates,1);assert.ok(applied.auditId.startsWith('location_repair:'));
    const after=await events(query);
    assert.deepEqual(omitLocation(after),omitLocation(before));
    assert.equal(after.find(row=>row.kind==='sales').payload.location,'Muriqui');
    const source=(await query("SELECT payload FROM source_records WHERE kind='attendance' AND id='hubsoft:101'")).rows[0].payload;
    assert.equal(source.bairro,'VILA MURIQUI');assert.equal(source.codigo_cliente,'12');assert.equal(source.data_cadastro,'01/10/2025');
    const repeat=await repairLocations(db,['2025-10'],{apply:true});
    assert.equal(repeat.sourceUpdates,0);assert.deepEqual(await events(query),after);
  }finally{await pg.close();}
});

test('cache de outro cliente, atendimento, protocolo, data ou servico nao vira localidade',async()=>{
  const {db,pg,saveCache}=await database();
  try {
    for(const change of [{id_atendimento:'999'},{protocolo:'999'},{cliente:{codigo_cliente:'999'}},{data_cadastro:'02/10/2025'},{id_cliente_servico:'78'},{deleted_at:'2026-11-10'}]) {
      await saveCache(change);
      const report=await repairLocations(db,['2025-10']);
      assert.equal(report.sourceUpdates,0,JSON.stringify(change));
      assert.equal(report.cacheDivergences,1,JSON.stringify(change));
      assert.equal(report.after[0].sales.withoutLocation,1);
    }
  }finally{await pg.close();}
});

test('reparo disputa o lock do coletor e recusa periodo fora do corte ou escopo aberto',async()=>{
  const {db,query,pg,setBusy}=await database();
  try {
    const before=await events(query);setBusy(true);
    await assert.rejects(repairLocations(db,['2025-10'],{apply:true}),/SINCRONIZACAO_EM_ANDAMENTO/);
    assert.deepEqual(await events(query),before);
    for(const scope of ['', '2024-12', '2025-13', '2025-10,2025-10', '2025-01,2025-02,2025-03','2099-01'])assert.throws(()=>locationRepairMonths(scope),/MESES_LOCALIZACAO_INVALIDOS/);
    assert.deepEqual(locationRepairMonths('2026-10,2025-10'),['2025-10','2026-10']);
  }finally{await pg.close();}
});

test('reparo aborta se a reclassificacao alterar indicador publicado fora da geografia',async()=>{
  const {db,query,pg,saveCache}=await database();
  try {
    await saveCache();
    await query(`UPDATE commercial_records SET payload=jsonb_set(payload,'{sellerName}','"Nome publicado diferente"') WHERE kind='sales'`);
    const before=await events(query);
    await assert.rejects(repairLocations(db,['2025-10'],{apply:true}),/REPARO_LOCALIZACAO_ALTERARIA_INDICADORES_PUBLICADOS/);
    assert.deepEqual(await events(query),before);
    assert.equal((await query("SELECT payload->>'bairro' AS bairro FROM source_records WHERE kind='attendance'")).rows[0].bairro,'');
  }finally{await pg.close();}
});

test('aplicacao preserva localidades de meses fora do escopo explicito',async()=>{
  const {db,query,pg,saveCache}=await database();
  try {
    await saveCache();
    await upsertRows(db,'attendance',[normalized('attendance',{...attendance,id_atendimento:'102',protocolo:'202511010001',data_cadastro:'01/11/2025',bairro:'Cachoeira'})],'hubsoft');
    await upsertRows(db,'serviceOrders',[{...normalized('serviceOrders',{...order,id_ordem_servico:'202',numero:'202',id_atendimento:'102',data_inicio_programado:'02/11/2025 09:00:00',data_inicio_executado:'02/11/2025 09:00:00',data_termino_executado:'02/11/2025 10:00:00'}),data_referencia_bi:'data_termino_executado'}],'hubsoft');
    await rebuild(db);
    await query(`UPDATE commercial_records SET payload=jsonb_set(payload,'{location}','"Cachoeira"') WHERE kind='sales' AND payload->>'id'='hubsoft:202'`);
    const outsideBefore=(await events(query)).filter(row=>String(row.payload.date).startsWith('2025-11'));
    assert.ok(outsideBefore.some(row=>row.kind==='sales'));
    await repairLocations(db,['2025-10'],{apply:true});
    assert.deepEqual((await events(query)).filter(row=>String(row.payload.date).startsWith('2025-11')),outsideBefore);
  }finally{await pg.close();}
});
