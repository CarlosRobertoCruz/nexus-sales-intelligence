import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error("Senha deve ter entre 12 e 256 caracteres.");
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + Buffer.from(await scrypt(password, salt, 64)).toString("hex")
  );
}
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > 256) return false;
  const [salt, hex] = stored.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = Buffer.from(await scrypt(password, salt, 64));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const newToken = () => randomBytes(32).toString("hex");
