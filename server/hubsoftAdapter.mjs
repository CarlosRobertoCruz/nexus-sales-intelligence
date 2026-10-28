import { HubsoftError } from "./hubsoft.mjs";
import { HubsoftMappingError, requireHubsoftFields } from "./hubsoftDiagnostics.mjs";
function pick(row, ...paths) {
  for (const path of paths) {
    const val = path.split(".").reduce((o, k) => o?.[k], row);
    if (typeof val === "string" || typeof val === "number") {
      if (String(val).trim()) return String(val);
    }
  }
  return "";
}
export function apiDate(value) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return value;
  const m = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/,
  );
  if (!m) throw new HubsoftError("HUBSOFT_DATA_NAO_RECONHECIDA");
  return `${m[3]}/${m[2]}/${m[1]} ${m[4] ?? "00"}:${m[5] ?? "00"}`;
}
function diagnosticDate(kind, field, value) {
  try { return apiDate(value); }
  catch { throw new HubsoftMappingError("HUBSOFT_DATA_NAO_RECONHECIDA", kind, [], [field]); }
}
export function normalizeHubsoft(kind, row, userNames = {}) {
  let clientCode = pick(
    row,
    "codigo_cliente",
    "cliente.codigo_cliente",
    "cliente_servico.cliente.codigo_cliente",
  );
  let customer = pick(
    row,
    "nome_razaosocial",
    "cliente.nome_razaosocial",
    "cliente_servico.cliente.nome_razaosocial",
    "cliente",
  );
  // The OS list documents cliente as a display string, unlike attendance's nested client.
  if (kind === "serviceOrders" && typeof row.cliente === "string") {
    const display = row.cliente.match(/^(\d+)\s*-\s*(.+)$/);
    if (display) {
      clientCode ||= display[1];
      customer = display[2];
    }
  }
  const location = {
    bairro: pick(
      row,
      "bairro",
      "endereco_instalacao.bairro",
      "cliente_servico.endereco_instalacao.bairro",
      "cliente_servico.endereco_instalacao.endereco_numero.bairro",
    ),
    cidade: pick(
      row,
      "cidade",
      "endereco_instalacao.cidade",
      "cliente_servico.endereco_instalacao.cidade",
      "cliente_servico.endereco_instalacao.endereco_numero.cidade.nome",
    ),
  };
  if (kind === "attendance") {
    const protocol = pick(row, "protocolo");
    const messages = Array.isArray(row.atendimento_mensagem)
      ? row.atendimento_mensagem
          .map((m) => pick(m, "mensagem", "descricao"))
          .filter(Boolean)
          .join("\n")
      : "";
    const description = pick(row, "descricao_abertura") || messages;
    const user =
      userNames[String(row.id_usuario_abertura)] ||
      pick(
        row,
        "usuario_abertura.name",
        "usuario_abertura.nome",
        "usuario_abertura",
        "usuario.name",
        "usuario.nome",
      );
    const type = pick(
      row,
      "tipo_atendimento.descricao",
      "tipo_atendimento.nome",
      "tipo_atendimento",
    );
    const date = diagnosticDate(kind, "data_cadastro", pick(row, "data_cadastro_br", "data_cadastro"));
    requireHubsoftFields("HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES", kind, {
      protocolo: protocol, nome_razaosocial: customer, descricao_abertura: description,
      usuario_abertura: user, tipo_atendimento: type, data_cadastro: date,
    }, ["protocolo"]);
    return {
      ...(row.id_atendimento != null ? { id_atendimento:String(row.id_atendimento) } : {}),
      protocolo: protocol,
      nome_razaosocial: customer,
      codigo_cliente: clientCode,
      descricao_abertura: description,
      descricao_fechamento: pick(row, "descricao_fechamento"),
      data_cadastro: date,
      usuario_abertura: user,
      status: pick(row, "status.descricao", "status.nome", "status"),
      tipo_atendimento: type,
      quantidade_os: pick(row, "ordem_servico_count", "quantidade_os"),
      ...location,
    };
  }
  const number = pick(row, "numero", "numero_ordem_servico");
  const type = pick(
    row,
    "tipo",
    "tipo_ordem_servico.descricao",
    "tipo_ordem_servico",
  );
  const status = pick(row, "status.descricao", "status.nome", "status");
  const date = diagnosticDate(kind, "data_inicio_programado", pick(row, "data_inicio_programado"));
  requireHubsoftFields("HUBSOFT_OS_CAMPOS_INSUFICIENTES", kind, {
    numero_ordem_servico: number, nome_razaosocial: customer, tipo_ordem_servico: type,
    status, data_inicio_programado: date,
  }, ["numero_ordem_servico"]);
  return {
    ...(row.id_ordem_servico != null ? {id_ordem_servico:String(row.id_ordem_servico)} : {}),
    ...(pick(row,"usuario_abertura") ? {usuario_abertura:pick(row,"usuario_abertura")} : {}),
    ...((row.id_atendimento ?? row.atendimento?.id_atendimento) != null ? {id_atendimento:String(row.id_atendimento ?? row.atendimento.id_atendimento)} : {}),
    ...(row.data_cadastro ? {data_cadastro:diagnosticDate(kind,"data_inicio_programado",row.data_cadastro)} : {}),
    numero_ordem_servico: number,
    tipo_ordem_servico: type,
    status,
    data_inicio_programado: date,
    data_inicio_executado: diagnosticDate(kind, "data_inicio_executado", pick(row, "data_inicio_executado")),
    data_termino_executado: diagnosticDate(kind, "data_termino_executado", pick(row, "data_termino_executado")),
    codigo_cliente: clientCode,
    nome_razaosocial: customer,
    descricao_abertura: pick(row, "descricao_abertura"),
    descricao_servico: pick(row, "descricao_servico"),
    descricao_fechamento: pick(row, "descricao_fechamento"),
    ...location,
  };
}
