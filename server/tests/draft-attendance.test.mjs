import test from 'node:test';
import assert from 'node:assert/strict';
import {isAbandonedAttendanceDraft} from '../historyDrafts.mjs';
import {normalizeHubsoft} from '../hubsoftAdapter.mjs';

const base={id_atendimento:'101',protocolo:'202610010001',data_cadastro:'01/10/2026',cliente:{codigo_cliente:12,nome_razaosocial:'Cliente teste'},usuario_abertura:'Beatriz',descricao_abertura:'',tipo_atendimento:'',ordem_servico_count:0};

test('somente rascunho sem conteudo e sem OS e descartado dos indicadores',()=>{
  assert.equal(isAbandonedAttendanceDraft({...base,rascunho:'Sim'}),true);
  assert.equal(isAbandonedAttendanceDraft({...base,rascunho:'Sim',ordem_servico_count:1}),false);
  assert.equal(isAbandonedAttendanceDraft({...base,rascunho:'Sim',descricao_abertura:'Retorno solicitado'}),false);
  assert.equal(isAbandonedAttendanceDraft({...base,rascunho:'Nao'}),false);
  const normalized=normalizeHubsoft('attendance',{...base,rascunho:'Sim'},{},{allowIncompleteBusinessFields:true});
  assert.equal(normalized.classification_status,'discarded_draft');
  assert.equal(normalized.classification_reason,'abandoned_draft');
  assert.equal(normalized.rascunho,'sim');
});
