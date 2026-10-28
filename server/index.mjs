import { safeHubsoftDiagnostic } from "./hubsoftDiagnostics.mjs";
import http from "node:http";
import { createUser, listUsers } from "./users.mjs";
import { pool, transaction } from "./db.mjs";
import { passwordHash, verifyPassword, newToken, hashToken } from "./auth.mjs";
import { importWorksheets, loadLedger } from "./records.mjs";
import { hubsoft, syncDay, safeCode } from "./sync.mjs";
const origin = process.env.APP_ORIGIN;
if (!origin || new URL(origin).origin !== origin)
  throw new Error("Configure APP_ORIGIN sem barra final.");
const secure = process.env.NODE_ENV === "production";
if (secure && !origin.startsWith("https://"))
  throw new Error("Producao exige APP_ORIGIN HTTPS.");
const cookie = (token) =>
  `sales_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 28800 : 0}${secure ? "; Secure" : ""}`;
const attempts = new Map();
function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
async function body(req, maxBytes = 20 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const e = new Error("REQUISICAO_MUITO_GRANDE");
      e.status = 413;
      throw e;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("JSON_INVALIDO");
  }
}
async function session(req) {
  const token = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("sales_session="))
    ?.slice(14);
  if (!token || !/^\w{64}$/.test(token)) return null;
  return (
    (
      await pool.query(
        "SELECT u.id,u.email,u.name FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
        [hashToken(token)],
      )
    ).rows[0] ?? null
  );
}
const dummyHash = await passwordHash(newToken());
export const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const path = requestUrl.pathname;
    if (req.method === "GET" && path === "/api/healthz")
      return send(res, 200, { ok: true });
    if (req.method === "GET" && path === "/api/ready") {
      await pool.query("SELECT 1 FROM schema_migrations LIMIT 1");
      await pool.query("SELECT id FROM hubsoft_gate WHERE id=1");
      return send(res, 200, { ok: true });
    }
    if (!["GET", "POST"].includes(req.method))
      return send(res, 405, { error: "METODO_NAO_PERMITIDO" });
    if (req.method === "POST") {
      if (req.headers.origin !== origin)
        return send(res, 403, { error: "ORIGEM_NAO_PERMITIDA" });
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { error: "JSON_OBRIGATORIO" });
    }
    if (req.method === "POST" && path === "/api/login") {
      const input = await body(req);
      const email =
        typeof input.email === "string"
          ? input.email.trim().toLowerCase().slice(0, 254)
          : "";
      const now = Date.now();
      for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
      const rate = attempts.get(email) ?? {
        count: 0,
        until: now + 15 * 60 * 1000,
      };
      if (rate.count >= 10 || attempts.size >= 2000)
        return send(res, 429, { error: "AGUARDE_PARA_TENTAR_NOVAMENTE" });
      rate.count++;
      attempts.set(email, rate);
      const user = (
        await pool.query("SELECT * FROM users WHERE email=$1 AND active", [
          email,
        ])
      ).rows[0];
      const valid = await verifyPassword(
        input.password,
        user?.password_hash ?? dummyHash,
      );
      if (!user || !valid)
        return send(res, 401, { error: "EMAIL_OU_SENHA_INVALIDOS" });
      const token = newToken();
      await transaction(async (db) => {
        await db.query("DELETE FROM user_sessions WHERE expires_at<=now()");
        await db.query(
          "INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
          [hashToken(token), user.id],
        );
      });
      attempts.delete(email);
      return send(
        res,
        200,
        { user: { id: user.id, email: user.email, name: user.name } },
        { "Set-Cookie": cookie(token) },
      );
    }
    const user = await session(req);
    if (!user) return send(res, 401, { error: "SESSAO_NECESSARIA" });
    if (req.method === "GET" && path === "/api/session")
      return send(res, 200, { user });
    if (req.method === "POST" && path === "/api/logout") {
      const token = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("sales_session="))
        ?.slice(14);
      if (token)
        await pool.query("DELETE FROM user_sessions WHERE token_hash=$1", [
          hashToken(token),
        ]);
      return send(res, 200, { ok: true }, { "Set-Cookie": cookie("") });
    }
    // All authenticated accounts have the same permissions, as in the existing application.
    if (req.method === "GET" && path === "/api/users") {
      return send(
        res,
        200,
        await listUsers(pool, requestUrl.searchParams.get("page") ?? "1"),
      );
    }
    if (req.method === "POST" && path === "/api/users") {
      return send(res, 201, {
        user: await createUser(pool, await body(req, 16 * 1024)),
      });
    }
    if (req.method === "GET" && path === "/api/data")
      return send(res, 200, {
        ledger: await loadLedger(pool),
        dashboard: null,
      });
    if (req.method === "POST" && path === "/api/import") {
      const input = await body(req);
      const result = await transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(73190602)");
        return importWorksheets(db, input, user.id);
      });
      return send(res, 200, result);
    }
    if (req.method === "GET" && path === "/api/hubsoft/status") {
      const runs = (
        await pool.query(
          "SELECT day,status,pages,records,error_code,started_at,finished_at FROM sync_runs ORDER BY started_at DESC LIMIT 10",
        )
      ).rows;
      return send(res, 200, { configured: hubsoft.configured, runs });
    }
    if (req.method === "POST" && path === "/api/hubsoft/sync") {
      const input = await body(req);
      if (
        typeof input.restart !== "undefined" &&
        typeof input.restart !== "boolean"
      )
        throw new Error("ENTRADA_INVALIDA");
      return send(
        res,
        200,
        await syncDay(input.day, user.id, input.restart === true),
      );
    }
    return send(res, 404, { error: "ROTA_NAO_ENCONTRADA" });
  } catch (error) {
    const diagnostic = safeHubsoftDiagnostic(error);
    send(res, error.status ?? 400, { error: safeCode(error), ...(diagnostic ? { diagnostic } : {}) });
  }
});
server.requestTimeout = 300000;
server.headersTimeout = 30000;
server.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log("Nexus Sales API iniciada."),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000).unref();
  });
