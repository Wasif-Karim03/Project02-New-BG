import { cachedJson, enforceRateLimit } from "@/lib/public/http";
import { projectProjects } from "@/lib/public/projection";

export async function GET(req: Request) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;
  return cachedJson(await projectProjects());
}
