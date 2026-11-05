import { test, expect } from "@playwright/test";
import { hubsoftDiagnosticMessage } from "../../src/core/services/hubsoftDiagnostic";

test("diagnostic formatter ignores arbitrary values and unknown fields", () => {
  const message = hubsoftDiagnosticMessage({ kind: "attendance", missingFields: ["usuario_abertura", "SEGREDO", "password"], invalidFields: ["protocolo"], row: "CLIENTE_SIGILOSO" });
  expect(message).toContain("usuario_abertura");
  expect(message).toContain("protocolo");
  expect(message).not.toMatch(/SEGREDO|password|CLIENTE_SIGILOSO/);
  expect(hubsoftDiagnosticMessage({ kind: "DESCONHECIDO", missingFields: ["usuario_abertura"] })).toBe("");
  expect(hubsoftDiagnosticMessage(null)).toBe("");
});

test("dashboard keeps manual imports hidden and never queries Hubsoft on navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const hubsoftCalls: string[] = [];
  const ledger = { version: 1, attendance: [], serviceOrders: [], sales: [], renewals: [], cancellations: [], reactivations: [] };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") return route.fulfill({ json: { user: { name: "Teste", email: "test@example.invalid" } } });
    if (path === "/api/data") return route.fulfill({ json: { ledger } });
    if (path.startsWith("/api/hubsoft/")) {
      hubsoftCalls.push(path);
      return route.fulfill({ json: { configured: true, runs: [] } });
    }
    throw new Error("Unexpected request: " + path);
  });
  await page.goto("/");
  await expect(page.getByText("Visão geral de vendas", { exact: true })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Navegação principal" });
  for (const name of ["Vendas", "Renovações", "Cancelamentos", "Visão geral"]) {
    await navigation.getByRole("button", { name, exact: true }).click();
    await expect(navigation.getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("region", { name: "Importação Hubsoft" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Consultar / continuar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Importar planilhas" })).toHaveCount(0);
    await expect(page.locator("input[type=date]")).toHaveCount(0);
  }
  expect(hubsoftCalls).toEqual([]);
});
