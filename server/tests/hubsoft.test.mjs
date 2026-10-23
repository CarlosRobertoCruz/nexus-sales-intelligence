import test from "node:test";
import assert from "node:assert/strict";
import { HubsoftClient, validateDay } from "../hubsoft.mjs";
import { normalizeHubsoft } from "../hubsoftAdapter.mjs";
const env = {
  HUBSOFT_API_URL: "https://example.invalid",
  HUBSOFT_CLIENT_ID: "test-client",
  HUBSOFT_CLIENT_SECRET: "test-secret",
  HUBSOFT_USERNAME: "test-user",
  HUBSOFT_PASSWORD: "test-password",
};
const page = (records = [], current = 0, last = 0) => ({
  status: "success",
  atendimentos: records,
  paginacao: { pagina_atual: current, ultima_pagina: last },
});
function mock(responses) {
  const calls = [],
    waits = [];
  const client = new HubsoftClient(
    env,
    async (url, options) => {
      calls.push({ url: new URL(url), ...options });
      const next = responses.shift();
      if (!next) throw new Error("Unexpected call");
      return next instanceof Response ? next : Response.json(next);
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  return { client, calls, waits };
}
const token = { access_token: "fake-test-token", expires_in: 3600 };
test("only approved GET routes and OAuth POST can leave the client", async () => {
  const { client, calls } = mock([]);
  for (const [method, path] of [
    ["POST", "/api/v1/integracao/atendimento/todos"],
    ["PUT", "/oauth/token"],
    ["PATCH", "/x"],
    ["DELETE", "/x"],
    ["GET", "/api/v1/integracao/cliente/excluir"],
  ])
    await assert.rejects(client.request(method, path, {}), /BLOQUEADO/);
  assert.equal(calls.length, 0);
});
test("one-day query, 50 rows, explicit page, OAuth reuse and no redirects", async () => {
  const { client, calls, waits } = mock([
    token,
    page([{}], 0, 1),
    page([], 1, 1),
  ]);
  assert.equal(
    (await client.page("attendance", "2026-10-10", 0)).complete,
    false,
  );
  assert.equal(
    (await client.page("attendance", "2026-10-10", 1)).complete,
    true,
  );
  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url.pathname, "/oauth/token");
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].redirect, "error");
  for (const c of calls.slice(1)) {
    assert.equal(c.url.searchParams.get("data_inicio"), "2026-10-10");
    assert.equal(c.url.searchParams.get("data_fim"), "2026-10-10");
    assert.equal(c.url.searchParams.get("itens_por_pagina"), "50");
    assert.equal(c.body, undefined);
  }
  assert.equal(calls[2].url.searchParams.get("pagina"), "1");
  assert.ok(waits[2] > 0);
});
test("invalid dates, streams and pages never authenticate", async () => {
  const { client, calls } = mock([]);
  for (const date of ["2026-02-30", "2026-10", "anything"])
    await assert.rejects(client.page("attendance", date, 0));
  await assert.rejects(client.page("write", "2026-10-10", 0));
  await assert.rejects(client.page("attendance", "2026-10-10", -1));
  assert.equal(calls.length, 0);
  assert.equal(validateDay("2024-02-29"), "2024-02-29");
});
test("GET queue never runs concurrent requests", async () => {
  let active = 0,
    max = 0;
  const client = new HubsoftClient(
    env,
    async (url) => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setImmediate(r));
      active--;
      return Response.json(
        new URL(url).pathname === "/oauth/token" ? token : page(),
      );
    },
    async () => {},
  );
  await Promise.all([
    client.page("attendance", "2026-10-10", 0),
    client.page("attendance", "2026-10-11", 0),
  ]);
  assert.equal(max, 1);
});
test("rate limit stops without retry loop and enforces cooldown", async () => {
  const { client, calls } = mock([
    token,
    Response.json({ retry_after: 60 }, { status: 429 }),
  ]);
  await assert.rejects(client.page("attendance", "2026-10-10", 0), /LIMITE/);
  await assert.rejects(client.page("attendance", "2026-10-10", 0), /LIMITE/);
  assert.equal(calls.length, 2);
});
test("pagination contract rejects ignored pagination and oversized pages", async () => {
  for (const response of [
    page([], 1, 2),
    page(Array(51).fill({})),
    { atendimentos: [] },
  ]) {
    const { client } = mock([token, response]);
    await assert.rejects(
      client.page("attendance", "2026-10-10", 0),
      /PAGINACAO_INVALIDA/,
    );
  }
});
test("insecure API origin never receives credentials", async () => {
  const { client, calls } = mock([]);
  client.env = { ...env, HUBSOFT_API_URL: "http://example.invalid" };
  await assert.rejects(
    client.page("attendance", "2026-10-10", 0),
    /URL_HUBSOFT_INVALIDA/,
  );
  assert.equal(calls.length, 0);
});
test("adapter preserves business numbers, maps user IDs and rejects incomplete records", () => {
  const row = {
    id_atendimento: 3,
    protocolo: "20261010000001",
    data_cadastro: "2026-10-10 09:30:00",
    descricao_abertura: "Instalacao 600 Mega Combo Plus",
    id_usuario_abertura: 87,
    tipo_atendimento: { descricao: "Instalacao" },
    cliente_servico: {
      cliente: { nome_razaosocial: "Cliente teste", codigo_cliente: 12 },
    },
  };
  const normalized = normalizeHubsoft("attendance", row, { 87: "Beatriz" });
  assert.equal(normalized.protocolo, row.protocolo);
  assert.equal(normalized.usuario_abertura, "Beatriz");
  assert.equal(normalized.data_cadastro, "10/10/2026 09:30");
  assert.throws(
    () => normalizeHubsoft("attendance", row),
    /CAMPOS_INSUFICIENTES/,
  );
  const order = normalizeHubsoft("serviceOrders", {
    id_ordem_servico: 999,
    numero: "42",
    tipo: "Instalacao",
    status: "finalizado",
    cliente: { nome_razaosocial: "Cliente teste" },
    data_inicio_programado: "2026-10-10 10:00:00",
  });
  assert.equal(order.numero_ordem_servico, "42");
});

test("documented flat OS customer display and nested attendance address are supported", () => {
  const order = normalizeHubsoft("serviceOrders", {
    numero: 42,
    tipo: "Instalacao",
    status: "finalizado",
    cliente: "12 - Cliente teste",
    data_inicio_programado: "2026-10-10 10:00:00",
  });
  assert.equal(order.codigo_cliente, "12");
  assert.equal(order.nome_razaosocial, "Cliente teste");
  const attendance = normalizeHubsoft(
    "attendance",
    {
      protocolo: "123",
      data_cadastro: "2026-10-10 09:00:00",
      descricao_abertura: "Instalacao",
      id_usuario_abertura: 87,
      tipo_atendimento: { descricao: "Instalacao" },
      cliente_servico: {
        cliente: { nome_razaosocial: "Cliente teste" },
        endereco_instalacao: {
          endereco_numero: { bairro: "Centro", cidade: { nome: "Teste" } },
        },
      },
    },
    { 87: "Beatriz" },
  );
  assert.equal(attendance.bairro, "Centro");
  assert.equal(attendance.cidade, "Teste");
});

test("gateway HTML rate-limit responses still respect Retry-After", async () => {
 const {client,calls}=mock([token,new Response("Too many requests",{status:429,headers:{"Retry-After":"60"}})]);
 await assert.rejects(client.page("attendance","2026-10-10",0),/LIMITE/);
 await assert.rejects(client.page("attendance","2026-10-10",0),/LIMITE/);
 assert.equal(calls.length,2);
});


test("documented opener lookup uses exact protocol, one result, shared OAuth and approved GET", async () => {
  const { client, calls, waits } = mock([token, page(), { atendimentos: [{ protocolo: "123", usuario_abertura: " Beatriz " }] }]);
  await client.page("attendance", "2026-10-10", 0);
  assert.equal(await client.attendanceOpener("123"), "Beatriz");
  assert.equal(calls.length, 3);
  const c = calls[2];
  assert.equal(c.method, "GET");
  assert.equal(c.redirect, "error");
  assert.equal(c.url.pathname, "/api/v1/integracao/cliente/atendimento");
  assert.equal(c.url.searchParams.get("busca"), "protocolo");
  assert.equal(c.url.searchParams.get("termo_busca"), "123");
  assert.equal(c.url.searchParams.get("limit"), "1");
  assert.equal(c.url.searchParams.get("apenas_pendente"), "nao");
  assert.equal(c.body, undefined);
  assert.ok(waits[2] > 0);
});

test("opener lookup rejects mismatch, multiple results and missing name without substituting responsible user", async () => {
  for (const atendimentos of [[], [{ protocolo: "999", usuario_abertura: "Outro" }],
    [{ protocolo: "123", usuario_abertura: "Teste" }, { protocolo: "123", usuario_abertura: "Outro" }],
    [{ protocolo: "123", usuario_responsavel: "Nao utilizar" }]]) {
    const { client } = mock([token, { atendimentos }]);
    await assert.rejects(client.attendanceOpener("123"), /HUBSOFT_(CONSULTA_PROTOCOLO_DIVERGENTE|USUARIO_ABERTURA_NAO_RETORNADO)/);
  }
  const { client, calls } = mock([]);
  for (const protocol of ["", "x", "123&busca=cpf", 123, "1".repeat(41)])
    await assert.rejects(client.attendanceOpener(protocol), /PROTOCOLO_INVALIDO/);
  await assert.rejects(client.request("POST", "/api/v1/integracao/cliente/atendimento", {}), /BLOQUEADO/);
  assert.equal(calls.length, 0);
});
