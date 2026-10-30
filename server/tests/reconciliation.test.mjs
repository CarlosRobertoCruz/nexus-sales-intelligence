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
test('manifesto permite piloto de coleta com referência de acompanhamento pendente, sem publicar automaticamente',()=>{
  const m={year:2026,phase:'day',peakDay:'2026-10-01',cutoff:'2026-10-01',followupCutoff:'2026-10-28',osDateField:'data_termino_executado',maxCalls:500,
    reports:{attendance:{...reference,keyField:'protocolo',exportedAt:'2026-10-29',filters:{dateField:'data_cadastro',otherFilters:'none',addressType:'instalacao'}},
    serviceOrders:{...reference,exportedAt:'2026-10-29',exportFilters:{dateField:'data_cadastro'}},followup:{pending:true,filters:{dateField:'data_cadastro',otherFilters:'none',relationship:'id_atendimento',followupCutoff:'2026-10-28'}}}};
  assert.equal(validateManifest(m,'2026-10-29').phase,'day');
  assert.throws(()=>validateManifest({...m,autoPublish:true},'2026-10-29'),/REFERENCIA_PENDENTE_NAO_PERMITIDA/);
  assert.throws(()=>validateManifest({...m,reports:{...m.reports,attendance:{...m.reports.attendance,keyField:'nome_razaosocial'}}},'2026-10-29'),/IDENTIDADE/);
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
