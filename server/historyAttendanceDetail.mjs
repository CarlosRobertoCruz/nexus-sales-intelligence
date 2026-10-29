// Merge only supported business fields after the caller verifies the identity,
// client and opening day. Never overwrite identifiers, timestamps or relations.
function text(value) {
  return (typeof value==='string'||typeof value==='number')&&String(value).trim()!=='';
}
function meaningful(value,names) {
  return text(value)||Boolean(value&&typeof value==='object'&&names.some(name=>text(value[name])));
}
export function mergeAttendanceDetail(primary,detail) {
  const merged={...primary};
  if(!text(primary.descricao_abertura)&&text(detail.descricao_abertura)) merged.descricao_abertura=detail.descricao_abertura;
  if(!meaningful(primary.tipo_atendimento,['descricao','nome'])&&meaningful(detail.tipo_atendimento,['descricao','nome'])) merged.tipo_atendimento=detail.tipo_atendimento;
  // Prefer the verified detail's actual opening user. A blank complement must
  // not erase an opening user already present in the primary response.
  if(meaningful(detail.usuario_abertura,['name','nome'])) merged.usuario_abertura=detail.usuario_abertura;
  return merged;
}
