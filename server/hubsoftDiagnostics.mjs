import { HubsoftError } from "./hubsoft.mjs";

const FIELDS = {
  attendance: ["protocolo", "nome_razaosocial", "descricao_abertura", "usuario_abertura", "tipo_atendimento", "data_cadastro"],
  serviceOrders: ["numero_ordem_servico", "nome_razaosocial", "tipo_ordem_servico", "status", "data_inicio_programado", "data_inicio_executado", "data_termino_executado"],
};

export class HubsoftMappingError extends HubsoftError {
  constructor(code, kind, missingFields = [], invalidFields = []) {
    super(code);
    this.diagnostic = { kind, missingFields, invalidFields };
  }
}

// Nunca serializar o erro inteiro nem chaves/valores recebidos da Hubsoft.
export function safeHubsoftDiagnostic(error) {
  if (!(error instanceof HubsoftMappingError)) return undefined;
  const d = error.diagnostic;
  if (d?.kind !== "attendance" && d?.kind !== "serviceOrders") return undefined;
  const allowed = FIELDS[d.kind];
  const names = (values) => allowed.filter((field) => Array.isArray(values) && values.includes(field));
  return { kind: d.kind, missingFields: names(d.missingFields), invalidFields: names(d.invalidFields) };
}

export function requireHubsoftFields(code, kind, values, numericFields = []) {
  const missing = Object.entries(values).filter(([, value]) => !value).map(([field]) => field);
  const invalid = numericFields.filter((field) => values[field] && !/^\d+$/.test(values[field]));
  if (missing.length || invalid.length) throw new HubsoftMappingError(code, kind, missing, invalid);
}
