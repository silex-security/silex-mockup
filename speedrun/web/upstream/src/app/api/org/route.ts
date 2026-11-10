import { getOrg } from "@/lib/data/service";
import { ok } from "@/lib/http";

export function GET() {
  return ok(getOrg());
}
