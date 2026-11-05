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

test('rascunho abandonado fica na origem, mas nao no volume de atendimentos nem em indicadores',()=>{
  const draft={...attendanceFixture,id_atendimento:'102',protocolo:'202610010002',descricao_abertura:'',tipo_atendimento:'',quantidade_os:'0',rascunho:'sim',classification_status:'discarded_draft'};
  const result=classifyCommercialRows(worksheet([attendanceFixture,draft]),worksheet([orderFixture]));
  assert.equal(result.attendanceRows,1);assert.equal(result.attendance.length,1);
  assert.equal(result.sales.length,1);assert.ok(result.warnings.some(w=>w.includes('1 rascunho(s) abandonado(s)')));
});

test('renovações aceitam os dois tipos confirmados pela gestão, sem usar menções no texto',()=>{
  const renewal={...attendanceFixture,id_atendimento:'102',protocolo:'202610010002',tipo_atendimento:'RENOVAÇÃO DE CONTRATO',descricao_abertura:'Cliente aceitou bônus de velocidade'};
  const planChange={...attendanceFixture,id_atendimento:'105',protocolo:'202610010005',tipo_atendimento:'ALTERAÇÃO DE PLANO',descricao_abertura:'Cliente alterou o plano para 900 Mega Power Plus',data_cadastro:'15/10/2026'};
  const unrelated={...attendanceFixture,id_atendimento:'103',protocolo:'202610010003',tipo_atendimento:'SUPORTE',descricao_abertura:'Cliente perguntou sobre renovação e bônus'};
  const unsuccessful={...attendanceFixture,id_atendimento:'104',protocolo:'202610010004',tipo_atendimento:'RENOVAÇÃO DE CONTRATO NÃO REALIZADO',descricao_abertura:'Cliente não aceitou a oferta'};
  const unsuccessfulChange={...planChange,id_atendimento:'106',protocolo:'202610010006',tipo_atendimento:'ALTERAÇÃO DE PLANO NÃO REALIZADO'};
  const incompleteChange={...planChange,id_atendimento:'107',protocolo:'202610010007',classification_status:'incomplete'};
  const draftChange={...planChange,id_atendimento:'108',protocolo:'202610010008',classification_status:'discarded_draft'};
  const result=classifyCommercialRows(worksheet([renewal,planChange,unrelated,unsuccessful,unsuccessfulChange,incompleteChange,draftChange]),worksheet([orderFixture]));
  assert.deepEqual(result.renewals.map(r=>r.id),[renewal.protocolo,planChange.protocolo]);
  assert.equal(result.renewals[1].date.getDate(),15,'mês e dia seguem cadastro do atendimento');
  assert.equal(result.sales.length,0,'alteração de plano não se transforma em instalação');
});

test('protocolos distintos do mesmo cliente e ticket não perdem renovações de planos diferentes',()=>{
  const changed={...attendanceFixture,id_atendimento:'105',protocolo:'202610010005',tipo_atendimento:'  alteracao de plano  ',descricao_abertura:'Ticket: #987 Cliente alterou o plano'};
  const otherService={...changed,id_atendimento:'106',protocolo:'202610010006'};
  const result=classifyCommercialRows(worksheet([changed,otherService]),worksheet([orderFixture]));
  assert.deepEqual(result.renewals.map(row=>row.id),[changed.protocolo,otherService.protocolo]);
  assert.equal(new Set(result.renewals.map(row=>row.businessKey)).size,2);
});

test('texto copiado, referência de OS e titularidade não fundem protocolos de renovação',()=>{
  for(const description of ['Cliente aceitou o benefício', 'Ordem de serviço 987', 'Alteração de titularidade com renovação']) {
    const first={...attendanceFixture,tipo_atendimento:'RENOVAÇÃO DE CONTRATO',descricao_abertura:description};
    const second={...first,id_atendimento:'102',protocolo:'202610010002'};
    const result=classifyCommercialRows(worksheet([first,second]),worksheet([orderFixture]));
    assert.equal(result.renewals.length,2,description);
  }
});

test('reimportar o mesmo atendimento ou protocolo não duplica renovações',()=>{
  const first={...attendanceFixture,tipo_atendimento:'RENOVAÇÃO DE CONTRATO'};
  const legacy={...first,id_atendimento:undefined};
  const repeated={...first,descricao_abertura:'Descrição atualizada'};
  assert.equal(classifyCommercialRows(worksheet([first,repeated]),worksheet([orderFixture])).renewals.length,1);
  const result=classifyCommercialRows(worksheet([legacy,first]),worksheet([orderFixture]));
  assert.equal(result.renewals.length,1,'mesmo protocolo em planilha e API representa um atendimento');
  assert.equal(result.renewals[0].id,first.protocolo);
});

test('renovação e alteração de plano pendentes permanecem na origem e só contam após resolução',()=>{
  for(const type of ['RENOVAÇÃO DE CONTRATO','ALTERAÇÃO DE PLANO']) {
    const pending={...attendanceFixture,tipo_atendimento:type,status:'Pendente',descricao_abertura:'Ticket: #654 Alteração aceita, aguardando resolução'};
    for(const status of ['Pendente',' pendente ','Em andamento','Aguardando Análise','']) {
      const result=classifyCommercialRows(worksheet([{...pending,status}]),worksheet([orderFixture]));
      assert.equal(result.renewals.length,0,`${type}: ${status} não é resolução`);
      assert.equal(result.attendance.length,1,'atendimento permanece no volume e na origem');
    }
    for(const status of ['Resolvido',' resolvido ','Finalizado']) {
      const resolved={...pending,status};
      assert.equal(classifyCommercialRows(worksheet([resolved]),worksheet([orderFixture])).renewals.length,1);
      const other={...resolved,id_atendimento:'102',protocolo:'202610010002'};
      const result=classifyCommercialRows(worksheet([pending,other]),worksheet([orderFixture]));
      assert.equal(result.renewals.length,1);
      assert.equal(result.renewals[0].id,other.protocolo,'pendente não substitui o protocolo resolvido na deduplicação');
    }
  }
});

test('checklists não viram instalações, reativações ou prova de retirada, mas permanecem no volume bruto',()=>{
  for(const type of ['CHECKLIST Instalação','Check-list Reativação','CHECK LIST Retirada']) {
    const a={...attendanceFixture,...(type.includes('Retirada')?{tipo_atendimento:'Cancelamento',descricao_abertura:'Solicita cancelamento'}:{})};
    const result=classifyCommercialRows(worksheet([a]),worksheet([{...orderFixture,tipo_ordem_servico:type}]));
    assert.equal(result.serviceOrderRows,1);assert.equal(result.serviceOrders.length,1);
    assert.equal(result.linkedServiceOrders,0);assert.equal(result.sales.length,0);assert.equal(result.reactivations.length,0);
    if(type.includes('Retirada')) assert.equal(result.cancellations.length,0);
    assert.ok(result.warnings.some(w=>w.includes('1 OS de checklist')));
  }
});

test('somente cancelamento efetivado entra no indicador',()=>{
  const requested={...attendanceFixture,id_atendimento:'102',protocolo:'202610010002',tipo_atendimento:'SOLICITAÇÃO DE CANCELAMENTO/NÃO REALIZADO',descricao_abertura:'Cliente pediu informações sobre cancelamento.'};
  const completed={...attendanceFixture,id_atendimento:'103',protocolo:'202610010003',tipo_atendimento:'CANCELAMENTO',descricao_abertura:'O cancelamento foi realizado com sucesso.'};
  const result=classifyCommercialRows(worksheet([requested,completed]),worksheet([orderFixture]));
  assert.equal(result.cancellations.length,1);
  assert.equal(result.cancellations[0].id,completed.protocolo);
  assert.equal(result.cancellations[0].completed,true);
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

test('atendimento anterior serve só de contexto da OS validada, sem criar mês ou indicadores anteriores',()=>{
  const october={...attendanceFixture,tipo_atendimento:'RENOVAÇÃO DE CONTRATO',descricao_abertura:'Renovação com benefício'};
  const september={...attendanceFixture,id_atendimento:'99',protocolo:'202609300001',data_cadastro:'30/09/2026',
    publication_scope:'installation_context',installation_context_order_ids:'201'};
  const order={...orderFixture,id_atendimento:'99'};
  const result=classifyCommercialRows(worksheet([october,september]),worksheet([order]));
  assert.equal(result.sales.length,1);assert.equal(result.sales[0].attendanceId,'hubsoft:99');
  assert.equal(result.sales[0].date.getMonth(),9);
  assert.equal(result.attendance.length,1);assert.equal(result.attendanceRows,1);
  assert.equal(result.renewals.length,1);assert.equal(result.periodKey,'2026-10');
  assert.equal(result.periodStart.getMonth(),9,'contexto não introduz setembro no período');
  for(const changes of [
    {publication_scope:'installation_context',installation_context_order_ids:'999'},
    {codigo_cliente:'999'},
    {classification_status:'incomplete'},
    {tipo_atendimento:'SUPORTE'},
    {data_cadastro:'02/10/2026'},
    {id_atendimento:'98'},
  ]) {
    const rejected=classifyCommercialRows(worksheet([october,{...september,...changes}]),worksheet([order]));
    assert.equal(rejected.sales.length,0,JSON.stringify(changes));
    assert.equal(rejected.attendanceRows,1);
  }
  const anotherOrder={...order,id_ordem_servico:'202',numero_ordem_servico:'126'};
  assert.equal(classifyCommercialRows(worksheet([october,september]),worksheet([order,anotherOrder])).sales.length,1,'contexto não autoriza outra OS do mesmo pai');
});
