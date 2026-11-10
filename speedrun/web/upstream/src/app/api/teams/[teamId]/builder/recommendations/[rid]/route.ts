import { buildRecommendation } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

/** POST: start building a recommended case family. */
export async function POST(_req: Request, { params }: { params: Promise<{ teamId: string; rid: string }> }) {
  const { teamId, rid } = await params;
  const rec = buildRecommendation(teamId, rid);
  return rec ? ok(rec) : notFound("recommendation");
}
