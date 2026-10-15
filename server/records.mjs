import { randomUUID } from "node:crypto";
import { classifyCommercialRows } from "../server-dist/commercial.js";
export const KINDS = [
  "attendance",
  "serviceOrders",
  "sales",
  "renewals",
  "cancellations",
  "reactivations",
];
export const MAX_ROWS = 50000;
const keys = { attendance: "protocolo", serviceOrders: "numero_ordem_servico" };
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function worksheetRecords(worksheet, kind) {
  if (
    !worksheet ||
    !Array.isArray(worksheet.rows) ||
    worksheet.rows.length < 2 ||
    worksheet.rows.length > MAX_ROWS + 1
  )
    throw new Error("PLANILHA_INVALIDA_OU_MUITO_GRANDE");
  const [header, ...rows] = worksheet.rows;
  if (!Array.isArray(header) || header.length > 150)
    throw new Error("CABECALHO_INVALIDO");
  const names = header.map(norm);
  const required =
    kind === "attendance"
      ? [
          "protocolo",
          "nome_razaosocial",
          "descricao_abertura",
          "data_cadastro",
          "usuario_abertura",
          "status",
          "tipo_atendimento",
        ]
      : [
          "numero_ordem_servico",
          "tipo_ordem_servico",
          "status",
          "data_inicio_programado",
          "data_inicio_executado",
          "data_termino_executado",
        ];
  if (required.some((key) => !names.includes(key)))
    throw new Error("COLUNAS_OBRIGATORIAS_AUSENTES");
  if (new Set(names).size !== names.length || !names.includes(keys[kind]))
    throw new Error("CABECALHO_INVALIDO");
  return rows
    .filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== ""))
    .map((row) => {
      if (
        row.length > 150 ||
        row.some(
          (v) =>
            v !== null && !["string", "number", "boolean"].includes(typeof v),
        )
      )
        throw new Error("CELULA_INVALIDA");
      const record = Object.fromEntries(
        names.map((n, i) => {
          const value = row[i] ?? null;
          if (
            n.startsWith("data_") &&
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}T/.test(value)
          ) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) throw new Error("DATA_INVALIDA");
            return [
              n,
              `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
            ];
          }
          return [n, value];
        }),
      );
      if (!/^\d+$/.test(String(record[keys[kind]] ?? "")))
        throw new Error("IDENTIFICADOR_INVALIDO");
      return record;
    });
}
export async function upsertRows(db, kind, records, source) {
  if (!records.length) return;
  const values = records.map((payload) => ({
    id: String(payload[keys[kind]]),
    payload,
  }));
  // Same business record from a spreadsheet and from Hubsoft has the same key.
  const unique = [...new Map(values.map((v) => [v.id, v])).values()];
  await db.query(
    `INSERT INTO source_records(kind,id,payload,source)
 SELECT $1,r.id,r.payload,$3 FROM jsonb_to_recordset($2::jsonb) AS r(id text,payload jsonb)
 ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload,source=excluded.source,updated_at=now()`,
    [kind, JSON.stringify(unique), source],
  );
  const count = Number(
    (await db.query("SELECT count(*) AS count FROM source_records")).rows[0]
      .count,
  );
  if (count > MAX_ROWS) throw new Error("BASE_ATINGIU_LIMITE_50000_REGISTROS");
}
function worksheet(records, kind) {
  const required =
    kind === "attendance"
      ? [
          "protocolo",
          "nome_razaosocial",
          "descricao_abertura",
          "data_cadastro",
          "usuario_abertura",
          "status",
          "tipo_atendimento",
        ]
      : [
          "numero_ordem_servico",
          "tipo_ordem_servico",
          "status",
          "data_inicio_programado",
          "data_inicio_executado",
          "data_termino_executado",
        ];
  const headers = [
    ...new Set([...required, ...records.flatMap((r) => Object.keys(r))]),
  ];
  return {
    fileName: "Base central",
    rows: [headers, ...records.map((r) => headers.map((k) => r[k] ?? null))],
  };
}
export async function rebuild(db) {
  const raw = (
    await db.query("SELECT kind,payload FROM source_records ORDER BY kind,id")
  ).rows;
  const a = raw.filter((r) => r.kind === "attendance").map((r) => r.payload),
    o = raw.filter((r) => r.kind === "serviceOrders").map((r) => r.payload);
  if (!a.length || !o.length) {
    // Never keep stale metrics after the upstream deletes the final source records.
    const previous = Number(
      (await db.query("SELECT count(*) AS count FROM commercial_records"))
        .rows[0].count,
    );
    if (previous) await db.query("DELETE FROM commercial_records");
    return {
      published: previous > 0,
      warnings: ["Importe atendimentos e OS para gerar indicadores."],
    };
  }
  const classified = classifyCommercialRows(
    worksheet(a, "attendance"),
    worksheet(o, "serviceOrders"),
  );
  await db.query("DELETE FROM commercial_records");
  for (const kind of KINDS) {
    const records = classified[kind].map((r) => ({
      id: r.businessKey ?? r.id,
      event_date: r.date.toISOString(),
      payload: r,
    }));
    if (records.length)
      await db.query(
        `INSERT INTO commercial_records(kind,id,event_date,payload)
   SELECT $1,r.id,r.event_date,r.payload FROM jsonb_to_recordset($2::jsonb) AS r(id text,event_date timestamptz,payload jsonb)`,
        [kind, JSON.stringify(records)],
      );
  }
  await db.query(
    `INSERT INTO application_settings(key,value) VALUES('quality',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [
      JSON.stringify({
        warnings: classified.warnings,
        updatedAt: new Date().toISOString(),
      }),
    ],
  );
  return { published: true, warnings: classified.warnings };
}
export async function loadLedger(db) {
  const ledger = {
    version: 1,
    ...Object.fromEntries(KINDS.map((k) => [k, []])),
  };
  for (const row of (
    await db.query(
      "SELECT kind,payload FROM commercial_records ORDER BY kind,id",
    )
  ).rows)
    ledger[row.kind].push(row.payload);
  return ledger;
}
export async function importWorksheets(db, body, userId) {
  const a = worksheetRecords(body.attendance, "attendance"),
    o = worksheetRecords(body.serviceOrders, "serviceOrders");
  await upsertRows(db, "attendance", a, "spreadsheet");
  await upsertRows(db, "serviceOrders", o, "spreadsheet");
  const result = await rebuild(db);
  await db.query(
    "INSERT INTO import_runs(id,source,user_id,record_count) VALUES($1,$2,$3,$4)",
    [randomUUID(), "spreadsheet", userId, a.length + o.length],
  );
  return { ...result, records: a.length + o.length };
}
