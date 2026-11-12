import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalLocation,locationInAddress,mapCommercialLocations,normalizeLocationMetrics,classifyCommercialRows} from '../../server-dist/commercial.js';
import {extractLocationFields} from '../locationFields.mjs';
import {projectHistoryRecord} from '../historyProjection.mjs';
import {normalizedAttendanceDetail} from '../historyNormalization.mjs';
import {normalizeHubsoft} from '../hubsoftAdapter.mjs';

const sheet=rows=>{const headers=[...new Set(rows.flatMap(Object.keys))];return {fileName:'ficticio',rows:[headers,...rows.map(row=>headers.map(key=>row[key]??null))]};};
const attendance={id_atendimento:'101',protocolo:'202510010001',codigo_cliente:'12',nome_razaosocial:'Cliente ficticio',
  data_cadastro:'01/10/2025',descricao_abertura:'Instalação 600 Mega Combo Plus',usuario_abertura:'Beatriz',status:'Resolvido',tipo_atendimento:'INSTALAÇÃO'};
const order={id_ordem_servico:'201',numero_ordem_servico:'201',id_atendimento:'101',codigo_cliente:'12',nome_razaosocial:'Cliente ficticio',
  tipo_ordem_servico:'INSTALAÇÃO',status:'Finalizado',data_inicio_programado:'02/10/2025 09:00',data_inicio_executado:'02/10/2025 09:00',data_termino_executado:'02/10/2025 10:00'};
const metric=(location,sales)=>({location,sales,renewals:0,cancellations:0});

test('catalogo normaliza bairros fornecidos, prefixos, acentos e sublocalidades sem confundir Sahy',()=>{
  for(const [value,wanted] of [
    ['01.Muriqui (23)','Muriqui'],[' VILA MURIQUI ','Muriqui'],['02.Praia Grande (4)','Praia Grande'],
    ['03.Sahy (Condomínios) (6)','Sahy (Condomínios)'],['05.Sahy (Bairro) (4)','Sahy (Bairro)'],['SAHY','Sahy'],
    ['04.Cunhambebe (3)','Muriqui'],['Cachoeira de Muriqui','Muriqui'],['Cunhambe','Muriqui'],['Cachoeira','Muriqui'],['Cunhambebe - Cachoeira - Muriqui','Muriqui'],['Cunhambebe (Muriqui)','Muriqui'],
    ['06.Praia Pequena (3)','Praia Pequena'],['07.Praia Brava (2)','Praia Brava'],['08.Apara (2)','Apara'],
    ['Praia do Apara','Apara'],['09.Ibicui (4)','Ibicuí'],['10.Centro (5)','Centro'],['11.Praia do Saco (6)','Praia do Saco'],
    ['JUNQUEIRA (SANTO ANTÔNIO) (5)','Junqueira (Santo Antônio)'],['Santo Antonio','Junqueira (Santo Antônio)']
  ])assert.equal(canonicalLocation(value),wanted,value);
  assert.equal(canonicalLocation('Backbone2'),undefined);
  assert.equal(canonicalLocation('Centro','Angra dos Reis'),'Centro (Angra dos Reis)');
  assert.equal(canonicalLocation('Cunhambebe','Angra dos Reis'),'Cunhambebe (Angra dos Reis)');
});

test('endereco textual exige contexto, aceita OS e rejeita conversa e localidades conflitantes',()=>{
  assert.equal(locationInAddress('Endereço: Rua de teste, Vila Muriqui - Mangaratiba/RJ'),'Muriqui');
  assert.equal(locationInAddress('Bairro: Santo Antônio\nReferência: teste'),'Junqueira (Santo Antônio)');
  assert.equal(locationInAddress('Bairro: Sahy (Condomínios)'),'Sahy (Condomínios)');
  assert.equal(locationInAddress('Bairro: Sahy'),'Sahy');
  assert.equal(locationInAddress('Endereço: Rua Santo Antônio, 10, Mangaratiba/RJ'),undefined);
  assert.equal(locationInAddress('Endereço: Rua Santo Antônio, 10, Muriqui - Mangaratiba/RJ'),'Muriqui');
  assert.equal(locationInAddress('Endereço: Cachoeira de Muriqui'),'Muriqui');
  assert.equal(locationInAddress('Cliente ouviu falar em Muriqui. Equipe de Ibicuí.'),undefined);
  assert.equal(locationInAddress('Bairro: Muriqui\nBairro: Ibicuí'),undefined);
  assert.equal(locationInAddress('Endereço: Rua ficticia, Muriqui ou Ibicuí'),undefined);
});

test('extracao reconhece objetos, ignora placeholders e preserva so bairro/cidade e identidade do servico',()=>{
  const raw={...attendance,cliente:{codigo_cliente:'12',nome_razaosocial:'Ficticio',cpf_cnpj:'NAO_PERSISTIR'},bairro:'-',
    cliente_servico:{id_cliente_servico:'00077',senha:'NAO_PERSISTIR',endereco_instalacao:{
      bairro:{nome:'Vila Muriqui',cpf:'NAO_PERSISTIR'},cidade:{nome:'Mangaratiba'},endereco:'NAO_PERSISTIR',
      endereco_numero:{bairro:{descricao:'Vila Muriqui'},cidade:{nome:'Mangaratiba',email:'NAO_PERSISTIR'}}}}};
  const projected=projectHistoryRecord(raw);
  assert.deepEqual(extractLocationFields(raw),{bairro:'Vila Muriqui',cidade:'Mangaratiba'});
  assert.equal(projected.bairro,'Vila Muriqui');assert.equal(projected.id_cliente_servico,'00077');
  assert.equal(JSON.stringify(projected).includes('NAO_PERSISTIR'),false);
  assert.equal(JSON.stringify(projectHistoryRecord({bairro:{segredo:'NAO_PERSISTIR'},cidade:{segredo:'NAO_PERSISTIR'}})).includes('NAO_PERSISTIR'),false);
  const row=normalizeHubsoft('attendance',projected);
  assert.equal(row.bairro,'Vila Muriqui');assert.equal(row.cidade,'Mangaratiba');assert.equal(row.id_cliente_servico,'00077');
  assert.deepEqual(extractLocationFields({cliente_servico:{endereco_instalacao:{endereco_numero:{bairro:{nome:'Sahy'},cidade:{nome:'Mangaratiba'}}}}}),{bairro:'Sahy',cidade:'Mangaratiba'});
});

test('merge recupera geografia da listagem validada sem trocar servico, cliente, datas nem bairro existente',()=>{
  const detail={...attendance,cliente:{codigo_cliente:'12',nome_razaosocial:'Ficticio'},id_cliente_servico:'77'};
  const list={...detail,bairro:'Vila Muriqui',cidade:'Mangaratiba'};
  const snapshot=JSON.stringify(list);
  const row=normalizedAttendanceDetail(detail,list,'12','2025-10-01');
  assert.equal(row.bairro,'Vila Muriqui');assert.equal(row.cidade,'Mangaratiba');assert.equal(row.data_cadastro,'01/10/2025');
  assert.equal(JSON.stringify(list),snapshot);
  assert.equal(normalizedAttendanceDetail({...detail,bairro:'Ibicuí'},list,'12','2025-10-01').bairro,'Ibicuí');
  assert.throws(()=>normalizedAttendanceDetail(detail,{...list,id_cliente_servico:'78'},'12','2025-10-01'),/HUBSOFT_SERVICO_DIVERGENTE/);
  assert.throws(()=>normalizedAttendanceDetail(detail,{...list,id_atendimento:'102'},'12','2025-10-01'),/HUBSOFT_ATENDIMENTO_ID_DIVERGENTE/);
});

test('venda usa OS exata e normaliza endereco sem mudar identidade, mes ou contagens',()=>{
  const fromOs=classifyCommercialRows(sheet([{...attendance,bairro:'Vila Muriqui'}]),sheet([{...order,bairro:'Praia do Apara'}]));
  assert.equal(fromOs.sales[0].location,'Apara');assert.equal(fromOs.sales.length,1);
  const textual=classifyCommercialRows(sheet([attendance]),sheet([{...order,descricao_servico:'Endereço: Rua ficticia, Junqueira (Santo Antônio)'}]));
  assert.equal(textual.sales[0].location,'Junqueira (Santo Antônio)');
  assert.equal(textual.sales[0].id,fromOs.sales[0].id);assert.equal(textual.sales[0].date.toISOString(),fromOs.sales[0].date.toISOString());
  const unknown=classifyCommercialRows(sheet([attendance]),sheet([{...order,descricao_servico:'Equipe da Muriqui foi acionada'}]));
  assert.equal(unknown.sales[0].location,'Não informada');assert.equal(unknown.sales.length,1);
  const cityOnly=classifyCommercialRows(sheet([{...attendance,bairro:'Cachoeira'}]),sheet([{...order,cidade:'Mangaratiba'}]));
  assert.equal(cityOnly.sales[0].location,'Muriqui');
  const described=classifyCommercialRows(sheet([{...attendance,cidade:'Mangaratiba',descricao_abertura:attendance.descricao_abertura+'\nBairro: Muriqui'}]),sheet([order]));
  assert.equal(described.sales[0].location,'Muriqui');
});

test('mapa nao inventa ponto para 90 desconhecidos e conserva 91 vendas no total',()=>{
  const metrics=normalizeLocationMetrics([metric('Não informada',90),metric('VILA MURIQUI',1)]);
  assert.equal(metrics.reduce((sum,m)=>sum+m.sales,0),91);
  const mapped=mapCommercialLocations(metrics);
  assert.equal(mapped.length,1);assert.equal(mapped[0].location,'Muriqui');assert.equal(mapped[0].sales,1);
  assert.equal(mapCommercialLocations([metric('Localidade não informada',90),metric('Bairro sem coordenadas',5),metric('Backbone2',1)]).length,0);
  assert.equal(mapped[0].approximate,true);
});

test('aliases de Muriqui somam no ranking; apenas os subtipos do Sahy permanecem separados',()=>{
  const metrics=normalizeLocationMetrics([metric('Cunhambebe',1),metric('Cachoeira',1),metric('Cunhambe',1),metric('Muriqui',2),metric('Sahy (Bairro)',4),metric('Sahy (Condomínios)',6),metric('Sahy',1)]);
  assert.equal(metrics.length,4);assert.equal(metrics.reduce((sum,m)=>sum+m.sales,0),16);
  assert.equal(metrics.find(m=>m.location==='Muriqui').sales,5);
  const mapped=mapCommercialLocations(metrics);
  assert.equal(mapped.find(m=>m.location==='Muriqui').sales,5);
  assert.equal(mapped.find(m=>m.location==='Sahy').sales,11);
  assert.equal(mapped.reduce((sum,m)=>sum+m.sales,0),16);
});
