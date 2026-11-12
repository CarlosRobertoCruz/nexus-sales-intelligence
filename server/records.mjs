import { randomUUID } from "node:crypto";
import { classifyCommercialRecordRows } from "../server-dist/commercial.js";
export const KINDS = [
  "attendance",
  "serviceOrders",
  "sales",
  "renewals",
  "cancellations",
  "reactivations",
];
// Per-file/job protections stay at 50k; cumulative database storage has no row-count ceiling.
export const MAX_ROWS = 50000;
const WRITE_BATCH_ROWS = 1000;
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
  const values = [];
  const idField=kind==="attendance"?"id_atendimento":"id_ordem_servico";
  for(const payload of records) {
    const businessKey=String(payload[keys[kind]]);
    const upstream=payload[idField];
    if(upstream!==undefined && !/^\d{1,40}$/.test(String(upstream))) throw new Error("IDENTIFICADOR_INVALIDO");
    const existing=(await db.query(`SELECT id,payload FROM source_records WHERE kind=$1 AND (CASE WHEN kind='attendance' THEN payload->>'protocolo' ELSE payload->>'numero_ordem_servico' END)=$2`,[kind,businessKey])).rows;
    if(existing.length>1) throw new Error("IDENTIDADE_LEGADA_AMBIGUA");
    const canonical=upstream!==undefined ? "hubsoft:"+String(upstream) : existing[0]?.id??businessKey;
    if(upstream!==undefined && existing[0] && existing[0].id!==canonical) {
      if(existing[0].payload[idField] && String(existing[0].payload[idField])!==String(upstream)) throw new Error("IDENTIDADE_LEGADA_AMBIGUA");
      await db.query("UPDATE source_records SET id=$3 WHERE kind=$1 AND id=$2",[kind,existing[0].id,canonical]);
    }
    values.push({id:canonical,payload});
  }
  // Same business record from a spreadsheet and from Hubsoft has the same key.
  const unique = [...new Map(values.map((v) => [v.id, v])).values()];
  for(let offset=0;offset<unique.length;offset+=WRITE_BATCH_ROWS)await db.query(
    `INSERT INTO source_records(kind,id,payload,source)
 SELECT $1,r.id,r.payload,$3 FROM jsonb_to_recordset($2::jsonb) AS r(id text,payload jsonb)
 ON CONFLICT(kind,id) DO UPDATE SET
   payload=CASE
     WHEN excluded.payload->>'publication_scope'='manual_staging'
       AND COALESCE(source_records.payload->>'publication_scope','published') IN ('published','installation_context')
     THEN source_records.payload
     WHEN excluded.payload->>'publication_scope'='installation_context'
       AND COALESCE(source_records.payload->>'publication_scope','published')='published'
     THEN source_records.payload
     WHEN source_records.kind='serviceOrders'
       AND source_records.payload->'location_recovery'->>'source'='hubsoft_exact_service_current_installation_address'
       AND NOT (excluded.payload ? 'deleted_at' AND COALESCE(excluded.payload->>'deleted_at','')<>'')
       AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['id_ordem_servico','numero_ordem_servico','id_atendimento','codigo_cliente','data_inicio_executado','data_termino_executado']) AS identity_field(name)
         WHERE COALESCE(excluded.payload->>name,'')='' OR excluded.payload->>name IS DISTINCT FROM source_records.payload->>name)
       AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['bairro','cidade','id_cliente_servico']) AS geo_field(name)
         WHERE COALESCE(excluded.payload->>name,'')<>'' AND excluded.payload->>name IS DISTINCT FROM source_records.payload->>name)
     THEN excluded.payload || jsonb_build_object(
       'bairro',source_records.payload->>'bairro','cidade',source_records.payload->>'cidade',
       'id_cliente_servico',source_records.payload->>'id_cliente_servico',
       'location_recovery',source_records.payload->'location_recovery')
     ELSE excluded.payload
   END,
   source=CASE
     WHEN excluded.payload->>'publication_scope'='manual_staging'
       AND COALESCE(source_records.payload->>'publication_scope','published') IN ('published','installation_context')
     THEN source_records.source
     WHEN excluded.payload->>'publication_scope'='installation_context'
       AND COALESCE(source_records.payload->>'publication_scope','published')='published'
     THEN source_records.source
     ELSE excluded.source
   END,
   updated_at=now()`,
    [kind, JSON.stringify(unique.slice(offset,offset+WRITE_BATCH_ROWS)), source],
  );
}

// Versões antigas da sincronização pontual usavam a mesma tabela da base
// aprovada, mas não recebiam um ID Hubsoft canônico. Elas continuam guardadas
// para auditoria, porém não podem alterar o painel sem reconciliação.
export async function quarantineLegacyManualRows(db) {
  const rows = (await db.query(`UPDATE source_records
    SET payload=payload||jsonb_build_object('publication_scope','manual_staging')
    WHERE source='hubsoft'
      AND id NOT LIKE 'hubsoft:%'
      AND COALESCE(payload->>'publication_scope','')=''
    RETURNING kind`)).rows;
  return rows.reduce((counts, row) => ({
    ...counts,
    [row.kind]: (counts[row.kind] ?? 0) + 1,
  }), {});
}

export function classifyStoredRows(raw) {
  const a=raw.filter(row=>row.kind==='attendance').map(row=>row.payload);
  const o=raw.filter(row=>row.kind==='serviceOrders').map(row=>row.payload);
  if(!a.some(row=>row.publication_scope!=='installation_context')||!o.length)return null;
  return classifyCommercialRecordRows(a,o);
}
export async function rebuild(db) {
  const raw = (
    await db.query(`SELECT kind,payload FROM source_records
      WHERE COALESCE(payload->>'publication_scope','published') <> 'manual_staging'
      ORDER BY kind,id`)
  ).rows;
  const classified=classifyStoredRows(raw);
  if (!classified) {
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
  await db.query("DELETE FROM commercial_records");
  for (const kind of KINDS) {
    const events=classified[kind];
    for(let offset=0;offset<events.length;offset+=WRITE_BATCH_ROWS) {
      const records=events.slice(offset,offset+WRITE_BATCH_ROWS).map(r=>({id:r.businessKey??r.id,event_date:r.date.toISOString(),payload:r}));
      await db.query(
        `INSERT INTO commercial_records(kind,id,event_date,payload)
   SELECT $1,r.id,r.event_date,r.payload FROM jsonb_to_recordset($2::jsonb) AS r(id text,event_date timestamptz,payload jsonb)`,
        [kind, JSON.stringify(records)],
      );
    }
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
