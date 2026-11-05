import test from 'node:test';
import assert from 'node:assert/strict';
import {compareHistoryReport} from '../historyReconciliation.mjs';
import {validateManifest} from '../historyPolicy.mjs';

const reference={fileSha256:'a'.repeat(64),keyField:'numero_ordem_servico',keys:['74','96'],filters:{dateField:'data_termino_executado',otherFilters:'none'}};
const evidence={reportSha256:reference.fileSha256,keys:['74','96']};
const rows=[{upstream_id:'78',payload:{numero_ordem_servico:'74'}},{upstream_id:'102',payload:{numero_ordem_servico:'96'}}];

test('conferência relaciona número com ID sem supor que sejam iguais',()=>{
  const result=compareHistoryReport('serviceOrders',rows,evidence,reference);
  assert.equal(result.status,'matched');
  assert.deepEqual(result.mapping,[{key:'74',id:'78'},{key:'96',id:'102'}]);
  const attendance={...reference,keyField:'protocolo',keys:['202610010001']};
  assert.deepEqual(compareHistoryReport('attendance',[{upstream_id:'110',payload:{protocolo:'202610010001'}}],{reportSha256:reference.fileSha256,keys:attendance.keys},attendance).mapping,[{key:'202610010001',id:'110'}]);
});
test('registros ausentes, extras e números ambíguos são separados',()=>{
  const result=compareHistoryReport('serviceOrders',[rows[0],{upstream_id:'999',payload:{numero_ordem_servico:'74'}},{upstream_id:'333',payload:{numero_ordem_servico:'200'}}],evidence,reference);
  assert.equal(result.status,'divergent');
  assert.deepEqual(result.missing,['96']);assert.deepEqual(result.extra,['200']);
  assert.deepEqual(result.ambiguous,[{key:'74',ids:['78','999']}]);assert.deepEqual(result.mapping,[]);
});
test('mesmo quando números conferem, cadastro não comprova a população de conclusões',()=>{
  const result=compareHistoryReport('serviceOrders',rows,evidence,{...reference,exportFilters:{dateField:'data_cadastro'}});
  assert.equal(result.status,'blocked');assert.equal(result.blocker,'ESCOPO_RELATORIO_NAO_COMPARAVEL');
  assert.equal(result.mapping.length,2,'mapeamento ainda serve para diagnóstico');
});
test('não aceita trocar a lista vinculada ao relatório, duplicar chaves ou perder precisão',()=>{
  assert.throws(()=>compareHistoryReport('serviceOrders',rows,{...evidence,keys:['74']},reference),/REFERENCIA_RELATORIO/);
  assert.throws(()=>compareHistoryReport('serviceOrders',rows,{...evidence,reportSha256:'b'.repeat(64)},reference),/EVIDENCIA/);
  assert.throws(()=>compareHistoryReport('serviceOrders',rows,{...evidence,keys:['74','74']},reference),/DUPLICADAS/);
  assert.throws(()=>compareHistoryReport('serviceOrders',rows,{...evidence,keys:[9007199254740992]},reference),/IDENTIFICADOR/);
  assert.throws(()=>compareHistoryReport('serviceOrders',[rows[0],rows[0]],evidence,reference),/ID_ORIGEM_DUPLICADO/);
});
test('manifesto permite coleta diária ou mensal com acompanhamento pendente, sem publicar automaticamente',()=>{
  const m={year:2026,phase:'day',peakDay:'2026-10-01',cutoff:'2026-10-01',followupCutoff:'2026-10-28',osDateField:'data_termino_executado',maxCalls:500,
    reports:{attendance:{...reference,keyField:'protocolo',exportedAt:'2026-10-29',filters:{dateField:'data_cadastro',otherFilters:'none',addressType:'instalacao'}},
    serviceOrders:{...reference,exportedAt:'2026-10-29',exportFilters:{dateField:'data_cadastro'}},followup:{pending:true,filters:{dateField:'data_cadastro',otherFilters:'none',relationship:'id_atendimento',followupCutoff:'2026-10-28'}}}};
  assert.equal(validateManifest(m,'2026-10-29').phase,'day');
  assert.throws(()=>validateManifest({...m,autoPublish:true},'2026-10-29'),/REFERENCIA_PENDENTE_NAO_PERMITIDA/);
  assert.throws(()=>validateManifest({...m,reports:{...m.reports,attendance:{...m.reports.attendance,keyField:'nome_razaosocial'}}},'2026-10-29'),/IDENTIDADE/);
  const october={...m,phase:'october',cutoff:'2026-10-31',followupCutoff:'2026-11-02',approvedDayJob:'11111111-1111-4111-8111-111111111111',
    reports:{...m.reports,followup:{pending:true,filters:{dateField:'data_cadastro',otherFilters:'none',relationship:'id_atendimento',followupCutoff:'2026-11-02'}}}};
  assert.equal(validateManifest(october,'2026-11-03').phase,'october');
  assert.throws(()=>validateManifest({...october,autoPublish:true},'2026-11-03'),/REFERENCIA_PENDENTE_NAO_PERMITIDA/);
});

test('exclusão comercial de checklist separa a pendência real, sem aprovar reconciliação bruta divergente',()=>{
  const ref={...reference,keys:['74','96','200','300'],commercialExclusions:{reason:'checklist',keys:['200']}};
  const result=compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:ref.keys},ref);
  assert.equal(result.status,'divergent');assert.equal(result.expected,4);assert.equal(result.actual,2);
  assert.deepEqual(result.missing,['200','300']);
  assert.equal(result.commercialScope.expected,3);assert.equal(result.commercialScope.actual,2);
  assert.deepEqual(result.commercialScope.missing,['300']);assert.deepEqual(result.commercialScope.excludedChecklistKeys,['200']);
  assert.equal(result.commercialScope.sourceReconciliationRequired,true);
});

test('checklist também coletado é preservado no volume bruto e retirado só do resumo comercial',()=>{
  const ref={...reference,commercialExclusions:{reason:'checklist',keys:['96']}};
  const result=compareHistoryReport('serviceOrders',rows,evidence,ref);
  assert.equal(result.actual,2);assert.equal(result.commercialScope.actual,1);assert.equal(result.status,'matched');
});

test('escopo de destino continua bloqueando mesmo com todos os números iguais',()=>{
  const result=compareHistoryReport('serviceOrders',rows,evidence,{...reference,collectionScope:{destination:'cliente_servico'},exportScope:{destination:'all'}});
  assert.equal(result.status,'blocked');assert.equal(result.blocker,'ESCOPO_DESTINO_NAO_COMPARAVEL');
});

test('não permite exceção comercial por suporte, chave inexistente, duplicada ou em atendimento',()=>{
  for(const exclusion of [{reason:'support',keys:['96']},{reason:'checklist',keys:['999']},{reason:'checklist',keys:['96','96']}]) {
    assert.throws(()=>compareHistoryReport('serviceOrders',rows,evidence,{...reference,commercialExclusions:exclusion}),/EXCLUSOES_COMERCIAIS_INVALIDAS/);
  }
  assert.throws(()=>compareHistoryReport('attendance',[],{reportSha256:reference.fileSha256,keys:[]},{...reference,keyField:'protocolo',keys:[],commercialExclusions:{reason:'checklist',keys:[]}}),/EXCLUSOES_COMERCIAIS_INVALIDAS/);
});

test('referências com exclusões inválidas são recusadas antes de atualizar o manifesto',()=>{
  const m={year:2026,phase:'day',peakDay:'2026-10-01',cutoff:'2026-10-01',osDateField:'data_termino_executado',maxCalls:500,
    reports:{attendance:{...reference,keyField:'protocolo',exportedAt:'2026-10-30',filters:{dateField:'data_cadastro',otherFilters:'none'}},
    serviceOrders:{...reference,exportedAt:'2026-10-30',commercialExclusions:{reason:'checklist',keys:['999']}}}};
  assert.throws(()=>validateManifest(m,'2026-10-30'),/EXCLUSOES_COMERCIAIS_INVALIDAS/);
});

const supportReview={key:'300',reason:'non_commercial_support',orderType:'(SFN) SUPORTE',destination:'SFNCONSULT',openedAt:'17/09/2026 13:42:10',completedAt:'01/10/2026 09:17:45',evidence:{kind:'user_provided_hubsoft_screenshots',reviewedOn:'2026-10-30'}};
test('revisão pontual explica suporte e checklists sem aprovar divergência da origem',()=>{
  const ref={...reference,keys:['74','96','200','300'],exportFilters:{dateField:'data_termino_executado',start:'2026-10-01',end:'2026-10-01'},collectionScope:{destination:'cliente_servico'},exportScope:{destination:'all'},
    commercialExclusions:{reason:'checklist',keys:['200']},scopeReview:{resolved:true,unassignedCustomerKeys:['300'],reviewedOrders:[supportReview]}};
  const result=compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:ref.keys},ref);
  assert.equal(result.commercialScope.expected,2);assert.equal(result.commercialScope.actual,2);assert.deepEqual(result.commercialScope.missing,[]);
  assert.deepEqual(result.commercialScope.reviewedOutOfScopeKeys,['300']);assert.deepEqual(result.missing,['200','300']);
  assert.equal(result.scopeReview.status,'explained_not_approved');assert.equal(result.scopeReview.publicationApproved,false);
  assert.equal(result.status,'matched');assert.equal(result.blocker,null);
  assert.equal(result.rawStatus,'divergent');assert.equal(result.rawBlocker,'ESCOPO_DESTINO_NAO_COMPARAVEL');
  const missingMore={...ref,keys:[...ref.keys,'400']};
  assert.equal(compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:missingMore.keys},missingMore).scopeReview.status,'pending');
});

test('revisão de suporte exige origem, destino não comercial, datas e chave específicos',()=>{
  for(const changes of [{destination:'cliente_servico'},{reason:'ignore'},{key:'999'},{completedAt:'02/10/2026 09:00:00'},{evidence:null}]) {
    const ref={...reference,keys:['74','96','300'],exportFilters:{dateField:'data_termino_executado',start:'2026-10-01',end:'2026-10-01'},scopeReview:{reviewedOrders:[{...supportReview,...changes}]}};
    assert.throws(()=>compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:ref.keys},ref),/REVISAO_ESCOPO_INVALIDA/);
  }
});

const reportTypedReference=()=>({...reference,keys:['74','96','200','300','400','500'],
  exportFilters:{dateField:'data_termino_executado',start:'2026-10-01',end:'2026-10-31'},
  commercialExclusions:{reason:'checklist',keys:['200']},
  reportTypeExclusions:{reason:'non_commercial_order_type',reportSha256:reference.fileSha256,orders:[
    {key:'300',orderType:'(SFN) SUPORTE',completedOn:'2026-10-01'},
    {key:'400',orderType:'MANUTENÇÃO',completedOn:'2026-10-14'},
    {key:'500',orderType:'ABERTURA DE CTO',completedOn:'2026-10-14'},
  ]}});

test('tipos técnicos documentados no relatório preservam divergência bruta e todas as chaves',()=>{
  const ref=reportTypedReference(),original=structuredClone(ref);
  const result=compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:ref.keys},ref);
  assert.equal(result.status,'matched');assert.equal(result.rawStatus,'divergent');
  assert.equal(result.expected,6);assert.equal(result.actual,2);
  assert.deepEqual(result.missing,['200','300','400','500']);
  assert.equal(result.commercialScope.expected,2);assert.equal(result.commercialScope.actual,2);
  assert.deepEqual(result.commercialScope.reportTypeExcludedKeys,['300','400','500']);
  assert.deepEqual(result.reportTypeReview.orders,ref.reportTypeExclusions.orders);
  assert.equal(result.reportTypeReview.publicationApproved,false);
  assert.deepEqual(ref,original,'conferência não altera o relatório nem cria aprovação');
});

test('exclusões técnicas não escondem OS comercial ausente, extra ou ambígua',()=>{
  const ref=reportTypedReference(),ev={reportSha256:ref.fileSha256,keys:ref.keys};
  assert.equal(compareHistoryReport('serviceOrders',[rows[0]],ev,ref).status,'divergent');
  assert.equal(compareHistoryReport('serviceOrders',[...rows,{upstream_id:'999',payload:{numero_ordem_servico:'700'}}],ev,ref).status,'divergent');
  assert.equal(compareHistoryReport('serviceOrders',[...rows,{upstream_id:'999',payload:{numero_ordem_servico:'74'}}],ev,ref).status,'divergent');
  const wrongDate={...ref,exportFilters:{...ref.exportFilters,dateField:'data_cadastro'}};
  assert.throws(()=>compareHistoryReport('serviceOrders',rows,ev,wrongDate),/EXCLUSOES_TIPO_RELATORIO_INVALIDAS/);
});

test('exclusão por tipo exige hash, tipo exato, data válida, chave única e ausência de sobreposição',()=>{
  const invalid=[
    ref=>{ref.reportTypeExclusions.reportSha256='b'.repeat(64);},
    ref=>{ref.reportTypeExclusions.reason='ignore';},
    ref=>{ref.reportTypeExclusions.orders=[];},
    ref=>{ref.reportTypeExclusions.orders.push(ref.reportTypeExclusions.orders[0]);},
    ref=>{ref.reportTypeExclusions.orders[0].key='999';},
    ref=>{ref.reportTypeExclusions.orders[0].key='200';},
    ref=>{ref.reportTypeExclusions.orders[0].completedOn='2026-11-01';},
    ref=>{ref.reportTypeExclusions.orders[0].completedOn='2026-10-32';},
    ref=>{ref.exportFilters.start='2026-10-32';},
    ...['INSTALAÇÃO','RETIRADA','CANCELAMENTO','REATIVAÇÃO DE CONTRATO','RENOVAÇÃO DE CONTRATO','SUPORTE INSTALAÇÃO','SUPORTE'].map(type=>ref=>{ref.reportTypeExclusions.orders[0].orderType=type;}),
  ];
  for(const change of invalid) {
    const ref=reportTypedReference();change(ref);
    assert.throws(()=>compareHistoryReport('serviceOrders',rows,{reportSha256:ref.fileSha256,keys:ref.keys},ref),/EXCLUSOES_TIPO_RELATORIO_INVALIDAS/);
  }
  const ref=reportTypedReference();ref.keyField='protocolo';
  assert.throws(()=>compareHistoryReport('attendance',[],{reportSha256:ref.fileSha256,keys:ref.keys},ref),/EXCLUSOES_COMERCIAIS_INVALIDAS|EXCLUSOES_TIPO_RELATORIO_INVALIDAS/);
});

test('tipo coletado que contradiz o relatório não pode ser excluído',()=>{
  const ref=reportTypedReference(),ev={reportSha256:ref.fileSha256,keys:ref.keys};
  assert.throws(()=>compareHistoryReport('serviceOrders',[...rows,{upstream_id:'333',payload:{numero_ordem_servico:'300',tipo_ordem_servico:'INSTALAÇÃO'}}],ev,ref),/TIPO_OS_RELATORIO_DIVERGENTE/);
  const result=compareHistoryReport('serviceOrders',[...rows,{upstream_id:'333',payload:{numero_ordem_servico:'400',tipo_ordem_servico:'manutencao'}}],ev,ref);
  assert.equal(result.status,'matched');assert.equal(result.actual,3);assert.equal(result.commercialScope.actual,2);
});
