import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommercialRows} from '../../server-dist/commercial.js';

const sheet=rows=>{const headers=[...new Set(rows.flatMap(Object.keys))];return {fileName:'test',rows:[headers,...rows.map(row=>headers.map(key=>row[key]??null))]};};
const attendance={id_atendimento:'101',protocolo:'202610010001',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',data_cadastro:'01/10/2026',
  usuario_abertura:'Beatriz',status:'Resolvido',tipo_atendimento:'CANCELAMENTO',descricao_fechamento:'O cancelamento foi efetivado.'};
const order={id_ordem_servico:'201',numero_ordem_servico:'125',id_atendimento:'101',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',
  tipo_ordem_servico:'RETIRADA',status:'Finalizado',data_inicio_programado:'02/10/2026 09:00',data_inicio_executado:'02/10/2026 09:00',data_termino_executado:'02/10/2026 10:00'};
const classify=(opening,closing=attendance.descricao_fechamento)=>classifyCommercialRows(sheet([{...attendance,descricao_abertura:opening,descricao_fechamento:closing}]),sheet([order]));
function reason(opening,expected,closing) {
  const result=classify(opening,closing);
  assert.equal(result.cancellations.length,1,'a causa não muda a confirmação do cancelamento');
  assert.equal(result.cancellations[0].reasonId,expected,opening);
  assert.equal(result.attendanceRows,1);assert.equal(result.serviceOrderRows,1);
  return result.cancellations[0];
}

test('mudança é o motivo inicial, ainda que haja demora, multas e faturas no processo',()=>{
  reason('A cliente solicitou o cancelamento do serviço devido à mudança de imóvel, informando que no novo endereço a internet já está inclusa no aluguel. '+
    'Foi oferecida a possibilidade de transferência de titularidade para evitar multa rescisória. '+
    'Durante o atendimento, demonstrou insatisfação com a demora. Foi concedida isenção da multa. '+
    'Permanecem duas faturas pendentes e ela não conseguiria realizar o pagamento naquele momento.','moving');
});

test('transferência frustrada e imóvel alugado não viram insatisfação nem dificuldade financeira presumida',()=>{
  reason('O cliente solicitou informações sobre transferência de titularidade. A pessoa interessada desistiu após saber da Garantia Contratual por não aprovação na análise de crédito. '+
    'Como não havia ninguém, solicitou o cancelamento. Explicou que a residência havia sido alugada para outra pessoa e que não tinha mais interesse em manter o plano. '+
    'A equipe tentou alternativas, incluindo a possibilidade de mudança de endereço, mas reforçou que desejava cancelar, demonstrando insatisfação com a demora no atendimento. '+
    'Foi solicitado ao setor financeiro emitir a multa rescisória. A finalização ocorrerá após o pagamento.','other');
});

test('negativa explícita e irritação para concluir o cancelamento não significam falha do serviço',()=>{
  reason('O cliente solicitou cancelamento, informando que não possuía mais interesse em permanecer com a internet. '+
    'Inicialmente, foi questionado se havia alguma insatisfação relacionada à conexão, atendimento ou valor do plano, porém informou que não estava insatisfeito e apenas não desejava continuar. '+
    'Foi questionado sobre a possibilidade de transferência de titularidade. Posteriormente, demonstrou insatisfação por ainda não ter conseguido concluir o procedimento. '+
    'O cliente questionou a multa e a fidelidade contratual.','other');
});

test('perguntas, negativas e negações de problemas não são evidência afirmativa',()=>{
  for(const opening of [
    'Não houve insatisfação com o serviço.', 'O cliente negou qualquer insatisfação.',
    'Não há quedas ou oscilações na conexão.', 'Não estava insatisfeito com o atendimento.',
    'Foi questionada se havia alguma insatisfação com quedas ou problemas na conexão.',
    'A cliente não está insatisfeita. Deseja apenas cancelar.',
    'O cliente afirmou: não estou insatisfeito com o serviço.',
    'O cliente negou que houvesse insatisfação com a conexão.',
    'Não tenho dificuldade financeira. Simplesmente não quero continuar.',
    'Foi informada a multa e encaminhado ao setor financeiro.',
    'A equipe ofereceu a possibilidade de mudança de endereço ou de contratar outra operadora.',
  ]) reason(opening,'other');
});

test('reclamação real e causal continua em insatisfação, mesmo com cobrança secundária',()=>{
  for(const opening of [
    'Cliente relata quedas na conexão todos os dias.',
    'Solicitou cancelamento por insatisfação com o serviço. Foi enviada a multa ao financeiro.',
    'Solicitou cancelamento porque a conexão apresenta oscilações frequentes.',
    'Não há problemas financeiros, mas o cliente está insatisfeito com a conexão.',
    'Foi questionado sobre o motivo, porém confirmou insatisfação com o serviço.',
  ]) reason(opening,'dissatisfaction');
});

test('causas explícitas preservam as categorias sem confundir alternativas ou despesas posteriores',()=>{
  for(const [opening,expected] of [
    ['Solicitou cancelamento por dificuldades financeiras. Depois reclamou da demora para cancelar.','financial'],
    ['Solicitou cancelamento por motivo financeiro.','financial'],
    ['Solicitou cancelamento porque não consegue pagar a mensalidade.','financial'],
    ['Cancelou devido ao valor muito alto do plano.','financial'],
    ['Solicitou cancelamento porque mudou para um local sem cobertura.','no-coverage'],
    ['Solicitou cancelamento por fechamento do comércio. Foi questionado sobre insatisfação.','closed-business'],
    ['Solicitou cancelamento porque contratou outro provedor. Foi solicitada a retirada.','existing-provider'],
    ['Solicitou cancelamento por outro provedor no endereço.','existing-provider'],
    ['Solicitou cancelamento por pouco uso. Foi informado sobre a multa.','low-usage'],
    ['Solicitou cancelamento porque não utiliza mais a internet.','low-usage'],
    ['O cliente se mudou. Houve insatisfação com a demora para cancelar.','moving'],
    ['Solicitou cancelamento devido a razões pessoais. Foi oferecida mudança de endereço.','other'],
  ]) reason(opening,expected);
});

test('fechamento só complementa causa ausente quando declara um motivo, sem usar ruído administrativo',()=>{
  reason('Cliente solicitou cancelamento.','financial','Motivo do cancelamento: dificuldades financeiras. O cancelamento foi efetivado.');
  reason('Cliente solicitou cancelamento.','other','A retirada foi concluída. O cancelamento foi efetivado. Houve insatisfação com a demora para concluir o procedimento.');
  reason('Solicitou cancelamento porque não utiliza mais a internet.','low-usage','O cancelamento foi efetivado. Financeiro emitiu multa e houve demora no atendimento.');
});

test('regra usa texto e não nomes, protocolos ou IDs; motivos ambíguos permanecem em Outros',()=>{
  reason('O cliente relata quedas constantes. Também informa dificuldades financeiras.','other');
  const opening='Solicitou cancelamento por insatisfação com o serviço.';
  const a={...attendance,id_atendimento:'999',protocolo:'202610090009',nome_razaosocial:'Outra pessoa',descricao_abertura:opening};
  const result=classifyCommercialRows(sheet([a]),sheet([{...order,id_atendimento:'999'}]));
  assert.equal(result.cancellations[0].reasonId,reason(opening,'dissatisfaction').reasonId);
});
