import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Provider-agnostic file storage. Local disk in dev (gitignored `uploads/`),
// swappable to object storage (R2/S3/UploadThing) at handoff WITHOUT touching
// callers — they only deal in opaque keys. Bytes NEVER go in the DB or git, and
// uploads are served ONLY through the authenticated /api/files route (minors' PII).
const ROOT = path.join(process.cwd(), "uploads");

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"],
]);
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export class UploadRejectedError extends Error {
  constructor(msg: string) { super(msg); this.name = "UploadRejectedError"; }
}

/** Save bytes under `dir`, returning an opaque key like "applications/ab12cd.jpg". */
export async function saveUpload(dir: string, contentType: string, bytes: Buffer): Promise<string> {
  const ext = ALLOWED.get(contentType);
  if (!ext) throw new UploadRejectedError("Only JPEG, PNG, WebP, or PDF files are allowed.");
  if (bytes.length === 0) throw new UploadRejectedError("Empty file.");
  if (bytes.length > MAX_BYTES) throw new UploadRejectedError("File exceeds the 5 MB limit.");
  const safeDir = dir.replace(/[^a-z0-9_-]/gi, "");
  const key = `${safeDir}/${randomBytes(12).toString("hex")}.${ext}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return key;
}

/** Read bytes for a key, guarding against path traversal. */
export async function readUpload(key: string): Promise<{ bytes: Buffer; contentType: string }> {
  const full = path.normalize(path.join(ROOT, key));
  if (!full.startsWith(ROOT + path.sep)) throw new Error("invalid key");
  const bytes = await readFile(full);
  const ext = path.extname(full).slice(1).toLowerCase();
  const contentType = [...ALLOWED.entries()].find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { bytes, contentType };
}
