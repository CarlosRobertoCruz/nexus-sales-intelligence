// Apenas nomes conhecidos; nunca apresentar valores ou texto arbitrario da API.
const FIELDS: Record<string, readonly string[]> = {
  attendance: ["protocolo", "nome_razaosocial", "descricao_abertura", "usuario_abertura", "tipo_atendimento", "data_cadastro"],
  serviceOrders: ["numero_ordem_servico", "nome_razaosocial", "tipo_ordem_servico", "status", "data_inicio_programado", "data_inicio_executado", "data_termino_executado"],
};
export function hubsoftDiagnosticMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const d = value as Record<string, unknown>;
  if (d.kind !== "attendance" && d.kind !== "serviceOrders") return "";
  const fields = FIELDS[d.kind];
  const names = (values: unknown) => fields.filter((field) => Array.isArray(values) && values.includes(field));
  const missing = names(d.missingFields), invalid = names(d.invalidFields);
  if (!missing.length && !invalid.length) return "";
  const parts = [d.kind === "attendance" ? "Diagnóstico do atendimento." : "Diagnóstico da OS."];
  if (missing.length) parts.push(`Campos ausentes ou vazios: ${missing.join(", ")}.`);
  if (invalid.length) parts.push(`Campos com formato inválido: ${invalid.join(", ")}.`);
  if (missing.includes("usuario_abertura")) parts.push("O nome de quem abriu o atendimento não foi resolvido. Confira a relação ou o mapeamento local; o diagnóstico não expõe o ID.");
  parts.push("A página não foi gravada e o ponto de retomada foi preservado.");
  return parts.join(" ");
}
