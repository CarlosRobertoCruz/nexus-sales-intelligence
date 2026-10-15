import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool, transaction } from "./db.mjs";
try {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(73190601)");
    await db.query("CREATE SCHEMA IF NOT EXISTS nexus_sales_intelligence");
    await db.query("SET LOCAL search_path TO nexus_sales_intelligence,public");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = new URL("../database/migrations/", import.meta.url);
    for (const name of (await readdir(dir))
      .filter((n) => /^\d+.*\.sql$/.test(n))
      .sort()) {
      const sql = await readFile(new URL(name, dir), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const old = (
        await db.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (old) {
        if (old.checksum !== checksum)
          throw new Error("Migracao aplicada foi alterada: " + name);
        continue;
      }
      await db.query(sql);
      await db.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.log("ok " + name);
    }
  });
  console.log("Migracoes prontas no schema nexus_sales_intelligence.");
} finally {
  await pool.end();
}
