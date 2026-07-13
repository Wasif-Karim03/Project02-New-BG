import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Provider-agnostic file storage. Callers only ever deal in opaque keys like
// "applications/ab12cd.jpg" — they never know or care where bytes live. Bytes
// NEVER go in the DB or git, and uploads are served ONLY through the /api/files
// route (minors' PII), or — for consent-gated portraits and public tributes —
// that same route with a public cache header.
//
// Backend is chosen by env: if R2 (S3-compatible object storage) is configured we
// use it (production, since serverless disk is ephemeral); otherwise bytes go to a
// local gitignored `uploads/` dir (dev + CI). No caller changes when it swaps.

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"],
]);
const EXT_TO_TYPE = new Map([...ALLOWED.entries()].map(([type, ext]) => [ext, type]));
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export class UploadRejectedError extends Error {
  constructor(msg: string) { super(msg); this.name = "UploadRejectedError"; }
}

// ── R2 (S3-compatible) backend ──────────────────────────────────────────────
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const useR2 = Boolean(R2_BUCKET && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
    });
  }
  return _s3;
}

// ── Local disk backend (dev/CI) ─────────────────────────────────────────────
const ROOT = path.join(process.cwd(), "uploads");

function extFor(contentType: string): string {
  const e = ALLOWED.get(contentType);
  if (!e) throw new UploadRejectedError("Only JPEG, PNG, WebP, or PDF files are allowed.");
  return e;
}
function validateSize(bytes: Buffer) {
  if (bytes.length === 0) throw new UploadRejectedError("Empty file.");
  if (bytes.length > MAX_BYTES) throw new UploadRejectedError("File exceeds the 5 MB limit.");
}

/** Save bytes under `dir`, returning an opaque key like "applications/ab12cd.jpg". */
export async function saveUpload(dir: string, contentType: string, bytes: Buffer): Promise<string> {
  const ext = extFor(contentType);
  validateSize(bytes);
  const safeDir = dir.replace(/[^a-z0-9_-]/gi, "");
  const key = `${safeDir}/${randomBytes(12).toString("hex")}.${ext}`;

  if (useR2) {
    await s3().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: contentType }));
    return key;
  }
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return key;
}

/** Read bytes for a key, guarding against path traversal (local) / bad keys (R2). */
export async function readUpload(key: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (useR2) {
    const out = await s3().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const bytes = Buffer.from(await out.Body!.transformToByteArray());
    const contentType = out.ContentType ?? EXT_TO_TYPE.get(path.extname(key).slice(1).toLowerCase()) ?? "application/octet-stream";
    return { bytes, contentType };
  }
  const full = path.normalize(path.join(ROOT, key));
  if (!full.startsWith(ROOT + path.sep)) throw new Error("invalid key");
  const bytes = await readFile(full);
  const contentType = EXT_TO_TYPE.get(path.extname(full).slice(1).toLowerCase()) ?? "application/octet-stream";
  return { bytes, contentType };
}
