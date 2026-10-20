import { randomUUID } from "node:crypto";
import { passwordHash } from "./auth.mjs";

function invalid(code, status = 400) {
  const error = new Error(code);
  error.status = status;
  return error;
}
export async function createUser(db, input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw invalid("USUARIO_DADOS_INVALIDOS");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!name || name.length > 100) throw invalid("USUARIO_NOME_INVALIDO");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw invalid("USUARIO_EMAIL_INVALIDO");
  if (
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 256
  )
    throw invalid("USUARIO_SENHA_INVALIDA");
  const hash = await passwordHash(input.password);
  try {
    const result = await db.query(
      "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,name,active,created_at",
      [randomUUID(), email, name, hash],
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") throw invalid("USUARIO_EMAIL_EXISTENTE", 409);
    throw error;
  }
}
export async function listUsers(db, pageValue = "1") {
  if (!/^[1-9]\d{0,6}$/.test(pageValue))
    throw invalid("USUARIOS_PAGINA_INVALIDA");
  const page = Number(pageValue),
    pageSize = 20;
  const total = Number(
    (await db.query("SELECT count(*) AS total FROM users")).rows[0].total,
  );
  const users = (
    await db.query(
      "SELECT id,email,name,active,created_at FROM users ORDER BY lower(name),id LIMIT $1 OFFSET $2",
      [pageSize, (page - 1) * pageSize],
    )
  ).rows;
  return { users, total, page, pageSize };
}
