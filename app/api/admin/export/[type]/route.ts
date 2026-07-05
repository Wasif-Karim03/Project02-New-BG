import { auth } from "@/auth";
import { exportDonationsCsv, exportDonorsCsv, exportStudentsCsv } from "@/lib/services/exports";

// Admin-only CSV export. Streams a downloadable file; never exposed publicly.
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    return new Response("Forbidden", { status: 403 });
  }
  const { type } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let csv: string;
  if (type === "donations") {
    csv = await exportDonationsCsv({ from: from ? new Date(from) : undefined, to: to ? new Date(`${to}T23:59:59`) : undefined });
  } else if (type === "donors") {
    csv = await exportDonorsCsv();
  } else if (type === "students") {
    csv = await exportStudentsCsv();
  } else {
    return new Response("Unknown export type", { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
