import { auth } from "@/auth";
import { canViewFile } from "@/lib/services/file-access";
import { readUpload } from "@/lib/storage";

// Authenticated file serving. Uploaded documents (result sheets, student photos)
// are minors' PII — every request is authorized before a single byte is returned.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const keyStr = key.join("/");
  const fileUrl = `/api/files/${keyStr}`;

  const session = await auth();
  if (!(await canViewFile(session?.user, fileUrl))) return new Response("Forbidden", { status: 403 });

  try {
    const { bytes, contentType } = await readUpload(keyStr);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
