import { test, expect, type Page } from "@playwright/test";

const account = {
  id: "test-account",
  name: "Pessoa de teste",
  email: "teste@example.invalid",
  active: true,
  created_at: "2026-10-20T12:00:00Z",
};
async function setup(page: Page, duplicate = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let users = [account];
  let creates = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session")
      return route.fulfill({ json: { user: account } });
    if (path === "/api/data")
      return route.fulfill({
        json: {
          ledger: {
            version: 1,
            attendance: [],
            serviceOrders: [],
            sales: [],
            renewals: [],
            cancellations: [],
            reactivations: [],
          },
        },
      });
    if (path === "/api/hubsoft/status")
      return route.fulfill({ json: { configured: false, runs: [] } });
    if (path === "/api/users" && route.request().method() === "GET")
      return route.fulfill({
        json: { users, total: users.length, page: 1, pageSize: 20 },
      });
    if (path === "/api/users" && route.request().method() === "POST") {
      creates++;
      if (duplicate)
        return route.fulfill({
          status: 409,
          json: { error: "USUARIO_EMAIL_EXISTENTE" },
        });
      const input = route.request().postDataJSON();
      const user = {
        ...account,
        id: "new-account",
        name: input.name,
        email: input.email,
      };
      users = [...users, user];
      return route.fulfill({ status: 201, json: { user } });
    }
    throw new Error("Unexpected route " + path);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Usuários", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acessos da equipe" }),
  ).toBeVisible();
  return () => creates;
}
async function fillUser(page: Page, confirm = "test-password-1234") {
  const dialog = page.getByRole("dialog", { name: "Novo usuário" });
  await dialog.getByLabel("Nome", { exact: true }).fill("Nova Pessoa");
  await dialog
    .getByLabel("E-mail", { exact: true })
    .fill("nova@example.invalid");
  await dialog
    .getByLabel("Senha inicial", { exact: true })
    .fill("test-password-1234");
  await dialog.getByLabel("Confirmar senha", { exact: true }).fill(confirm);
  return dialog;
}

test("users tab follows the team, creates one account and refreshes the list", async ({
  page,
}, info) => {
  const creates = await setup(page);
  const buttons = await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button")
    .allTextContents();
  expect(buttons.indexOf("Usuários")).toBe(
    buttons.indexOf("Equipe comercial") + 1,
  );
  await expect(page.getByText("Você", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("users-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  const dialog = await fillUser(page);
  await page.screenshot({ path: info.outputPath("create-user-desktop.png") });
  await dialog
    .getByRole("button", { name: "Criar usuário", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Acesso de Nova Pessoa criado com sucesso.",
  );
  await expect(
    page.getByText("nova@example.invalid", { exact: true }),
  ).toBeVisible();
  expect(creates()).toBe(1);
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Senha inicial", { exact: true }),
  ).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile form fits, validates confirmation and explains duplicate email", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const creates = await setup(page, true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  const dialog = await fillUser(page, "another-password-123");
  await dialog
    .getByRole("button", { name: "Criar usuário", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "As senhas não coincidem.",
  );
  expect(creates()).toBe(0);
  await dialog
    .getByLabel("Confirmar senha", { exact: true })
    .fill("test-password-1234");
  await dialog
    .getByRole("button", { name: "Criar usuário", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Já existe um usuário com esse e-mail.",
  );
  await page.screenshot({ path: info.outputPath("create-user-mobile.png") });
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
