import { pool } from "./db.mjs";
try {
  const [id, ...parts] = process.argv.slice(2);
  const name = parts.join(" ").trim();
  if (!/^\d+$/.test(id ?? "") || !name || name.length > 150)
    throw new Error("Uso: node server/map-user.mjs ID_USUARIO Nome do usuario");
  await pool.query(
    `INSERT INTO application_settings(key,value) VALUES('hubsoft_user_names',jsonb_build_object($1::text,$2::text))
 ON CONFLICT(key) DO UPDATE SET value=application_settings.value || excluded.value`,
    [id, name],
  );
  console.log("Mapeamento de usuario Hubsoft salvo.");
} finally {
  await pool.end();
}
