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

test("sync panel displays safe missing-field diagnostic without extra queries", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let syncCalls = 0;
  const ledger = { version: 1, attendance: [], serviceOrders: [], sales: [], renewals: [], cancellations: [], reactivations: [] };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session") return route.fulfill({ json: { user: { name: "Teste", email: "test@example.invalid" } } });
    if (path === "/api/data") return route.fulfill({ json: { ledger } });
    if (path === "/api/hubsoft/status") return route.fulfill({ json: { configured: true, runs: [] } });
    if (path === "/api/hubsoft/sync") {
      syncCalls++;
      expect(route.request().postDataJSON()).toEqual({ day: "2026-10-10", restart: false });
      return route.fulfill({ status: 400, json: {
        error: "HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES",
        diagnostic: { kind: "attendance", missingFields: ["usuario_abertura"], invalidFields: [] },
      } });
    }
    throw new Error("Unexpected request: " + path);
  });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Importação Hubsoft" });
  await page.getByLabel("Dia da consulta").fill("2026-10-10");
  await page.getByRole("button", { name: "Consultar / continuar" }).click();
  await expect(panel.getByRole("status")).toContainText("Campos ausentes ou vazios: usuario_abertura.");
  await expect(panel.getByRole("status")).toContainText("ponto de retomada foi preservado");
  await expect(page.getByRole("button", { name: "Consultar / continuar" })).toBeEnabled();
  expect(syncCalls).toBe(1);
  // Mensagem longa + menu completo: a lateral deve permitir chegar ao fim.
  const sidebar = page.locator(".app-sidebar");
  await page.evaluate(() => window.scrollTo(0, 300));
  await sidebar.hover({ position: { x: 100, y: 250 } });
  await page.mouse.wheel(0, 2500);
  await expect.poll(() => sidebar.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const imports = page.getByRole("button", { name: "Importar planilhas" });
  await expect(imports).toBeInViewport();
  const feedback = panel.getByRole("status");
  await expect(feedback).toBeInViewport();
  await expect.poll(() => imports.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(720);
  await page.screenshot({ path: info.outputPath("sidebar-diagnostic-scroll.png") });

});
