import { getTeamStructure } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const s = getTeamStructure(teamId);
  return s ? ok(s) : notFound("team structure");
}
