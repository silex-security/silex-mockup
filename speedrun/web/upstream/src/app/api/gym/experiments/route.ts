import { createExperiment, experimentCounts, listExperiments, ValidationError } from "@/lib/data/service";
import type { CreateExperimentInput, ExperimentStatus } from "@/lib/types";
import { badRequest, ok } from "@/lib/http";

const STATUSES: ExperimentStatus[] = ["pending", "queued", "running", "needs-review", "done"];

export function GET(req: Request) {
  const s = new URL(req.url).searchParams.get("status");
  if (s && !STATUSES.includes(s as ExperimentStatus)) return badRequest(`status must be one of ${STATUSES.join(", ")}`);
  return ok({ experiments: listExperiments((s as ExperimentStatus) ?? undefined), counts: experimentCounts() });
}

export async function POST(req: Request) {
  let body: CreateExperimentInput;
  try {
    body = (await req.json()) as CreateExperimentInput;
  } catch {
    return badRequest("body must be JSON");
  }
  try {
    return ok(createExperiment(body), { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    throw e;
  }
}
