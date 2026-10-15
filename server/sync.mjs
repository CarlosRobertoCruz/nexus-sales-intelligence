import { randomUUID } from "node:crypto";
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
  try {
    locked = (await db.query("SELECT pg_try_advisory_lock(73190602) AS locked"))
      .rows[0].locked;
    if (!locked) throw new Error("SINCRONIZACAO_EM_ANDAMENTO");
    if (!hubsoft.configured) throw new Error("HUBSOFT_NAO_CONFIGURADA");
    await db.query(
      "INSERT INTO sync_runs(id,day,user_id,status) VALUES($1,$2,$3,$4)",
      [id, day, userId, "running"],
    );
    if (restart) await db.query("DELETE FROM sync_cursors WHERE day=$1", [day]);
    const userNames =
      (
        await db.query(
          "SELECT value FROM application_settings WHERE key='hubsoft_user_names'",
        )
      ).rows[0]?.value ?? {};
    for (const [stream, kind] of STREAMS) {
      let cursor = (
        await db.query(
          "SELECT page,complete FROM sync_cursors WHERE day=$1 AND stream=$2",
          [day, stream],
        )
      ).rows[0] ?? { page: 0, complete: false };
      while (!cursor.complete && pages < 4) {
        const result = await hubsoft.page(stream, day, cursor.page);
        // Missing fields stop the page before advancing its durable checkpoint.
        const rows = result.records
          .filter((r) => !r.deleted_at)
          .map((r) => normalizeHubsoft(kind, r, userNames));
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
    return { day, pages, records, complete, ...publication };
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
