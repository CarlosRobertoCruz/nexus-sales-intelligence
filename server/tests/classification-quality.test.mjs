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

test('renovação e alteração de plano pendentes contam sem receber status de conclusão',()=>{
  for(const type of ['RENOVAÇÃO DE CONTRATO','ALTERAÇÃO DE PLANO']) {
    const pending={...attendanceFixture,tipo_atendimento:type,status:'Pendente',descricao_abertura:'Ticket: #654 Alteração aceita, aguardando resolução'};
    for(const status of ['Em andamento','Aguardando Análise','']) {
      const result=classifyCommercialRows(worksheet([{...pending,status}]),worksheet([orderFixture]));
      assert.equal(result.renewals.length,0,`${type}: ${status} não é um status incluído pela gestão`);
      assert.equal(result.attendance.length,1,'atendimento permanece no volume e na origem');
    }
    for(const status of ['Pendente',' pendente ']) {
      const result=classifyCommercialRows(worksheet([{...pending,status}]),worksheet([orderFixture]));
      assert.equal(result.renewals.length,1);assert.equal(result.renewals[0].completed,false);
    }
    for(const status of ['Resolvido',' resolvido ','Finalizado']) {
      const resolved={...pending,status};
      assert.equal(classifyCommercialRows(worksheet([resolved]),worksheet([orderFixture])).renewals.length,1);
      assert.equal(classifyCommercialRows(worksheet([resolved]),worksheet([orderFixture])).renewals[0].completed,true);
      const other={...resolved,id_atendimento:'102',protocolo:'202610010002'};
      const result=classifyCommercialRows(worksheet([pending,other]),worksheet([orderFixture]));
      assert.equal(result.renewals.length,2,'protocolos distintos contam mesmo com um pendente');
      assert.equal(classifyCommercialRows(worksheet([pending,resolved]),worksheet([orderFixture])).renewals.length,1,'resolver o mesmo protocolo não duplica o evento');
    }
  }
});

test('184 renovações concluídas e uma pendente totalizam 185 sem incluir não realizadas',()=>{
  const rows=Array.from({length:185},(_,i)=>({...attendanceFixture,id_atendimento:String(1000+i),protocolo:`20261001${1000+i}`,
    tipo_atendimento:i<172?'RENOVAÇÃO DE CONTRATO':'ALTERAÇÃO DE PLANO',status:i===184?'Pendente':'Resolvido'}));
  const rejected={...rows[0],id_atendimento:'9999',protocolo:'202610019999',tipo_atendimento:'ALTERAÇÃO DE PLANO NÃO REALIZADO'};
  const r=classifyCommercialRows(worksheet([...rows,rows[184],rejected]),worksheet([orderFixture]));
  assert.equal(r.renewals.length,185);assert.equal(r.renewals.filter(row=>row.completed).length,184);
  assert.equal(r.renewals.filter(row=>!row.completed).length,1);
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

test('cancelamento concluído exige o tipo exato e status resolvido',()=>{
  const requested={...attendanceFixture,id_atendimento:'102',protocolo:'202610010002',tipo_atendimento:'SOLICITAÇÃO DE CANCELAMENTO/NÃO REALIZADO',descricao_abertura:'Cliente pediu informações sobre cancelamento.'};
  const completed={...attendanceFixture,id_atendimento:'103',protocolo:'202610010003',tipo_atendimento:'CANCELAMENTO',status:'Resolvido',descricao_abertura:'Encerramento contratual.',descricao_fechamento:'Cancelamento efetivado.'};
  const result=classifyCommercialRows(worksheet([requested,completed]),worksheet([orderFixture]));
  assert.equal(result.cancellations.length,1);
  assert.equal(result.cancellations[0].id,completed.protocolo);
  assert.equal(result.cancellations[0].completed,true);
  for(const type of ['CANCELAMENTO',' cancelamento ']) {
    const result=classifyCommercialRows(worksheet([{...completed,tipo_atendimento:type,status:' resolvido '}]),worksheet([orderFixture]));
    assert.equal(result.cancellations.length,1);
    assert.equal(result.cancellations[0].date.getDate(),1,'data comercial continua sendo o cadastro do atendimento');
  }
  for(const status of ['Pendente','Em andamento','Aguardando Análise','Finalizado','']) {
    const result=classifyCommercialRows(worksheet([{...completed,status,descricao_abertura:'O contrato foi cancelado e a retirada foi agendada.'}]),
      worksheet([{...orderFixture,id_atendimento:completed.id_atendimento,tipo_ordem_servico:'RETIRADA',status:'Finalizado'}]));
    assert.equal(result.cancellations.length,0,`${status} não é atendimento resolvido, mesmo com retirada finalizada`);
    assert.equal(result.attendanceRows,1,'registro permanece no volume de atendimentos');
  }
  for(const tipo_atendimento of ['RETIRADA','RETIRADA ROKU','SOLICITAÇÃO DE DESCONTO','SUSPENSÃO TEMPORÁRIA','SAC','CANCELAMENTO NÃO REALIZADO']) {
    const result=classifyCommercialRows(worksheet([{...completed,tipo_atendimento,descricao_abertura:'O cancelamento foi realizado com sucesso.'}]),
      worksheet([{...orderFixture,id_atendimento:completed.id_atendimento,tipo_ordem_servico:'RETIRADA',status:'Finalizado'}]));
    assert.equal(result.cancellations.length,0,`${tipo_atendimento} não vira cancelamento pelo texto ou pela OS`);
  }
  for(const classification_status of ['incomplete','discarded_draft']) {
    assert.equal(classifyCommercialRows(worksheet([attendanceFixture,{...completed,classification_status}]),worksheet([orderFixture])).cancellations.length,0);
  }
  assert.equal(classifyCommercialRows(worksheet([completed,{...completed,descricao_abertura:'Texto atualizado'}]),worksheet([orderFixture])).cancellations.length,1);
});

test('distribuição de outubro preserva 19 candidatos, mas conta somente 16 com desfecho confirmado',()=>{
  let nextId=1000;
  const add=(type,status,description)=>({...attendanceFixture,id_atendimento:String(++nextId),protocolo:`20261001${nextId}`,
    tipo_atendimento:type,status,descricao_abertura:description});
  const confirmed=Array.from({length:16},()=>add('CANCELAMENTO','Resolvido','O cancelamento foi realizado.'));
  const reversed=[
    {...add('CANCELAMENTO','Resolvido','Solicitou cancelamento.'),descricao_fechamento:'O cancelamento inicialmente solicitado não foi realizado. Optou pela migração.'},
    {...add('CANCELAMENTO','Resolvido','Solicitou cancelamento.'),descricao_fechamento:'Desistiu da solicitação de cancelamento. A solicitação de cancelamento foi revertida, mantendo o contrato ativo.'},
    {...add('CANCELAMENTO','Resolvido','Solicitou cancelamento.'),descricao_fechamento:'Atendimento finalizado por falta de comunicação. O cancelamento permanece pendente de conclusão.'},
  ];
  const pending=Array.from({length:3},()=>add('CANCELAMENTO','Pendente','Aguardando análise da solicitação.'));
  const others=[...Array(5).fill('RETIRADA'),...Array(3).fill('RETIRADA ROKU'),'SOLICITAÇÃO DE DESCONTO','SUSPENSÃO TEMPORÁRIA']
    .map(type=>add(type,'Resolvido','O contrato foi cancelado.'));
  const result=classifyCommercialRows(worksheet([...confirmed,...reversed,...pending,...others]),worksheet([orderFixture]));
  assert.deepEqual(result.cancellations.map(row=>row.id),confirmed.map(row=>row.protocolo));
  assert.equal(result.attendanceRows,32,'todos os atendimentos permanecem na base, sem forçar a contagem para 20');
  assert.ok(result.warnings.some(w=>w.startsWith('2 atendimento(s) de cancelamento resolvido(s) com desistência')));
  assert.ok(result.warnings.some(w=>w.startsWith('1 atendimento(s) de cancelamento resolvido(s) descrevem')));
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
