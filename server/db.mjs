import pg from "pg";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL no backend.");
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  options:
    "-c search_path=nexus_sales_intelligence,public -c statement_timeout=60000",
});
pool.on("error", () =>
  console.error("Falha na conexao ociosa com PostgreSQL."),
);
export async function transaction(work) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
