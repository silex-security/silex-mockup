import { getUnit, unitRoles } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) return notFound("business unit");
  return ok({ ...unit, roles: unitRoles(unitId) });
}
