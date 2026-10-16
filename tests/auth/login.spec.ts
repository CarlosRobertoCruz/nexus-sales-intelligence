import { test, expect, type Page } from "@playwright/test";

const user = { name: "Pessoa de teste", email: "teste@example.invalid" };
const ledger = {
  version: 1,
  attendance: [],
  serviceOrders: [],
  sales: [],
  renewals: [],
  cancellations: [],
  reactivations: [],
};
type Options = {
  session?: boolean;
  failedLogin?: boolean;
  data?: (call: number) => Promise<{ status: number; body: unknown }>;
};
async function mockApi(page: Page, options: Options = {}) {
  const calls: string[] = [];
  let dataCalls = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path === "/api/session")
      return route.fulfill({
        status: options.session ? 200 : 401,
        json: options.session ? { user } : { error: "SESSAO_NECESSARIA" },
      });
    if (path === "/api/login")
      return route.fulfill({
        status: options.failedLogin ? 401 : 200,
        json: options.failedLogin
          ? { error: "EMAIL_OU_SENHA_INVALIDOS" }
          : { user },
      });
    if (path === "/api/data") {
      dataCalls += 1;
      const result = options.data
        ? await options.data(dataCalls)
        : { status: 200, body: { ledger } };
      return route.fulfill({ status: result.status, json: result.body });
    }
    if (path === "/api/hubsoft/status")
      return route.fulfill({ json: { configured: false, runs: [] } });
    if (path === "/api/logout") return route.fulfill({ json: { ok: true } });
    throw new Error("Unexpected API request in auth test: " + path);
  });
  return calls;
}
async function login(page: Page) {
  await page.getByLabel("E-MAIL", { exact: true }).fill(user.email);
  await page.getByLabel("SENHA", { exact: true }).fill("senha-ficticia-123");
  await page.getByRole("button", { name: "Entrar no Nexus Sales" }).click();
}

test("desktop login, password visibility and no data before authentication", async ({
  page,
}, info) => {
  const calls = await mockApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta." }),
  ).toBeVisible();
  const password = page.getByLabel("SENHA", { exact: true });
  await password.fill("senha-ficticia");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await password.fill("");
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((path) => path === "/api/session")).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("login-desktop.png"),
    fullPage: true,
  });
});

test("mobile login fits 390px and 320px without horizontal scroll", async ({
  page,
}, info) => {
  await mockApi(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Entrar no Nexus Sales" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`login-mobile-${width}.png`),
      fullPage: true,
    });
  }
});

test("invalid credentials preserve the form and never start the map", async ({
  page,
}) => {
  await mockApi(page, { failedLogin: true });
  await page.goto("/");
  await login(page);
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha inválidos.",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Entrar no Nexus Sales" }),
  ).toBeEnabled();
});

test("successful login animates Brazil to Mangaratiba while hydrating then reveals the dashboard", async ({
  page,
}, info) => {
  const calls = await mockApi(page);
  await page.goto("/");
  await login(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".sales-workspace")).toHaveAttribute("inert", "");
  await page.waitForTimeout(700);
  await page.screenshot({ path: info.outputPath("arrival-brazil.png") });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: info.outputPath("arrival-mangaratiba.png") });
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 4000 });
  await expect(
    page.getByText("Visão geral de vendas", { exact: true }),
  ).toBeVisible();
  expect(calls.filter((path) => path === "/api/login")).toHaveLength(1);
  expect(calls).toContain("/api/data");
});

test("skipping animation still waits for actual data and mobile overlay stays inside viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, {
    data: async () => {
      await waiting;
      return { status: 200, body: { ledger } };
    },
  });
  await page.goto("/");
  await login(page);
  await page.getByRole("button", { name: "Pular animação" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Preparando sua visão comercial…", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sales-arrival-destination")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".sales-arrival-steps .is-active")).toHaveCount(3);
  await page.screenshot({ path: info.outputPath("arrival-mobile.png") });
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reduced motion skips zoom and does not impose the animation delay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, {
    data: async () => {
      await waiting;
      return { status: 200, body: { ledger } };
    },
  });
  await page.goto("/");
  await login(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .locator(".sales-arrival .sales-map-camera")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await expect(page.getByRole("dialog")).toHaveClass(/is-reduced/);
  await expect(page.getByRole("dialog")).toHaveClass(/is-arrived/);
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("failed hydration offers retry without requiring another login", async ({
  page,
}) => {
  let failData = true;
  const calls = await mockApi(page, {
    data: async () =>
      failData
        ? { status: 500, body: { error: "TEST_ERROR" } }
        : { status: 200, body: { ledger } },
  });
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  failData = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("button", { name: "Pular animação" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pular animação" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.filter((path) => path === "/api/login")).toHaveLength(1);
  expect(
    calls.filter((path) => path === "/api/data").length,
  ).toBeGreaterThanOrEqual(2);
});

test("restored session enters the same flow and logout returns to login", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calls = await mockApi(page, { session: true });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  expect(calls).not.toContain("/api/login");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta." }),
  ).toBeVisible();
});

test("session expiry during hydration returns to login instead of leaving the overlay stuck", async ({
  page,
}) => {
  await mockApi(page, {
    data: async () => ({ status: 401, body: { error: "SESSAO_NECESSARIA" } }),
  });
  await page.goto("/");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("dashboard code waits for login and module failure has a recovery action", async ({
  page,
}) => {
  await mockApi(page);
  let dashboardRequests = 0;
  await page.route(
    "**/src/apps/shell/ui/SalesDashboard.tsx*",
    async (route) => {
      dashboardRequests += 1;
      await route.abort();
    },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Entrar no Nexus Sales" }),
  ).toBeVisible();
  expect(dashboardRequests).toBe(0);
  await login(page);
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar o painel",
  );
  expect(dashboardRequests).toBeGreaterThan(0);
});
