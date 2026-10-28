import { setTimeout as delay } from "node:timers/promises";
import { retryDelay, safePolicy } from "./hubsoftGate.mjs";
const READ_PATHS = new Set([
  "/api/v1/integracao/atendimento/todos",
  "/api/v1/integracao/cliente/atendimento",
  "/api/v1/integracao/ordem_servico/todos",
]);
export class HubsoftError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export function validateDay(day) {
  if (
    typeof day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(day + "T12:00:00Z").toISOString().slice(0, 10) !== day
  )
    throw new HubsoftError("DATA_INVALIDA");
  return day;
}
export class HubsoftClient {
  constructor(env = process.env, fetcher = fetch, sleep = delay, gate = null) {
    this.gate = gate;
    this.env = env;
    this.fetcher = fetcher;
    this.sleep = sleep;
    this.lastCall = 0;
    this.token = null;
    this.expires = 0;
    this.queue = Promise.resolve();
  }
  get configured() {
    return [
      "HUBSOFT_API_URL",
      "HUBSOFT_CLIENT_ID",
      "HUBSOFT_CLIENT_SECRET",
      "HUBSOFT_USERNAME",
      "HUBSOFT_PASSWORD",
    ].every((k) => Boolean(this.env[k]));
  }
  async request(method, path, body, token) {
    if (
      !(method === "GET" && READ_PATHS.has(path)) &&
      !(method === "POST" && path === "/oauth/token")
    )
      throw new HubsoftError("METODO_OU_ROTA_BLOQUEADO");
    const base = new URL(this.env.HUBSOFT_API_URL);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !["", "/"].includes(base.pathname)
    )
      throw new HubsoftError("URL_HUBSOFT_INVALIDA");
    const url = new URL(path, base);
    if (method === "GET" && path === "/api/v1/integracao/cliente/atendimento") {
      if (body.clientCode !== undefined) {
        if (!/^\d{1,40}$/.test(String(body.clientCode))) throw new HubsoftError("CLIENTE_INVALIDO");
        validateDay(body.day);
        url.search = new URLSearchParams({ busca:"codigo_cliente", termo_busca:String(body.clientCode), limit:"50", apenas_pendente:"nao", data_inicio:body.day, data_fim:body.day, order_by:"data_cadastro", order_type:"asc" }).toString();
      } else {
      if (typeof body.protocol !== "string" || !/^\d{1,40}$/.test(body.protocol))
        throw new HubsoftError("PROTOCOLO_INVALIDO");
      url.search = new URLSearchParams({ busca: "protocolo", termo_busca: body.protocol,
        limit: "1", apenas_pendente: "nao", order_by: "data_cadastro", order_type: "asc" }).toString();
      }
    } else if (method === "GET") {
      validateDay(body.day);
      if (!Number.isInteger(body.page) || body.page < 0)
        throw new HubsoftError("PAGINA_INVALIDA");
      url.search = new URLSearchParams({
        data_inicio: body.day,
        data_fim: body.day,
        tipo_data: body.dateField,
        pagina: String(body.page),
        itens_por_pagina: "50",
        ...(path.includes("/ordem_servico/")
          ? { destino: "cliente_servico" }
          : {}),
        ...(body.relations ? { relacoes: body.relations } : {}),
        ...(path.includes("/atendimento/")
          ? { order_by: "id_atendimento", order_by_key: "ASC" }
          : {}),
      }).toString();
    }
    const send = async () => {
      let response;
      try { response = await this.fetcher(url, { method, redirect:"error", signal:AbortSignal.timeout(25000), headers:{ Accept:"application/json", ...(token?{Authorization:"Bearer "+token}:{}), ...(method==="POST"?{"Content-Type":"application/json"}:{}) }, ...(method==="POST"?{body:JSON.stringify(body)}:{}) }); }
      catch { throw new HubsoftError("HUBSOFT_CONEXAO_OU_TIMEOUT"); }
      const bytes = await limitedBody(response,8*1024*1024);
      let data,error;
      try { data=JSON.parse(bytes); } catch { data={}; if(response.status!==429) error=new HubsoftError("HUBSOFT_RESPOSTA_INVALIDA"); }
      if(!response.ok && response.status!==429) error=new HubsoftError(response.status===401?"HUBSOFT_AUTENTICACAO":"HUBSOFT_HTTP_"+response.status);
      if(data.status==="error"||data.status==="erro"||data.status===false) error=new HubsoftError("HUBSOFT_CONSULTA_RECUSADA");
      return {status:response.status,data,error,policy:safePolicy(response.headers.get("X-RateLimit-Policy")),retrySeconds:retryDelay(response,data)};
    };
    if(this.gate) {
      try { return await this.gate.perform({method,path},send); }
      catch(error) { if(error.code==="HUBSOFT_AUTENTICACAO") { this.token=null; this.expires=0; await this.gate.invalidateToken(); } throw error; }
    }
    if (this.lastCall > Date.now() + 1000)
      throw new HubsoftError("HUBSOFT_LIMITE_AGUARDE");
    await this.sleep(Math.max(0, 1000 - (Date.now() - this.lastCall)));
    this.lastCall = Date.now();
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(25000),
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new HubsoftError("HUBSOFT_CONEXAO_OU_TIMEOUT");
    }
    const bytes = await limitedBody(response, 8 * 1024 * 1024);
    let data;
    try {
      data = JSON.parse(bytes);
    } catch {
      if (response.status !== 429) throw new HubsoftError("HUBSOFT_RESPOSTA_INVALIDA");
      data = {};
    }
    if (response.status === 429) {
      const retry = response.headers.get("retry-after");
      const seconds = Number(retry ?? data?.retry_after);
      const wait =
        Number.isFinite(seconds) && seconds >= 0
          ? seconds * 1000
          : Math.max(1000, Date.parse(retry) - Date.now() || 60000);
      // This bounded request stops instead of retrying indefinitely. Caller must retry later.
      this.lastCall = Date.now() + Math.max(1000, wait);
      throw new HubsoftError("HUBSOFT_LIMITE_AGUARDE");
    }
    if (!response.ok)
      throw new HubsoftError(
        response.status === 401
          ? "HUBSOFT_AUTENTICACAO"
          : "HUBSOFT_HTTP_" + response.status,
      );
    if (
      data.status === "error" ||
      data.status === "erro" ||
      data.status === false
    )
      throw new HubsoftError("HUBSOFT_CONSULTA_RECUSADA");
    return data;
  }
  async authenticate() {
    if (!this.configured) throw new HubsoftError("HUBSOFT_NAO_CONFIGURADA");
    if (!this.token || Date.now() >= this.expires) {
      const issue = () => this.request("POST", "/oauth/token", {
        grant_type: "password",
        client_id: this.env.HUBSOFT_CLIENT_ID,
        client_secret: this.env.HUBSOFT_CLIENT_SECRET,
        username: this.env.HUBSOFT_USERNAME,
        password: this.env.HUBSOFT_PASSWORD,
      });
      const d = this.gate ? await this.gate.token(issue) : await issue();
      if (
        typeof d.access_token !== "string" ||
        !Number.isFinite(Number(d.expires_in)) ||
        Number(d.expires_in) <= 0
      )
        throw new HubsoftError("HUBSOFT_TOKEN_INVALIDO");
      this.token = d.access_token;
      this.expires =
        Date.now() + Math.max(0, Number(d.expires_in) * 1000);
    }
  }
  clientAttendances(clientCode, day) {
    const task=this.queue.then(async()=>{
      validateDay(day);
      if(!/^\d{1,40}$/.test(String(clientCode))) throw new HubsoftError("CLIENTE_INVALIDO");
      await this.authenticate();
      const data=await this.request("GET","/api/v1/integracao/cliente/atendimento",{clientCode,day},this.token);
      if(!Array.isArray(data.atendimentos)||data.atendimentos.length>=50) throw new HubsoftError("HUBSOFT_CLIENTE_PAGINACAO_NAO_CONFIRMADA");
      for(const row of data.atendimentos) if(String(row.cliente?.codigo_cliente??row.codigo_cliente)!==String(clientCode)) throw new HubsoftError("HUBSOFT_CLIENTE_DIVERGENTE");
      return data.atendimentos;
    });
    this.queue=task.catch(()=>{}); return task;
  }
  attendanceOpener(protocol) {
    const task = this.queue.then(async () => {
      if (typeof protocol !== "string" || !/^\d{1,40}$/.test(protocol))
        throw new HubsoftError("PROTOCOLO_INVALIDO");
      await this.authenticate();
      let data;
      try {
        data = await this.request("GET", "/api/v1/integracao/cliente/atendimento", { protocol }, this.token);
      } catch (error) {
        if (error.code === "HUBSOFT_AUTENTICACAO") { this.token = null; this.expires = 0; }
        throw error;
      }
      if (!Array.isArray(data.atendimentos) || data.atendimentos.length !== 1 ||
          String(data.atendimentos[0]?.protocolo) !== protocol)
        throw new HubsoftError("HUBSOFT_CONSULTA_PROTOCOLO_DIVERGENTE");
      const name = data.atendimentos[0].usuario_abertura;
      if (typeof name !== "string" || !name.trim() || name.trim().length > 150)
        throw new HubsoftError("HUBSOFT_USUARIO_ABERTURA_NAO_RETORNADO");
      return name.trim();
    });
    this.queue = task.catch(() => {});
    return task;
  }
  page(stream, day, page, dateFieldOverride) {
    const task = this.queue.then(async () => {
      validateDay(day);
      if (
        ![
          "attendance",
          "attendanceChanges",
          "serviceOrders",
          "serviceOrderCompletions",
        ].includes(stream)
      )
        throw new HubsoftError("FLUXO_INVALIDO");
      if (!Number.isInteger(page) || page < 0)
        throw new HubsoftError("PAGINA_INVALIDA");
      if (!this.configured) throw new HubsoftError("HUBSOFT_NAO_CONFIGURADA");
      await this.authenticate();
      const streams = {
        attendanceChanges: {
          path: "/api/v1/integracao/atendimento/todos",
          key: "atendimentos",
          dateField: "data_ultima_alteracao",
          relations: "cliente_servico,atendimento_mensagem",
        },
        serviceOrderCompletions: {
          path: "/api/v1/integracao/ordem_servico/todos",
          key: "ordens_servico",
          dateField: "data_termino_executado",
        },
        attendance: {
          path: "/api/v1/integracao/atendimento/todos",
          key: "atendimentos",
          dateField: "data_cadastro",
          relations: "cliente_servico,atendimento_mensagem",
        },
        serviceOrders: {
          path: "/api/v1/integracao/ordem_servico/todos",
          key: "ordens_servico",
          dateField: "data_inicio_programado",
        },
      };
      if(dateFieldOverride && (stream!=="serviceOrders" || !["data_cadastro","data_inicio_programado","data_termino_executado"].includes(dateFieldOverride))) throw new HubsoftError("FILTRO_OS_INVALIDO");
      const spec = streams[stream];
      if (!spec) throw new HubsoftError("FLUXO_INVALIDO");
      let data;
      try {
        data = await this.request(
          "GET",
          spec.path,
          { day, page, dateField: dateFieldOverride ?? spec.dateField, relations: spec.relations },
          this.token,
        );
      } catch (e) {
        if (e.code === "HUBSOFT_AUTENTICACAO") {
          this.token = null;
          this.expires = 0;
        }
        throw e;
      }
      if (!Array.isArray(data[spec.key]) || data[spec.key].length > 50)
        throw new HubsoftError("HUBSOFT_PAGINACAO_INVALIDA");
      const p = data.paginacao;
      if (
        !p ||
        !Number.isInteger(p.pagina_atual) ||
        !Number.isInteger(p.ultima_pagina) ||
        p.pagina_atual !== page ||
        p.ultima_pagina < page
      )
        throw new HubsoftError("HUBSOFT_PAGINACAO_INVALIDA");
      return { records: data[spec.key], complete: page >= p.ultima_pagina };
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
async function limitedBody(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) throw new HubsoftError("HUBSOFT_RESPOSTA_VAZIA");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HubsoftError("HUBSOFT_RESPOSTA_GRANDE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
