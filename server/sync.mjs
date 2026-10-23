import { createHash, randomUUID } from "node:crypto";
import { pool } from "./db.mjs";
import { HubsoftClient, validateDay } from "./hubsoft.mjs";
import { normalizeHubsoft } from "./hubsoftAdapter.mjs";
import { upsertRows, rebuild } from "./records.mjs";
export const hubsoft = new HubsoftClient();
const STREAMS = [
  ["attendance", "attendance"],
  ["attendanceChanges", "attendance"],
  ["serviceOrders", "serviceOrders"],
  ["serviceOrderCompletions", "serviceOrders"],
];
export async function syncDay(day, userId, restart = false) {
  validateDay(day);
  const db = await pool.connect();
  const id = randomUUID();
  let locked = false;
  let pages = 0,
    records = 0;
  let requests = 0;
  try {
    locked = (await db.query("SELECT pg_try_advisory_lock(73190602) AS locked"))
      .rows[0].locked;
    if (!locked) throw new Error("SINCRONIZACAO_EM_ANDAMENTO");
    if (!hubsoft.configured) throw new Error("HUBSOFT_NAO_CONFIGURADA");
    await db.query(
      "INSERT INTO sync_runs(id,day,user_id,status) VALUES($1,$2,$3,$4)",
      [id, day, userId, "running"],
    );
    if (restart) {
      await db.query("DELETE FROM sync_cursors WHERE day=$1", [day]);
      await db.query("DELETE FROM application_settings WHERE key LIKE $1", [`hubsoft_pending_openers:${day}:%`]);
    }
    const userNames =
      (
        await db.query(
          "SELECT value FROM application_settings WHERE key='hubsoft_user_names'",
        )
      ).rows[0]?.value ?? {};
    streams: for (const [stream, kind] of STREAMS) {
      let cursor = (
        await db.query(
          "SELECT page,complete FROM sync_cursors WHERE day=$1 AND stream=$2",
          [day, stream],
        )
      ).rows[0] ?? { page: 0, complete: false };
      while (!cursor.complete && requests < 4) {
        requests++;
        const result = await hubsoft.page(stream, day, cursor.page);
        const cacheKey = `hubsoft_pending_openers:${day}:${stream}`;
        const saved = kind === "attendance"
          ? (await db.query("SELECT value FROM application_settings WHERE key=$1", [cacheKey])).rows[0]?.value
          : null;
        const cache = saved?.page === cursor.page ? saved : { page: cursor.page, names: {} };
        const rows = [];
        for (const record of result.records.filter((r) => !r.deleted_at)) {
          try { rows.push(normalizeHubsoft(kind, record, userNames)); }
          catch (error) {
            const d = error.diagnostic;
            if (kind !== "attendance" || d?.missingFields?.length !== 1 ||
                d.missingFields[0] !== "usuario_abertura" || d.invalidFields.length) throw error;
            // A consulta complementar e unica por protocolo, sem reutilizar o responsavel atual.
            const protocol = String(record.protocolo);
            // Nao usar campos dinamicos como tempo_restante: mudam sem alterar a autoria.
            const fingerprint = createHash("sha256").update(JSON.stringify({
              protocol, openerId: record.id_usuario_abertura ?? null,
              changedAt: record.data_ultima_alteracao ?? record.updated_at ?? null,
            })).digest("hex");
            let name = cache.names[protocol]?.fingerprint === fingerprint ? cache.names[protocol].name : null;
            if (!name) {
              if (requests >= 4) break streams;
              requests++;
              name = await hubsoft.attendanceOpener(protocol);
              cache.names[protocol] = { fingerprint, name };
              // Persistir somente a resolucao pendente; nao publicar nem avancar a pagina.
              await db.query(`INSERT INTO application_settings(key,value) VALUES($1,$2::jsonb)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [cacheKey, JSON.stringify(cache)]);
            }
            rows.push(normalizeHubsoft(kind, { ...record, usuario_abertura: name }, {}));
          }
        }
        await db.query("BEGIN");
        try {
          await upsertRows(db, kind, rows, "hubsoft");
          // Soft-deleted upstream records must no longer contribute to metrics.
          for (const deleted of result.records.filter((r) => r.deleted_at)) {
            const key = String(
              kind === "attendance" ? deleted.protocolo : deleted.numero,
            );
            await db.query(
              "DELETE FROM source_records WHERE kind=$1 AND id=$2",
              [kind, key],
            );
          }
          await db.query(
            `INSERT INTO sync_cursors(day,stream,page,complete) VALUES($1,$2,$3,$4)
      ON CONFLICT(day,stream) DO UPDATE SET page=excluded.page,complete=excluded.complete,updated_at=now()`,
            [day, stream, cursor.page + 1, result.complete],
          );
          await db.query("DELETE FROM application_settings WHERE key=$1", [cacheKey]);
          await db.query("COMMIT");
        } catch (e) {
          await db.query("ROLLBACK");
          throw e;
        }
        pages++;
        records += rows.length;
        cursor = { page: cursor.page + 1, complete: result.complete };
      }
    }
    const complete =
      Number(
        (
          await db.query(
            "SELECT count(*) AS count FROM sync_cursors WHERE day=$1 AND complete",
            [day],
          )
        ).rows[0].count,
      ) === STREAMS.length;
    let publication = { published: false, warnings: [] };
    if (complete) {
      await db.query("BEGIN");
      try {
        publication = await rebuild(db);
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
    }
    await db.query(
      "UPDATE sync_runs SET status=$2,pages=$3,records=$4,finished_at=now() WHERE id=$1",
      [id, complete ? "complete" : "paused", pages, records],
    );
    return { day, pages, records, requests, complete, ...publication };
  } catch (error) {
    if (locked)
      await db.query(
        "UPDATE sync_runs SET status=$2,error_code=$3,pages=$4,records=$5,finished_at=now() WHERE id=$1",
        [id, "error", safeCode(error), pages, records],
      );
    throw error;
  } finally {
    if (locked) await db.query("SELECT pg_advisory_unlock(73190602)");
    db.release();
  }
}
export function safeCode(error) {
  const code = error?.code ?? error?.message;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{3,100}$/.test(code)
    ? code
    : "OPERACAO_NAO_CONCLUIDA";
}
