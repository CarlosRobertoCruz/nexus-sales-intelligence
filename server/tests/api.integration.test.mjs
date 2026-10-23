import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.PORT = "0";
process.env.NODE_ENV = "test";
process.env.TZ = "America/Sao_Paulo";
const { pool } = await import("../db.mjs");
const { passwordHash, verifyPassword } = await import("../auth.mjs");
const { worksheetRecords, importWorksheets, loadLedger, rebuild } =
  await import("../records.mjs");
const sql = await readFile(
  new URL("../../database/migrations/001_initial.sql", import.meta.url),
  "utf8",
);
const pg = new PGlite();
await pg.exec(
  "CREATE SCHEMA nexus_sales_intelligence; SET search_path TO nexus_sales_intelligence,public; CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL);",
);
await pg.exec(sql);
// PGlite is a real embedded PostgreSQL engine. Advisory locks are single-process no-ops in this test adapter.
const query = async (text, params = []) =>
  text.includes("pg_advisory") || text.includes("pg_try_advisory")
    ? { rows: [{ locked: true }] }
    : pg.query(text, params);
pool.query = query;
pool.connect = async () => ({ query, release() {} });
const fixture = {
  attendance: {
    rows: [
      [
        "protocolo",
        "nome_razaosocial",
        "descricao_abertura",
        "data_cadastro",
        "usuario_abertura",
        "status",
        "tipo_atendimento",
        "codigo_cliente",
      ],
      [
        "20261010000001",
        "Cliente teste",
        "600 Mega Combo Plus",
        "10/10/2026 09:00",
        "Beatriz",
        "Finalizado",
        "Instalacao",
        "12",
      ],
    ],
  },
  serviceOrders: {
    rows: [
      [
        "numero_ordem_servico",
        "tipo_ordem_servico",
        "status",
        "data_inicio_programado",
        "data_inicio_executado",
        "data_termino_executado",
        "codigo_cliente",
        "nome_razaosocial",
      ],
      [
        "42",
        "Instalacao",
        "finalizado",
        "10/10/2026 10:00",
        "10/10/2026 10:00",
        "10/10/2026 11:00",
        "12",
        "Cliente teste",
      ],
    ],
  },
};
const id = randomUUID();
await query(
  "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
  [
    id,
    "test@example.invalid",
    "Teste",
    await passwordHash("test-password-1234"),
  ],
);
const { server } = await import("../index.mjs");
if (!server.listening) await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
const request = (
  path,
  method = "GET",
  data,
  cookie,
  origin = process.env.APP_ORIGIN,
) =>
  fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
async function login() {
  const res = await request("/login", "POST", {
    email: "test@example.invalid",
    password: "test-password-1234",
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}
test("SQL schema, password hashing, authenticated imports and shared persisted metrics", async (t) => {
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await pool.end();
    await pg.close();
  });
  await t.test("tables are in the isolated schema", async () => {
    const tables = (
      await query(
        "SELECT tablename FROM pg_tables WHERE schemaname='nexus_sales_intelligence'",
      )
    ).rows.map((r) => r.tablename);
    for (const name of [
      "users",
      "user_sessions",
      "source_records",
      "commercial_records",
      "sync_cursors",
      "sync_runs",
      "import_runs",
      "application_settings",
      "schema_migrations",
    ])
      assert.ok(tables.includes(name));
  });
  await t.test("password verification and invalid length", async () => {
    const hash = await passwordHash("another-test-password");
    assert.equal(await verifyPassword("another-test-password", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
    await assert.rejects(passwordHash("short"));
  });
  await t.test(
    "anonymous access and cross-origin writes are denied",
    async () => {
      assert.equal((await request("/data")).status, 401);
      assert.equal(
        (
          await request(
            "/login",
            "POST",
            { email: "x", password: "y" },
            null,
            "https://other.invalid",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/login", "POST", {
            email: "test@example.invalid",
            password: "wrong",
          })
        ).status,
        401,
      );
    },
  );
  const cookie = await login();
  await t.test(
    "user management requires a session and rejects cross-origin account creation",
    async () => {
      assert.equal((await request("/users")).status, 401);
      assert.equal(
        (
          await request("/users", "POST", {
            name: "Outra pessoa",
            email: "other@example.invalid",
            password: "test-password-1234",
          })
        ).status,
        401,
      );
      assert.equal(
        (await request("/users", "POST", {}, cookie, "https://other.invalid"))
          .status,
        403,
      );
    },
  );
  await t.test(
    "authenticated account creation normalizes email, stores only a hash and permits login",
    async () => {
      const result = await request(
        "/users",
        "POST",
        {
          name: "  Nova Pessoa  ",
          email: " NOVA@EXAMPLE.INVALID ",
          password: "new-test-password",
          active: false,
        },
        cookie,
      );
      assert.equal(result.status, 201);
      const data = await result.json();
      assert.equal(data.user.email, "nova@example.invalid");
      assert.equal(data.user.name, "Nova Pessoa");
      assert.equal(data.user.active, true);
      assert.equal("password_hash" in data.user, false);
      assert.equal("password" in data.user, false);
      const stored = (
        await query("SELECT password_hash FROM users WHERE email=$1", [
          "nova@example.invalid",
        ])
      ).rows[0];
      assert.notEqual(stored.password_hash, "new-test-password");
      assert.equal(
        await verifyPassword("new-test-password", stored.password_hash),
        true,
      );
      assert.equal(
        (
          await request("/login", "POST", {
            email: "nova@example.invalid",
            password: "new-test-password",
          })
        ).status,
        200,
      );
    },
  );
  await t.test(
    "duplicate emails and invalid account fields are rejected without creating extra users",
    async () => {
      const valid = {
        name: "Nova Pessoa",
        email: "nova@example.invalid",
        password: "new-test-password",
      };
      const duplicate = await request(
        "/users",
        "POST",
        { ...valid, email: "NOVA@EXAMPLE.INVALID" },
        cookie,
      );
      assert.equal(duplicate.status, 409);
      assert.equal((await duplicate.json()).error, "USUARIO_EMAIL_EXISTENTE");
      for (const patch of [
        { name: " " },
        { name: "x".repeat(101) },
        { email: "bad" },
        { password: "short" },
        { password: "x".repeat(257) },
      ]) {
        const response = await request(
          "/users",
          "POST",
          { ...valid, email: "invalid@example.invalid", ...patch },
          cookie,
        );
        assert.equal(response.status, 400);
      }
      assert.equal(
        Number((await query("SELECT count(*) AS n FROM users")).rows[0].n),
        2,
      );
    },
  );
  await t.test(
    "paginated user list contains only public account fields",
    async () => {
      const response = await request("/users?page=1", "GET", null, cookie);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.total, 2);
      assert.equal(data.pageSize, 20);
      assert.equal(data.users.length, 2);
      for (const user of data.users)
        assert.deepEqual(
          Object.keys(user).sort(),
          ["id", "email", "name", "active", "created_at"].sort(),
        );
      assert.equal(
        (await request("/users?page=0", "GET", null, cookie)).status,
        400,
      );
      assert.equal(
        (await request("/users?page=2", "GET", null, cookie)).status,
        200,
      );
    },
  );

  await t.test(
    "repeat imports do not duplicate sales and another session sees the same base",
    async () => {
      for (let i = 0; i < 2; i++) {
        const res = await request("/import", "POST", fixture, cookie);
        assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
      }
      const otherCookie = await login();
      const ledger = (
        await (await request("/data", "GET", null, otherCookie)).json()
      ).ledger;
      assert.equal(ledger.sales.length, 1);
      assert.equal(ledger.sales[0].id, "42");
      assert.equal(ledger.sales[0].sellerName, "Beatriz");
      assert.equal(ledger.sales[0].date.slice(0, 10), "2026-10-10");
      assert.equal(
        Number(
          (await query("SELECT count(*) AS n FROM source_records")).rows[0].n,
        ),
        2,
      );
    },
  );
  await t.test(
    "status updates remove obsolete derived sales without deleting unrelated source records",
    async () => {
      const changed = structuredClone(fixture);
      changed.serviceOrders.rows[1][2] = "pendente";
      const res = await request("/import", "POST", changed, cookie);
      assert.equal(res.status, 200);
      assert.equal((await loadLedger({ query })).sales.length, 0);
    },
  );
  await t.test("malformed spreadsheet rolls back all writes", async () => {
    await query("BEGIN");
    try {
      await assert.rejects(
        importWorksheets(
          { query },
          { ...fixture, serviceOrders: { rows: [["invalid"], ["x"]] } },
          id,
        ),
      );
    } finally {
      await query("ROLLBACK");
    }
    assert.equal(
      Number(
        (await query("SELECT count(*) AS n FROM source_records")).rows[0].n,
      ),
      2,
    );
  });
  await t.test(
    "serialized Excel dates retain time and malformed rows are rejected",
    () => {
      const data = structuredClone(fixture.attendance);
      data.rows[1][3] = "2026-10-10T12:00:00.000Z";
      assert.equal(
        worksheetRecords(data, "attendance")[0].data_cadastro,
        "10/10/2026 09:00",
      );
      assert.throws(() =>
        worksheetRecords(
          { rows: [["protocolo"], ["not-a-protocol"]] },
          "attendance",
        ),
      );
    },
  );

  await t.test(
    "sync stops at four pages and resumes durable checkpoints without duplicate records",
    async () => {
      const { hubsoft, syncDay } = await import("../sync.mjs");
      const originalPage = hubsoft.page,
        originalEnv = hubsoft.env;
      hubsoft.env = {
        HUBSOFT_API_URL: "https://example.invalid",
        HUBSOFT_CLIENT_ID: "test",
        HUBSOFT_CLIENT_SECRET: "test",
        HUBSOFT_USERNAME: "test",
        HUBSOFT_PASSWORD: "test",
      };
      await query(
        "INSERT INTO application_settings(key,value) VALUES('hubsoft_user_names',$1::jsonb)",
        [JSON.stringify({ 87: "Beatriz" })],
      );
      const row = {
        protocolo: "20261012000001",
        data_cadastro: "2026-10-12 09:00:00",
        descricao_abertura: "Instalacao 600 Mega Combo Plus",
        id_usuario_abertura: 87,
        tipo_atendimento: { descricao: "Instalacao" },
        cliente_servico: {
          cliente: { nome_razaosocial: "Cliente teste", codigo_cliente: 12 },
        },
      };
      const calls = [];
      hubsoft.page = async (stream, day, page) => {
        calls.push({ stream, day, page });
        return {
          records: stream === "attendance" ? [row] : [],
          complete: stream === "attendance" ? page >= 4 : true,
        };
      };
      try {
        const first = await syncDay("2026-10-12", id);
        assert.equal(first.pages, 4);
        assert.equal(first.complete, false);
        assert.equal(first.published, false);
        assert.equal(
          (
            await query(
              "SELECT page FROM sync_cursors WHERE day='2026-10-12' AND stream='attendance'",
            )
          ).rows[0].page,
          4,
        );
        const second = await syncDay("2026-10-12", id);
        assert.equal(second.complete, true);
        assert.equal(second.pages, 4);
        assert.equal(second.published, true);
        assert.equal(calls[4].page, 4);
        assert.equal(
          Number(
            (
              await query(
                "SELECT count(*) AS n FROM source_records WHERE id='20261012000001'",
              )
            ).rows[0].n,
          ),
          1,
        );
      } finally {
        hubsoft.page = originalPage;
        hubsoft.env = originalEnv;
      }
    },
  );
  await t.test(
    "invalid Hubsoft page does not advance cursor or publish partial metrics",
    async () => {
      const { hubsoft, syncDay } = await import("../sync.mjs");
      const originalPage = hubsoft.page,
        originalEnv = hubsoft.env;
      hubsoft.env = {
        HUBSOFT_API_URL: "https://example.invalid",
        HUBSOFT_CLIENT_ID: "test",
        HUBSOFT_CLIENT_SECRET: "test",
        HUBSOFT_USERNAME: "test",
        HUBSOFT_PASSWORD: "test",
      };
      hubsoft.page = async () => ({
        records: [{ protocolo: "1" }],
        complete: true,
      });
      const before = await loadLedger({ query });
      try {
        await assert.rejects(syncDay("2026-10-13", id), /CAMPOS_INSUFICIENTES/);
        const response = await request("/hubsoft/sync", "POST", { day: "2026-10-13" }, await login());
        assert.equal(response.status, 400);
        const payload = await response.json();
        assert.deepEqual(payload, {
          error: "HUBSOFT_ATENDIMENTO_CAMPOS_INSUFICIENTES",
          diagnostic: { kind: "attendance", missingFields: ["nome_razaosocial", "descricao_abertura", "usuario_abertura", "tipo_atendimento", "data_cadastro"], invalidFields: [] },
        });

        assert.equal(
          Number(
            (
              await query(
                "SELECT count(*) AS n FROM sync_cursors WHERE day='2026-10-13'",
              )
            ).rows[0].n,
          ),
          0,
        );
        assert.deepEqual(await loadLedger({ query }), before);
      } finally {
        hubsoft.page = originalPage;
        hubsoft.env = originalEnv;
      }
    },
  );
  await t.test("opener enrichment resumes a large page within four GETs and persists no partial records", async () => {
    const { hubsoft, syncDay } = await import("../sync.mjs");
    const originalPage = hubsoft.page, originalOpener = hubsoft.attendanceOpener, originalEnv = hubsoft.env;
    hubsoft.env = { HUBSOFT_API_URL: "https://example.invalid", HUBSOFT_CLIENT_ID: "test", HUBSOFT_CLIENT_SECRET: "test", HUBSOFT_USERNAME: "test", HUBSOFT_PASSWORD: "test" };
    const rows = Array.from({ length: 7 }, (_, i) => ({ protocolo: `2026101500000${i}`, id_usuario_abertura: 999,
      data_cadastro: "2026-10-15 09:00:00", descricao_abertura: "Instalacao 600 Mega Combo Plus",
      tipo_atendimento: "Instalacao", nome_razaosocial: "Cliente ficticio" }));
    const lookups = [], calls = [];
    hubsoft.page = async (stream) => {
      calls.push("page");
      rows.forEach((row) => { row.tempo_restante = `dinamico-${calls.length}`; });
      return { records: stream === "attendance" ? rows : [], complete: true };
    };
    hubsoft.attendanceOpener = async (protocol) => { calls.push("detail"); lookups.push(protocol); return "Beatriz"; };
    try {
      const before = await loadLedger({ query });
      const first = await syncDay("2026-10-15", id);
      assert.equal(first.requests, 4);
      assert.equal(first.pages, 0);
      assert.equal(first.complete, false);
      assert.equal(first.published, false);
      assert.deepEqual(await loadLedger({ query }), before);
      assert.equal(Number((await query("SELECT count(*) AS n FROM source_records WHERE id LIKE '20261015%'")).rows[0].n), 0);
      assert.equal(Number((await query("SELECT count(*) AS n FROM sync_cursors WHERE day='2026-10-15'")).rows[0].n), 0);
      // Alterar um registro invalida sua resolucao antiga, sem reutilizar o nome.
      rows[0].id_usuario_abertura = 1000;
      const second = await syncDay("2026-10-15", id);
      assert.equal(second.requests, 4);
      assert.equal(second.pages, 0);
      assert.equal(second.complete, false);
      let result;
      for (let i = 0; i < 3; i++) {
        const start = calls.length;
        result = await syncDay("2026-10-15", id);
        assert.ok(calls.length - start <= 4);
        if (result.complete) break;
      }
      assert.equal(result.complete, true);
      assert.equal(lookups.length, 8);
      assert.equal(new Set(lookups).size, 7);
      assert.equal(Number((await query("SELECT count(*) AS n FROM source_records WHERE id LIKE '20261015%'")).rows[0].n), 7);
      assert.equal(Number((await query("SELECT count(*) AS n FROM application_settings WHERE key LIKE 'hubsoft_pending_openers:2026-10-15:%'")).rows[0].n), 0);
      assert.equal((await query("SELECT payload->>'usuario_abertura' AS name FROM source_records WHERE id=$1", [rows[0].protocolo])).rows[0].name, "Beatriz");
      // Reinicio explicito apaga tanto o cursor quanto nomes pendentes.
      await syncDay("2026-10-15", id, true);
      const previousLookups = lookups.length;
      await syncDay("2026-10-15", id, true);
      assert.equal(lookups.length - previousLookups, 3);
      assert.deepEqual(lookups.slice(-3), rows.slice(0, 3).map((row) => row.protocolo));
    } finally { hubsoft.page = originalPage; hubsoft.attendanceOpener = originalOpener; hubsoft.env = originalEnv; }
  });
  await t.test(
    "removing the last required upstream records clears stale metrics",
    async () => {
      await query("DELETE FROM source_records WHERE kind='serviceOrders'");
      const result = await rebuild({ query });
      assert.equal(result.published, true);
      assert.equal((await loadLedger({ query })).attendance.length, 0);
    },
  );
  await t.test(
    "logout revokes session; destructive endpoint does not exist",
    async () => {
      assert.equal(
        (await request("/data", "DELETE", null, cookie)).status,
        405,
      );
      assert.equal((await request("/logout", "POST", {}, cookie)).status, 200);
      assert.equal((await request("/data", "GET", null, cookie)).status, 401);
    },
  );
});
