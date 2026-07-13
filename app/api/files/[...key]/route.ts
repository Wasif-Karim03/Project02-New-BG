import { auth } from "@/auth";
import { canViewFile, isPublicFile } from "@/lib/services/file-access";
import { readUpload } from "@/lib/storage";

// File serving. Uploaded documents (result sheets, non-consented photos) are
// minors' PII, so every request is authorized before a byte is returned. The
// exceptions are consent-gated portraits and donor-published tribute photos:
// those are public, so the marketing site can render them — but the public/consent
// check runs LIVE on every request, so revoking consent stops serving within the
// short cache window below (no stale public copies).
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const keyStr = key.join("/");
  const fileUrl = `/api/files/${keyStr}`;

  const isPublic = await isPublicFile(fileUrl);
  if (!isPublic) {
    const session = await auth();
    if (!(await canViewFile(session?.user, fileUrl))) return new Response("Forbidden", { status: 403 });
  }

  try {
    const { bytes, contentType } = await readUpload(keyStr);
    // Public files get a short shared cache (CDN) so revocation propagates fast;
    // private files are never cached anywhere.
    const cacheControl = isPublic ? "public, max-age=300, s-maxage=300" : "private, no-store";
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": cacheControl },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
