import { cachedJson, enforceRateLimit } from "@/lib/public/http";
import { projectStudentBySlug } from "@/lib/public/projection";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const { slug } = await params;
  const student = await projectStudentBySlug(slug);
  if (!student) return new Response("Not found", { status: 404 });
  return cachedJson(student);
}
