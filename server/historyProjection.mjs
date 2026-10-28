// Somente campos usados pelo adaptador e pela reconciliação entram no staging.
// Não guardar CPF, email, telefone, credenciais, parâmetros livres ou payload arbitrário.
export function projectHistoryRecord(row,embedded=true) {
  const names=['id_atendimento','id_ordem_servico','protocolo','numero','numero_ordem_servico','codigo_cliente','nome_razaosocial',
    'descricao_abertura','descricao_servico','descricao_fechamento','data_cadastro','data_cadastro_br','data_fechamento',
    'data_ultima_alteracao','updated_at','data_inicio_programado','data_termino_programado','data_inicio_executado','data_termino_executado',
    'usuario_abertura','id_usuario_abertura','status','tipo','tipo_atendimento','tipo_ordem_servico','ordem_servico_count','quantidade_os','bairro','cidade','deleted_at','rascunho'];
  const result=Object.fromEntries(names.filter(name=>row[name]!==undefined).map(name=>[name,row[name]]));
  for(const name of ['usuario_abertura','status','tipo_atendimento','tipo_ordem_servico']) if(result[name]&&typeof result[name]==='object') {
    const selected=name==='usuario_abertura'?['name','nome']:['descricao','nome','prefixo'];
    result[name]=Object.fromEntries(selected.filter(key=>typeof result[name][key]==='string').map(key=>[key,result[name][key]]));
  }
  if(row.cliente) result.cliente=typeof row.cliente==='string'?row.cliente:{codigo_cliente:row.cliente.codigo_cliente,nome_razaosocial:row.cliente.nome_razaosocial};
  if(row.cliente_servico) result.cliente_servico={cliente:row.cliente_servico.cliente?{codigo_cliente:row.cliente_servico.cliente.codigo_cliente,nome_razaosocial:row.cliente_servico.cliente.nome_razaosocial}:undefined,
    endereco_instalacao:projectAddress(row.cliente_servico.endereco_instalacao)};
  if(row.endereco_instalacao) result.endereco_instalacao=projectAddress(row.endereco_instalacao);
  if(row.atendimento) result.atendimento={id_atendimento:row.atendimento.id_atendimento,protocolo:row.atendimento.protocolo};
  if(Array.isArray(row.atendimento_mensagem)) result.atendimento_mensagem=row.atendimento_mensagem.map(m=>({mensagem:m.mensagem,descricao:m.descricao}));
  if(embedded&&Array.isArray(row.ordens_servico)) result.ordens_servico=row.ordens_servico.map(os=>projectHistoryRecord(os,false));
  return result;
}
function projectAddress(address) { return address?{bairro:address.bairro,cidade:address.cidade,endereco_numero:address.endereco_numero?{bairro:address.endereco_numero.bairro,cidade:address.endereco_numero.cidade?{nome:address.endereco_numero.cidade.nome}:undefined}:undefined}:undefined; }
