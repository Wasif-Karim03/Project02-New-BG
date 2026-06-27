import { randomBytes, scrypt as _scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// promisify resolves to the no-options scrypt overload; type it explicitly so we
// can pass cost parameters (N/r/p).
const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt parameters. N must be a power of two; these are sensible 2024-era
// interactive-login defaults. Encoded into the stored string so they can be
// raised later without breaking existing hashes.
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Hash a plaintext password. Output is self-describing:
 *   scrypt$<N>$<r>$<p>$<saltB64>$<keyB64>
 * Stored in User.passwordHash. Never log this value.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = (await scrypt(plain.normalize("NFKC"), salt, KEYLEN, { N, r, p })) as Buffer;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * Verify a plaintext password against a stored hash. Constant-time compare.
 * Returns false for any malformed/empty input rather than throwing.
 */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, keyB64] = parts;
  const params = { N: Number(nStr), r: Number(rStr), p: Number(pStr) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = (await scrypt(plain.normalize("NFKC"), salt, expected.length, params)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
