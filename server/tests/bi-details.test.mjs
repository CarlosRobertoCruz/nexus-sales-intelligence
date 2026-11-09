import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommercialRows} from '../../server-dist/commercial.js';

const sheet=rows=>{const h=[...new Set(rows.flatMap(Object.keys))];return {fileName:'test',rows:[h,...rows.map(r=>h.map(k=>r[k]??null))]};};
const attendance={id_atendimento:'101',protocolo:'202610010001',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',
  descricao_abertura:'Instalação 600 Mega Combo Plus',descricao_fechamento:'',data_cadastro:'01/10/2026',usuario_abertura:'Beatriz',tipo_atendimento:'INSTALAÇÃO',status:'Resolvido'};
const order={id_ordem_servico:'201',numero_ordem_servico:'125',id_atendimento:'101',codigo_cliente:'12',nome_razaosocial:'Cliente de teste',
  tipo_ordem_servico:'INSTALAÇÃO',status:'Finalizado',data_inicio_programado:'02/10/2026 09:00:00',data_inicio_executado:'02/10/2026 09:00:00',data_termino_executado:'02/10/2026 10:00:00'};

test('planos conhecidos e novos permanecem distintos, sem inferir identidade só pela velocidade',()=>{
  const cases=[
    ['600 MEGA COMBO PLUS','combo-plus'], ['600 MEGA COMBO TOTAL PLUS','combo-total-plus'], ['600 MEGA COMBO VIEW','combo-view'],
    ['720 MEGA COMBO ULTRA','combo-ultra'], ['900 MEGA POWER PLUS','power-plus'], ['1 GIGA ULTRA POWER','ultra-power'],
    ['NEXUS ESSENCIAL (600 MEGA + Aplicativo Ubook)','nexus-essential'], ['600 Mega Nexus Essencial','nexus-essential'], ['600 MEGA ESSENCIAL','nexus-essential'],
    ['1 GIGA NEXUS PRO','nexus-pro'], ['Nexus Pro 1 GIGA','nexus-pro'], ['1 GIGA NEXUS FAMILY','nexus-family'],
    ['900 MEGA NEXUS GAMER','nexus-gamer'], ['1 GIGA ULTRA SOMENTE INTERNET','ultra-internet'],
    ['900 MEGA + 1 Aplicativo Standard + 1 Aplicativo Premium','900-apps'],
    ['1 Giga Nexus Pro. Anteriormente usava 600 Mega Combo Plus','nexus-pro'],
    ['600 Mega produto desconhecido','other'], ['900 Mega','other'], ['1 GIGA novo produto','other'],
  ];
  for(const [description,id] of cases) {
    const result=classifyCommercialRows(sheet([{...attendance,descricao_abertura:`INSTALAÇÃO FIBRA ÓPTICA PLANO: ${description}, cliente ciente.`}]),sheet([order]));
    assert.equal(result.sales.length,1);assert.equal(result.sales[0].planId,id,description);
  }
});

test('distribuição de 49 vendas conserva o total e explicita as 20 antes não reconhecidas',()=>{
  const products=[...Array(29).fill('600 Mega Combo Plus'),...Array(12).fill('600 Mega Nexus Essencial'),...Array(4).fill('1 Giga Nexus Pro'),
    '1 Giga Nexus Family','900 Mega Nexus Gamer','1 Giga Ultra Somente Internet','900 Mega + 1 Aplicativo Standard + 1 Aplicativo Premium'];
  const rows=products.map((description,index)=>({...attendance,id_atendimento:String(1000+index),protocolo:String(202610010001+index),descricao_abertura:`PLANO: ${description}`}));
  const orders=products.map((_,index)=>({...order,id_ordem_servico:String(2000+index),numero_ordem_servico:String(3000+index),id_atendimento:String(1000+index)}));
  const result=classifyCommercialRows(sheet(rows),sheet(orders));
  assert.equal(result.sales.length,49);
  assert.deepEqual(Object.fromEntries([...new Set(result.sales.map(r=>r.planId))].map(id=>[id,result.sales.filter(r=>r.planId===id).length])),
    {'combo-plus':29,'nexus-essential':12,'nexus-pro':4,'nexus-family':1,'nexus-gamer':1,'ultra-internet':1,'900-apps':1});
});

test('detalhe usa OS locais do cliente, recentes primeiro, sem misturar pessoas, checklists ou mudar contagens',()=>{
  const a={...attendance,tipo_atendimento:'CANCELAMENTO',descricao_abertura:'Cliente relata quedas na conexão.\nSenha do Wi-Fi: SEGREDO',descricao_fechamento:'O cancelamento foi efetivado.',data_cadastro:'10/10/2026'};
  const previous=Array.from({length:7},(_,index)=>({...order,id_ordem_servico:String(301+index),numero_ordem_servico:String(401+index),id_atendimento:'999',tipo_ordem_servico:'SUPORTE',
    data_cadastro:`0${index+1}/10/2026 09:00:00`,data_inicio_executado:`0${index+1}/10/2026 10:00:00`,data_termino_executado:`0${index+1}/10/2026 11:00:00`,descricao_servico:`Tratamento ${index+1}`}));
  const otherCustomer={...previous[0],id_ordem_servico:'700',numero_ordem_servico:'800',codigo_cliente:'99',nome_razaosocial:'Cliente de teste'};
  const future={...previous[0],id_ordem_servico:'701',numero_ordem_servico:'801',data_cadastro:'20/10/2026'};
  const checklist={...previous[0],id_ordem_servico:'702',numero_ordem_servico:'802',tipo_ordem_servico:'CHECKLIST'};
  const result=classifyCommercialRows(sheet([a]),sheet([...previous,otherCustomer,future,checklist]));
  assert.equal(result.cancellations.length,1);assert.equal(result.serviceOrderRows,10);
  const detail=result.cancellations[0].detail;
  assert.equal(detail.availableOrders,7);assert.equal(detail.orders.length,5);
  assert.equal(detail.orders[0].serviceReport,'Tratamento 7');assert.equal(detail.orders[4].serviceReport,'Tratamento 3');
  assert.ok(!JSON.stringify(detail).includes('SEGREDO'));assert.match(detail.openingReport,/quedas/);
});

test('OS diretamente vinculada pode concluir depois do atendimento, sem anexar futuro de outro protocolo',()=>{
  const a={...attendance,tipo_atendimento:'CANCELAMENTO',descricao_fechamento:'O cancelamento foi efetivado.'};
  const o={...order,tipo_ordem_servico:'RETIRADA',data_cadastro:'03/11/2026',data_inicio_executado:'04/11/2026 09:00:00',data_termino_executado:'04/11/2026 10:00:00'};
  const result=classifyCommercialRows(sheet([a]),sheet([o]));
  assert.equal(result.cancellations[0].detail.orders.length,1);assert.equal(result.cancellations[0].detail.orders[0].linkedToCancellation,true);
  assert.equal(result.cancellations[0].date.getMonth(),9);
});

test('corte mantém hora informada e não modifica objetos Date recebidos da planilha',()=>{
  const created=new Date(2026,9,10,12,0,0), original=created.getTime();
  const a={...attendance,tipo_atendimento:'CANCELAMENTO',data_cadastro:created,data_fechamento:'',descricao_fechamento:'O cancelamento foi efetivado.'};
  const before={...order,id_atendimento:'999',tipo_ordem_servico:'SUPORTE',data_cadastro:'10/10/2026 11:00',data_inicio_executado:'10/10/2026 11:00',data_termino_executado:'10/10/2026 11:30'};
  const after={...before,id_ordem_servico:'202',numero_ordem_servico:'126',data_cadastro:'10/10/2026 13:00'};
  const r=classifyCommercialRows(sheet([a]),sheet([before,after]));
  assert.equal(created.getTime(),original);assert.equal(r.cancellations[0].date.getTime(),original);
  assert.equal(r.cancellations[0].detail.availableOrders,1);
});
