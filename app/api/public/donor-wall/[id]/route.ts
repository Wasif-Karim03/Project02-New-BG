import { cachedJson, enforceRateLimit } from "@/lib/public/http";
import { projectDonorProfile } from "@/lib/public/projection";

// Public per-donor profile (named donors only). Anonymous donors → 404.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  const { id } = await params;
  const profile = await projectDonorProfile(id);
  if (!profile) return new Response("Not found", { status: 404 });
  return cachedJson(profile);
}
