import { getTeam } from "@/lib/data/service";
import { costPerSuccess } from "@/lib/data/aggregate";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) return notFound("agent team");
  return ok({ ...team, costPerSuccess: costPerSuccess(team) });
}
