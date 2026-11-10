import { getBenchmarks } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const b = getBenchmarks(teamId);
  return b ? ok(b) : notFound("benchmark suite");
}
