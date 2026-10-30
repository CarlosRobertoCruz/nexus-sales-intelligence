import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAttendanceDetail} from '../historyAttendanceDetail.mjs';
import {normalizeHubsoft} from '../hubsoftAdapter.mjs';

const primary={id_atendimento:'101',protocolo:'202610010001',data_cadastro:'01/10/2026',cliente:{codigo_cliente:12,nome_razaosocial:'Cliente teste'},
  descricao_abertura:null,tipo_atendimento:{id_tipo_atendimento:1},usuario_abertura:null};
const detail={...primary,descricao_abertura:'Instalação solicitada',tipo_atendimento:'INSTALAÇÃO',usuario_abertura:'Beatriz'};

test('complemento preenche descrição, tipo e nome de abertura quando ausentes na listagem',()=>{
  const snapshot=structuredClone(primary);
  const merged=mergeAttendanceDetail(primary,detail);
  const result=normalizeHubsoft('attendance',merged);
  assert.equal(result.descricao_abertura,detail.descricao_abertura);
  assert.equal(result.tipo_atendimento,detail.tipo_atendimento);
  assert.equal(result.usuario_abertura,'Beatriz');
  assert.deepEqual(primary,snapshot,'a página original não é alterada');
});
test('descrição e tipo preenchidos na listagem são preservados, incluindo objetos com descrição',()=>{
  const raw={...primary,descricao_abertura:'Descrição original',tipo_atendimento:{descricao:'Tipo original'},usuario_abertura:'Pessoa original'};
  const result=mergeAttendanceDetail(raw,{...detail,usuario_abertura:'  '});
  assert.equal(result.descricao_abertura,'Descrição original');
  assert.deepEqual(result.tipo_atendimento,{descricao:'Tipo original'});
  assert.equal(result.usuario_abertura,'Pessoa original','complemento vazio não apaga nome existente');
});
test('merge não troca identidade, data, cliente ou relações e aceita campos textuais com espaços vazios',()=>{
  const raw={...primary,descricao_abertura:'  ',tipo_atendimento:{descricao:''},ordens_servico:[]};
  const result=mergeAttendanceDetail(raw,{...detail,id_atendimento:'999',protocolo:'999',data_cadastro:'02/10/2026',cliente:{codigo_cliente:999},ordens_servico:[{}]});
  for(const field of ['id_atendimento','protocolo','data_cadastro','cliente','ordens_servico']) assert.deepEqual(result[field],raw[field]);
  assert.equal(result.descricao_abertura,detail.descricao_abertura);
  assert.equal(result.tipo_atendimento,detail.tipo_atendimento);
});
test('ausência nas duas respostas continua sendo erro, sem substituir por responsável ou rótulo inventado',()=>{
  const result=mergeAttendanceDetail(primary,{...primary,usuario_responsavel:'Não usar'});
  assert.throws(()=>normalizeHubsoft('attendance',result),error=>{
    assert.deepEqual(error.diagnostic.missingFields,['descricao_abertura','usuario_abertura','tipo_atendimento']);return true;
  });
});

test('normalização histórica pode preservar campos de negócio vazios com pendência explícita',()=>{
  const result=normalizeHubsoft('attendance',{...primary,usuario_abertura:'Beatriz'},{},{allowIncompleteBusinessFields:true});
  assert.equal(result.classification_status,'incomplete');
  assert.equal(result.quality_missing_fields,'descricao_abertura,tipo_atendimento');
  assert.equal(result.descricao_abertura,'');assert.equal(result.tipo_atendimento,'');
  assert.equal(result.protocolo,primary.protocolo);
  const complete=normalizeHubsoft('attendance',detail,{},{allowIncompleteBusinessFields:true});
  assert.equal(complete.classification_status,undefined);
});
test('identidade, cliente, data e usuário não são dispensados pelo modo de campos incompletos',()=>{
  assert.throws(()=>normalizeHubsoft('attendance',primary,{},{allowIncompleteBusinessFields:true}),error=>{
    assert.deepEqual(error.diagnostic.missingFields,['usuario_abertura']);return true;
  });
  assert.throws(()=>normalizeHubsoft('attendance',{...detail,protocolo:''},{},{allowIncompleteBusinessFields:true}),/CAMPOS_INSUFICIENTES/);
  assert.throws(()=>normalizeHubsoft('attendance',{...detail,data_cadastro:null},{},{allowIncompleteBusinessFields:true}),/CAMPOS_INSUFICIENTES/);
});
