import { prisma } from "@/lib/prisma";

// Liveness + DB readiness. Returns 503 if the database is unreachable.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
