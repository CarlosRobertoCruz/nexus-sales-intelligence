import { randomUUID } from "node:crypto";
import { pool } from "./db.mjs";
import { passwordHash } from "./auth.mjs";
try {
  const email = process.env.INITIAL_USER_EMAIL?.trim().toLowerCase();
  const name = process.env.INITIAL_USER_NAME?.trim();
  if (!email || !email.includes("@") || !name)
    throw new Error("Configure INITIAL_USER_EMAIL e INITIAL_USER_NAME.");
  const hash = await passwordHash(process.env.INITIAL_USER_PASSWORD);
  await pool.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
    [randomUUID(), email, name, hash],
  );
  console.log("Usuario criado. Todas as contas possuem as mesmas permissoes.");
} finally {
  await pool.end();
}
