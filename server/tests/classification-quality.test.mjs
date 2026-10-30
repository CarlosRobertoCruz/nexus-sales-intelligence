import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommercialRows} from '../../server-dist/commercial.js';

const worksheet=rows=>{const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];return {fileName:'test',rows:[headers,...rows.map(r=>headers.map(h=>r[h]??null))]};};
test('atendimentos incompletos contam no volume, sem gerar classificação comercial mesmo com OS finalizada',()=>{
  const a={id_atendimento:'101',protocolo:'202610010001',nome_razaosocial:'Teste',codigo_cliente:'12',descricao_abertura:'Instalação 600 Mega Combo Plus',descricao_fechamento:'',data_cadastro:'01/10/2026',usuario_abertura:'Beatriz',status:'Finalizado',tipo_atendimento:'Instalação'};
  const o={id_ordem_servico:'201',id_atendimento:'101',numero_ordem_servico:'125',nome_razaosocial:'Teste',codigo_cliente:'12',tipo_ordem_servico:'Instalação',status:'finalizado',data_inicio_programado:'01/10/2026 10:00:00',data_inicio_executado:'01/10/2026 10:00:00',data_termino_executado:'01/10/2026 11:00:00',data_referencia_bi:'data_termino_executado'};
  const complete=classifyCommercialRows(worksheet([a]),worksheet([o]));
  assert.equal(complete.sales.length,1);
  const result=classifyCommercialRows(worksheet([{...a,classification_status:'incomplete',quality_missing_fields:'descricao_abertura'}]),worksheet([o]));
  assert.equal(result.attendance.length,1);assert.equal(result.serviceOrders.length,1);
  assert.equal(result.sales.length,0);assert.equal(result.renewals.length,0);assert.equal(result.cancellations.length,0);
  assert.ok(result.warnings.some(w=>w.includes('1 atendimento(s) com dados incompletos')));
});

const attendanceFixture={id_atendimento:'101',protocolo:'202610010001',nome_razaosocial:'Teste',codigo_cliente:'12',descricao_abertura:'Instalação 600 Mega Combo Plus',descricao_fechamento:'',data_cadastro:'01/10/2026',usuario_abertura:'Beatriz',status:'Finalizado',tipo_atendimento:'Instalação'};
const orderFixture={id_ordem_servico:'201',id_atendimento:'101',numero_ordem_servico:'125',nome_razaosocial:'Teste',codigo_cliente:'12',tipo_ordem_servico:'Instalação',status:'finalizado',data_inicio_programado:'01/10/2026 10:00:00',data_inicio_executado:'01/10/2026 10:00:00',data_termino_executado:'01/10/2026 11:00:00',data_referencia_bi:'data_termino_executado'};

test('checklists não viram instalações, reativações ou prova de retirada, mas permanecem no volume bruto',()=>{
  for(const type of ['CHECKLIST Instalação','Check-list Reativação','CHECK LIST Retirada']) {
    const a={...attendanceFixture,...(type.includes('Retirada')?{tipo_atendimento:'Cancelamento',descricao_abertura:'Solicita cancelamento'}:{})};
    const result=classifyCommercialRows(worksheet([a]),worksheet([{...orderFixture,tipo_ordem_servico:type}]));
    assert.equal(result.serviceOrderRows,1);assert.equal(result.serviceOrders.length,1);
    assert.equal(result.linkedServiceOrders,0);assert.equal(result.sales.length,0);assert.equal(result.reactivations.length,0);
    if(type.includes('Retirada')) {assert.equal(result.cancellations.length,1);assert.equal(result.cancellations[0].completed,false);}
    assert.ok(result.warnings.some(w=>w.includes('1 OS de checklist')));
  }
});

test('checklist não encobre OS comercial válida do mesmo atendimento',()=>{
  const rows=[{...orderFixture,id_ordem_servico:'202',numero_ordem_servico:'126',tipo_ordem_servico:'CHECKLIST MOBI'},orderFixture];
  const result=classifyCommercialRows(worksheet([attendanceFixture]),worksheet(rows));
  assert.equal(result.serviceOrders.length,2);assert.equal(result.sales.length,1);assert.equal(result.sales[0].id,'hubsoft:201');
  assert.equal(result.linkedServiceOrders,1);
});

test('instalação posterior mantém a data de execução e os demais tipos não são descartados por uma whitelist genérica',()=>{
  const result=classifyCommercialRows(worksheet([attendanceFixture]),worksheet([{...orderFixture,data_inicio_executado:'05/10/2026 10:00:00',data_termino_executado:'05/10/2026 11:00:00'},
    {...orderFixture,id_ordem_servico:'203',numero_ordem_servico:'127',tipo_ordem_servico:'Reativação'}]));
  assert.equal(result.sales.length,1);assert.equal(result.sales[0].date.getDate(),5);assert.equal(result.reactivations.length,1);
});
