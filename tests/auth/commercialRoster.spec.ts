import { test, expect } from "@playwright/test";
import { classifyCommercialRows } from "../../src/apps/importacao/domain/classifyCommercialRows";
import { buildCommercialDashboard } from "../../src/apps/importacao/viewModel/buildCommercialDashboard";
import { getEmptySalesSnapshot } from "../../src/apps/vendas/services/salesService";
import { getEmptyTeamSnapshot } from "../../src/apps/equipeComercial/services/teamService";
import { buildLocationMetrics } from "../../src/apps/localidades/domain/buildLocationMetrics";
import type { ImportedWorksheet, SpreadsheetCell } from "../../src/apps/importacao/types/spreadsheetImport";

function sheet(rows: Record<string, SpreadsheetCell>[]): ImportedWorksheet {
  const headers = [...new Set(rows.flatMap(Object.keys))];
  return { fileName: "test", rows: [headers, ...rows.map(row => headers.map(key => row[key] ?? null))] };
}

function classifySeller(author: string, month: string) {
  const a = { id_atendimento: "101", protocolo: `2026${month}010001`, codigo_cliente: "12", nome_razaosocial: "Cliente de teste",
    descricao_abertura: "Instalação 600 Mega Combo Plus", descricao_fechamento: "", data_cadastro: `01/${month}/2026`,
    usuario_abertura: author, status: "Resolvido", tipo_atendimento: "INSTALAÇÃO" };
  const r = { ...a, id_atendimento: "102", protocolo: `2026${month}010002`, tipo_atendimento: "RENOVAÇÃO DE CONTRATO" };
  const o = { id_ordem_servico: "201", numero_ordem_servico: "125", id_atendimento: "101", codigo_cliente: "12", nome_razaosocial: "Cliente de teste",
    tipo_ordem_servico: "INSTALAÇÃO", status: "Finalizado", data_inicio_programado: `02/${month}/2026 09:00`,
    data_inicio_executado: `02/${month}/2026 09:00`, data_termino_executado: `02/${month}/2026 10:00`, data_referencia_bi: "data_termino_executado" };
  return classifyCommercialRows(sheet([a, r]), sheet([o]));
}

test("Luana recebe vendas e renovações sem apagar o histórico de Giovanna", () => {
  const previous = buildCommercialDashboard(classifySeller("Giovanna da Silva", "10"), null);
  const classified = classifySeller("Luana Mota de Souza", "11");
  expect(classified.sales[0]).toMatchObject({ sellerId: "luana", sellerName: "Luana Mota de Souza" });
  expect(classified.renewals[0].sellerName).toBe("Luana Mota de Souza");
  const current = buildCommercialDashboard(classified, previous);
  expect(current.team.members.find(m => m.id === "luana")).toMatchObject({ sales: 1, renewals: 1, previousSales: 0, previousRenewals: 0 });
  expect(current.team.members.find(m => m.id === "giovanna")).toMatchObject({ sales: 0, renewals: 0, previousSales: 1, previousRenewals: 1 });
  expect(previous.sales.sellers.find(s => s.id === "giovanna")?.current).toBe(1);
  expect(previous.team.members.find(m => m.id === "luana")).toMatchObject({ sales: 0, renewals: 0 });
  expect(current.sales.sellers.reduce((sum, s) => sum + s.current, 0)).toBe(1);
});

test("Giovana e Giovanna conservam a mesma identidade histórica", () => {
  for (const author of ["Giovana", "Giovanna da Silva", " GIOVANA DA SILVA "]) {
    const classified = classifySeller(author, "10");
    expect(classified.sales[0].sellerId).toBe("giovanna");
    const dashboard = buildCommercialDashboard(classified, null);
    expect(dashboard.team.members.find(m => m.id === "giovanna")).toMatchObject({ sales: 1, renewals: 1 });
  }
});

test("estados vazios incluem Luana e Giovanna sem duplicar pessoas ou inventar resultados", () => {
  const sales = getEmptySalesSnapshot(), team = getEmptyTeamSnapshot();
  expect(sales.sellers.some(s => s.id === "luana" && s.name === "Luana Mota de Souza")).toBe(true);
  expect(team.members.some(m => m.id === "giovanna")).toBe(true);
  expect(new Set(sales.sellers.map(s => s.id)).size).toBe(sales.sellers.length);
  expect(sales.sellers.every(s => s.current === 0 && s.previous === 0)).toBe(true);
  expect(team.members.every(m => m.sales === 0 && m.renewals === 0)).toBe(true);
});

test("renovação pendente entra em resumo, gráficos, equipe e localidades mantendo o status real", () => {
  const classified = classifySeller("Luana Mota de Souza", "11");
  const pending = { ...classified.renewals[0], id: "202611010003", completed: false };
  const withPending = { ...classified, renewals: [...classified.renewals, pending] };
  const dashboard = buildCommercialDashboard(withPending, null);
  expect(dashboard.overview.renewals.current).toBe(2);
  expect(dashboard.renewals.monthly[0].currentYear).toBe(2);
  expect(dashboard.renewals.benefits.reduce((sum, b) => sum + b.count, 0)).toBe(2);
  expect(dashboard.renewals.plans.reduce((sum, p) => sum + p.count, 0)).toBe(2);
  expect(dashboard.team.members.find(m => m.id === "luana")?.renewals).toBe(2);
  expect(dashboard.renewals.recentRenewals.find(r => r.id === pending.id)?.status).toBe("Pendente");
  const locations = buildLocationMetrics({ version: 1, attendance: classified.attendance, serviceOrders: classified.serviceOrders,
    sales: classified.sales, renewals: withPending.renewals, cancellations: [], reactivations: [] }, "2026-11");
  expect(locations.reduce((sum, l) => sum + l.renewals, 0)).toBe(2);
  expect(pending.completed).toBe(false);
});
