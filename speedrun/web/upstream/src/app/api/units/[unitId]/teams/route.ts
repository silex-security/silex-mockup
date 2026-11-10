import { getUnit } from "@/lib/data/service";
import { costPerSuccess } from "@/lib/data/aggregate";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) return notFound("business unit");
  return ok(unit.teams.map((t) => ({ ...t, costPerSuccess: costPerSuccess(t) })));
}
