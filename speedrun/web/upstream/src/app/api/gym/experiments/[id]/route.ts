import { experimentEstimate, getExperiment } from "@/lib/data/service";
import { notFound, ok } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getExperiment(id);
  if (!e) return notFound("experiment");
  return ok({ ...e, estimate: e.config ? experimentEstimate(e) : null });
}
