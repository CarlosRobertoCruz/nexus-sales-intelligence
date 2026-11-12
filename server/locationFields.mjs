const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function geographicText(value) {
  if (object(value)) value = value.nome ?? value.descricao ?? value.name;
  if (typeof value !== 'string') return '';
  const text=value.trim().replace(/\s+/g,' ');
  const key=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return text.length<=160&&!/^(?:|nao informad[oa]|sem bairro|sem cidade|n\/?a|-|\d+)$/.test(key)?text:'';
}
export function serviceIdentity(row) {
  const value=row?.id_cliente_servico ?? row?.cliente_servico?.id_cliente_servico;
  if(value===undefined||value===null||value==='')return '';
  if(typeof value==='number'&&!Number.isSafeInteger(value)||!/^\d{1,40}$/.test(String(value)))
    throw Object.assign(new Error('IDENTIFICADOR_INVALIDO'),{code:'IDENTIFICADOR_INVALIDO'});
  return String(value);
}
export function extractLocationFields(row) {
  const addresses=[row,row?.endereco_instalacao,row?.cliente_servico?.endereco_instalacao,
    row?.endereco_instalacao?.endereco_numero,row?.cliente_servico?.endereco_instalacao?.endereco_numero];
  const first=key=>addresses.map(address=>geographicText(address?.[key])).find(Boolean)??'';
  return {bairro:first('bairro'),cidade:first('cidade')};
}
export function projectInstallationAddress(address) {
  if(!object(address))return undefined;
  const result={};
  for(const key of ['bairro','cidade']) if(address[key]!==undefined)result[key]=geographicText(address[key]);
  if(object(address.endereco_numero)) {
    result.endereco_numero={};
    if(address.endereco_numero.bairro!==undefined)result.endereco_numero.bairro=geographicText(address.endereco_numero.bairro);
    if(address.endereco_numero.cidade!==undefined)result.endereco_numero.cidade={nome:geographicText(address.endereco_numero.cidade)};
  }
  return result;
}
