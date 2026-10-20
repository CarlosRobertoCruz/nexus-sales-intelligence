import { pool } from "./db.mjs";
import { createUser } from "./users.mjs";
try {
  const email = process.env.INITIAL_USER_EMAIL?.trim().toLowerCase();
  const name = process.env.INITIAL_USER_NAME?.trim();
  if (!email || !email.includes("@") || !name)
    throw new Error("Configure INITIAL_USER_EMAIL e INITIAL_USER_NAME.");
  await createUser(pool, {
    email,
    name,
    password: process.env.INITIAL_USER_PASSWORD,
  });
  console.log("Usuario criado. Todas as contas possuem as mesmas permissoes.");
} finally {
  await pool.end();
}
