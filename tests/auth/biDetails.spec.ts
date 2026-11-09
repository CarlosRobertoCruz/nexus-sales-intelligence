import { test, expect, type Page } from "@playwright/test";
import { classifyCommercialRows } from "../../src/apps/importacao/domain/classifyCommercialRows";
import { buildCommercialDashboard } from "../../src/apps/importacao/viewModel/buildCommercialDashboard";
import type { ImportedWorksheet, SpreadsheetCell } from "../../src/apps/importacao/types/spreadsheetImport";

const sheet = (rows: Record<string, SpreadsheetCell>[]): ImportedWorksheet => {
  const headers = [...new Set(rows.flatMap(Object.keys))];
  return { fileName: "test", rows: [headers, ...rows.map(row => headers.map(key => row[key] ?? null))] };
};

function fixture() {
  const attendance = Array.from({ length: 8 }, (_, index) => ({ id_atendimento: String(100 + index), protocolo: `20261001000${index}`, codigo_cliente: String(10 + index),
    nome_razaosocial: `Cliente cancelado ${index}`, data_cadastro: "10/10/2026", usuario_abertura: "Beatriz", status: "Resolvido", tipo_atendimento: "CANCELAMENTO",
    descricao_abertura: index < 6 ? "Cliente relata quedas na conexão todos os dias." : "Cliente solicitou cancelamento por razão pessoal.",
    descricao_fechamento: "O cancelamento foi efetivado." }));
  const installations = ["600 Mega Combo Plus", "600 Mega Nexus Essencial", "1 Giga Nexus Pro"].map((plan, index) => ({ ...attendance[0],
    id_atendimento: String(200 + index), protocolo: `20261002000${index}`, tipo_atendimento: "INSTALAÇÃO", descricao_abertura: `PLANO: ${plan}`,
    usuario_abertura: index === 2 ? "Luana Mota de Souza" : "Beatriz" }));
  const orders = installations.map((row, index) => ({ id_ordem_servico: String(300 + index), numero_ordem_servico: String(400 + index), id_atendimento: row.id_atendimento,
    codigo_cliente: row.codigo_cliente, nome_razaosocial: row.nome_razaosocial, tipo_ordem_servico: "INSTALAÇÃO", status: "Finalizado", data_inicio_programado: "11/10/2026 09:00",
    data_inicio_executado: "11/10/2026 09:00", data_termino_executado: "11/10/2026 10:00", descricao_servico: "Instalação executada." }));
  const support = { ...orders[0], id_ordem_servico: "900", numero_ordem_servico: "1900", id_atendimento: "999", tipo_ordem_servico: "SUPORTE",
    data_cadastro: "05/10/2026 09:00", data_inicio_executado: "05/10/2026 09:00", data_termino_executado: "05/10/2026 10:00",
    descricao_servico: "Técnico corrigiu a conexão no roteador." };
  return classifyCommercialRows(sheet([...attendance, ...installations]), sheet([...orders, support]));
}

async function openDashboard(page: Page) {
  const c = fixture();
  const ledger = { version: 1, attendance: c.attendance, serviceOrders: c.serviceOrders, sales: c.sales, renewals: c.renewals, cancellations: c.cancellations, reactivations: c.reactivations };
  const calls: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path === "/api/session") return route.fulfill({ json: { user: { name: "Teste", email: "test@example.invalid" } } });
    if (path === "/api/data") return route.fulfill({ json: { ledger } });
    throw new Error("Unexpected API request: " + path);
  });
  await page.goto("/");
  await expect(page.getByText("Visão geral de vendas", { exact: true })).toBeVisible({ timeout: 15000 });
  return calls;
}

test("snapshot conserva todos os detalhes, além dos cinco recentes, e os novos planos", () => {
  const dashboard = buildCommercialDashboard(fixture(), null);
  expect(dashboard.cancellations.recentCancellations).toHaveLength(5);
  expect(dashboard.cancellations.details).toHaveLength(8);
  expect(dashboard.cancellations.details?.filter(item => item.reasonId === "dissatisfaction")).toHaveLength(6);
  expect(dashboard.overview.sales.find(plan => plan.id === "nexus-essential")?.current).toBe(1);
  expect(dashboard.sales.plans.reduce((sum, plan) => sum + plan.current, 0)).toBe(3);
});

test("motivos abrem modal acessível com todos os casos, relatos e OS locais", async ({ page }) => {
  const calls = await openDashboard(page);
  await expect(page.getByText("600 Mega Nexus Essencial", { exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("button", { name: "Cancelamentos", exact: true }).click();
  const opener = page.getByRole("button", { name: "Ampliar motivos de cancelamento" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Detalhamento dos cancelamentos" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "test-results/cancellation-details-desktop.png" });
  await expect(dialog.locator(".cancellation-case")).toHaveCount(8);
  await dialog.getByRole("button", { name: /Insatisfação com o serviço/ }).click();
  await expect(dialog.locator(".cancellation-case")).toHaveCount(6);
  await dialog.locator("summary").filter({ hasText: "Cliente cancelado 0" }).click();
  const opened = dialog.locator(".cancellation-case[open]");
  await expect(opened.getByText("Cliente relata quedas na conexão todos os dias.", { exact: true })).toBeVisible();
  await expect(opened.getByText("Técnico corrigiu a conexão no roteador.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /Outros motivos/ }).click();
  await expect(dialog.locator(".cancellation-case")).toHaveCount(2);
  await dialog.getByRole("button", { name: /Motivo financeiro/ }).click();
  await expect(dialog.getByText("Nenhum cancelamento neste motivo e período.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await nav.getByRole("button", { name: "Equipe comercial", exact: true }).click();
  const legend = page.locator('[aria-label="Participação por colaboradora"]');
  await expect(legend.getByText("Luana Mota de Souza", { exact: true })).toBeVisible();
  expect(await legend.locator(".reason-dot").evaluateAll(nodes => new Set(nodes.map(node => getComputedStyle(node).backgroundColor)).size)).toBe(5);
  await page.screenshot({ path: "test-results/team-concentration-desktop.png", fullPage: true });
  expect(calls.every(path => path === "/api/session" || path === "/api/data")).toBe(true);
});

test("modal funciona em celular, rola e fecha sem ultrapassar a tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("button", { name: "Cancelamentos", exact: true }).click();
  await page.getByRole("button", { name: "Ampliar motivos de cancelamento" }).click();
  const dialog = page.getByRole("dialog", { name: "Detalhamento dos cancelamentos" });
  await dialog.getByRole("button", { name: /Outros motivos/ }).click();
  await dialog.locator("summary").first().click();
  await expect(dialog.locator(".cancellation-case[open]").getByText("Cliente solicitou cancelamento por razão pessoal.", { exact: true })).toBeVisible();
  const rect = await dialog.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/cancellation-details-mobile.png" });
  await dialog.getByRole("button", { name: "Fechar detalhes" }).click();
  await expect(dialog).toHaveCount(0);
});
