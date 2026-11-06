import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommercialRows} from '../../server-dist/commercial.js';

const worksheet=rows=>{const h=[...new Set(rows.flatMap(Object.keys))];return {fileName:'test',rows:[h,...rows.map(r=>h.map(k=>r[k]??null))]};};
const attendance={id_atendimento:'101',protocolo:'202610010001',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',
  descricao_abertura:'Cliente solicitou cancelamento.',descricao_fechamento:'Atendimento finalizado junto à ordem de serviço de Nº 125.',
  data_cadastro:'01/10/2026',usuario_abertura:'Atendente de teste',tipo_atendimento:'CANCELAMENTO',status:'Resolvido'};
const order={id_ordem_servico:'201',numero_ordem_servico:'125',id_atendimento:'101',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',
  tipo_ordem_servico:'RETIRADA',status:'Finalizado',data_inicio_programado:'02/10/2026 09:00:00',
  data_inicio_executado:'02/10/2026 09:00:00',data_termino_executado:'02/10/2026 10:00:00',data_referencia_bi:'data_termino_executado'};
const classify=(a=attendance,o=[order])=>classifyCommercialRows(worksheet([a]),worksheet(o));

test('fechamento prevalece sobre alternativas e pendências antigas da abertura',()=>{
  for(const opening of [
    'O cancelamento inicialmente solicitado não foi realizado, pois optou pela migração.',
    'O cancelamento permanece pendente de conclusão.',
    'A cliente recusou suspensão temporária e deseja cancelar.',
  ]) {
    assert.equal(classify({...attendance,descricao_abertura:opening}).cancellations.length,1);
    assert.equal(classify({...attendance,descricao_abertura:opening,descricao_fechamento:'O cancelamento foi efetivado.'},
      [{...order,tipo_ordem_servico:'SUPORTE'}]).cancellations.length,1,'conclusão explícita não exige retirada');
  }
});

test('reversão ou desistência no fechamento não vira cancelamento mesmo com retirada finalizada',()=>{
  for(const closing of [
    'O cancelamento inicialmente solicitado não foi realizado, pois a cliente optou pela migração do serviço.',
    'O cliente desistiu da solicitação de cancelamento e optou pela migração. A solicitação de cancelamento foi revertida, mantendo o contrato ativo.',
    'A cliente não deseja mais realizar o cancelamento.',
  ]) {
    const r=classify({...attendance,descricao_abertura:'O contrato foi cancelado.',descricao_fechamento:closing});
    assert.equal(r.cancellations.length,0);assert.equal(r.attendanceRows,1);
    assert.ok(r.warnings.some(w=>w.includes('desistência ou reversão')));
  }
});

test('encerramento por falta de contato ou cancelamento ainda pendente fica fora do indicador',()=>{
  for(const closing of [
    'O atendimento foi finalizado por falta de comunicação. O cancelamento permanece pendente de conclusão.',
    'O cancelamento está pendente.',
    'Efetivação definitiva do cancelamento ainda não confirmada.',
  ]) {
    const r=classify({...attendance,descricao_fechamento:closing});
    assert.equal(r.cancellations.length,0);assert.ok(r.warnings.some(w=>w.includes('processo ainda pendente')));
  }
});

test('desfecho desconhecido ou conflitante exige revisão, sem publicar conclusão presumida',()=>{
  for(const closing of ['Atendimento encerrado.',
    'O cancelamento foi realizado. A solicitação de cancelamento foi revertida.',
    'Se o contrato for cancelado, será feita uma retirada.',
    'Não há confirmação de cancelamento realizado.',
    'Não houve cancelamento realizado.',
  ]) {
    const r=classify({...attendance,descricao_fechamento:closing},[{...order,tipo_ordem_servico:'SUPORTE'}]);
    assert.equal(r.cancellations.length,0);assert.ok(r.warnings.some(w=>w.includes('exigem conferência do desfecho')));
  }
  const noClosing=classify({...attendance,descricao_abertura:'O contrato foi cancelado.',descricao_fechamento:''},[{...order,tipo_ordem_servico:'SUPORTE'}]);
  assert.equal(noClosing.cancellations.length,1,'conclusão explícita na abertura é usada quando não há fechamento');
});

test('prova por OS exige retirada válida e vínculo exato, sem reaproveitar OS de outro cliente ou atendimento',()=>{
  assert.equal(classify().cancellations.length,1);
  for(const change of [
    {id_atendimento:'999'},{codigo_cliente:'999'},{tipo_ordem_servico:'RETIRADA ROKU'},
    {tipo_ordem_servico:'CHECKLIST RETIRADA'},{tipo_ordem_servico:'MIGRAÇÃO DE ENDEREÇO'},
    {status:'Pendente'},{data_inicio_executado:''},{data_termino_executado:''},
    {data_inicio_executado:'03/10/2026 10:00:00'},
    {data_inicio_executado:'30/09/2026 09:00:00',data_termino_executado:'30/09/2026 10:00:00'},
  ]) assert.equal(classify(attendance,[{...order,...change}]).cancellations.length,0,JSON.stringify(change));
  const unlinked={...attendance,id_atendimento:undefined,quantidade_os:'1',descricao_fechamento:'Atendimento encerrado.'};
  assert.equal(classify(unlinked,[{...order,id_atendimento:undefined}]).cancellations.length,0,'mesmo cliente com uma OS não comprova vínculo');
  assert.equal(classify({...unlinked,descricao_fechamento:attendance.descricao_fechamento},[{...order,id_atendimento:undefined}]).cancellations.length,1,'planilha pode provar o vínculo pelo número explícito');
  const installation={...order,id_ordem_servico:'202',numero_ordem_servico:'126',tipo_ordem_servico:'INSTALAÇÃO'};
  assert.equal(classify(attendance,[installation,order]).cancellations.length,1,'não usa apenas a primeira OS do atendimento');
});

test('atualização de pendente para resolvido requer evidência e conserva cadastro em outubro com execução em novembro',()=>{
  const a={...attendance,data_cadastro:'30/10/2026',status:'Pendente'};
  const o={...order,data_inicio_executado:'04/11/2026 14:00:00',data_termino_executado:'04/11/2026 14:36:00'};
  assert.equal(classify(a,[o]).cancellations.length,0);
  assert.equal(classify({...a,status:'Resolvido'},[{...o,status:'Pendente'}]).cancellations.length,0);
  const r=classify({...a,status:'Resolvido'},[o]);
  assert.equal(r.cancellations.length,1);assert.equal(r.cancellations[0].date.getMonth(),9);
  assert.equal(r.cancellations[0].date.getDate(),30);assert.equal(r.serviceOrders[0].date.getMonth(),10);
});
