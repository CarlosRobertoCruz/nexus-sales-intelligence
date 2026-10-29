import test from 'node:test';
import assert from 'node:assert/strict';
import {HubsoftClient} from '../hubsoft.mjs';
import {usesProtocolPilot} from '../historyPolicy.mjs';

const env={HUBSOFT_API_URL:'https://example.invalid',HUBSOFT_CLIENT_ID:'c',HUBSOFT_CLIENT_SECRET:'s',HUBSOFT_USERNAME:'u',HUBSOFT_PASSWORD:'p'};
const record={id_atendimento:110,protocolo:'202610010001',usuario_abertura:'Teste',ordens_servico:[]};
function fixture(records) {
  const calls=[];
  const client=new HubsoftClient(env,async(url,options)=>{
    calls.push({url:new URL(url),options});
    return Response.json(options.method==='POST'?{access_token:'test-token',expires_in:3600}:{status:'suscess',atendimentos:records});
  },async()=>{});
  return {client,calls};
}
test('detalhe usa uma consulta exata, limit=1, sem repetir OAuth enquanto válido',async()=>{
  const {client,calls}=fixture([record]);
  assert.deepEqual(await client.attendanceDetail(record.protocolo),record);
  await client.attendanceDetail(record.protocolo);
  assert.equal(calls.filter(c=>c.options.method==='POST').length,1);
  const query=calls[1].url;
  assert.equal(query.pathname,'/api/v1/integracao/cliente/atendimento');
  assert.equal(query.searchParams.get('busca'),'protocolo');
  assert.equal(query.searchParams.get('termo_busca'),record.protocolo);
  assert.equal(query.searchParams.get('limit'),'1');
  assert.equal(query.searchParams.get('apenas_pendente'),'nao');
  assert.equal(query.searchParams.has('data_inicio'),false);
  assert.equal(query.searchParams.has('data_fim'),false);
  assert.equal(calls[1].options.redirect,'error');
});
test('não aceita resposta vazia, múltipla ou de outro protocolo',async()=>{
  for(const rows of [[],[record,record],[{...record,protocolo:'999'}]]) {
    const {client,calls}=fixture(rows);
    await assert.rejects(client.attendanceDetail(record.protocolo),/PROTOCOLO_DIVERGENTE/);
    assert.equal(calls.length,2);
  }
  const {client,calls}=fixture([record]);
  for(const value of ['',null,123,'12&limit=500','1'.repeat(41)]) await assert.rejects(client.attendanceDetail(value),/PROTOCOLO_INVALIDO/);
  assert.equal(calls.length,0);
});
test('exceção fica vinculada a um job e não se propaga para outro dia, mês ou orçamento',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const m={year:2026,phase:'day',peakDay:'2026-10-01',maxCalls:500,enrichmentStrategy:'protocol',protocolException:{enabled:true,jobId:id,day:'2026-10-01'}};
  assert.equal(usesProtocolPilot(m,id),true);
  assert.equal(usesProtocolPilot({phase:'history'}),false);
  for(const change of [{phase:'october'},{phase:'history'},{year:2025},{peakDay:'2026-10-02'},{maxCalls:501},{protocolException:{...m.protocolException,enabled:false}}]) {
    assert.throws(()=>usesProtocolPilot({...m,...change},id),/EXCECAO/);
  }
  assert.throws(()=>usesProtocolPilot(m,'22222222-2222-4222-8222-222222222222'),/EXCECAO/);
});
