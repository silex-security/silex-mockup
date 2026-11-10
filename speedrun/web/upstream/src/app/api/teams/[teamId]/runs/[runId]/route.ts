import { getTraceRun } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string; runId: string }> }) {
  const { teamId, runId } = await params;
  const run = getTraceRun(teamId, runId);
  return run ? ok(run) : notFound("run");
}
