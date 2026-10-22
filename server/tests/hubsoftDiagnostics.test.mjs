import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHubsoft } from "../hubsoftAdapter.mjs";
import { HubsoftMappingError, safeHubsoftDiagnostic } from "../hubsoftDiagnostics.mjs";

const row = { protocolo: "123", nome_razaosocial: "CLIENTE_SIGILOSO", descricao_abertura: "DESCRICAO_SIGILOSA", tipo_atendimento: "Instalacao", data_cadastro: "2026-10-10 09:00:00", id_usuario_abertura: 999, password: "SEGREDO", arbitrary_customer_key: "NAO_EXIBIR" };
function diagnostic(kind, record, names) {
  try { normalizeHubsoft(kind, record, names); assert.fail("Expected mapping error"); }
  catch (error) { assert.ok(error instanceof HubsoftMappingError); return safeHubsoftDiagnostic(error); }
}
test("diagnostico identifica usuario nao resolvido sem incluir ID, registro ou credenciais", () => {
  assert.deepEqual(diagnostic("attendance", row), { kind: "attendance", missingFields: ["usuario_abertura"], invalidFields: [] });
  assert.equal(normalizeHubsoft("attendance", row, { 999: "Teste" }).usuario_abertura, "Teste");
});
test("diagnostico distingue campos ausentes de numero invalido e cobre OS", () => {
  assert.deepEqual(diagnostic("attendance", { ...row, protocolo: "VALOR_PRIVADO", descricao_abertura: " " }), {
    kind: "attendance", missingFields: ["descricao_abertura", "usuario_abertura"], invalidFields: ["protocolo"],
  });
  assert.deepEqual(diagnostic("serviceOrders", { numero: "1" }), {
    kind: "serviceOrders", missingFields: ["nome_razaosocial", "tipo_ordem_servico", "status", "data_inicio_programado"], invalidFields: [],
  });
});
test("formato de data invalido informa somente o nome do campo", () => {
  assert.deepEqual(diagnostic("attendance", { ...row, data_cadastro: "DATA_SIGILOSA" }), {
    kind: "attendance", missingFields: [], invalidFields: ["data_cadastro"],
  });
});
test("serializador permite apenas campos fixos e erros de mapeamento conhecidos", () => {
  assert.equal(safeHubsoftDiagnostic({ diagnostic: row }), undefined);
  const error = new HubsoftMappingError("TESTE", "attendance", ["usuario_abertura", "SEGREDO", "password", "usuario_abertura"]);
  error.row = row;
  assert.deepEqual(safeHubsoftDiagnostic(error), { kind: "attendance", missingFields: ["usuario_abertura"], invalidFields: [] });
  assert.equal(safeHubsoftDiagnostic(new HubsoftMappingError("TESTE", "SEGREDO", ["password"])), undefined);
});
