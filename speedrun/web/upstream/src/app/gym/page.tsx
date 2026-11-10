import Link from "next/link";
import { Main } from "@/components/AppHeader";
import { IconBolt, IconFlask, IconLayers, IconPlay, IconWarn } from "@/components/icons";
import { Card, btnClass, cx } from "@/components/ui";
import { experimentCounts, getSandboxCapacity, getTeam, getUnit, listExperiments } from "@/lib/data/service";
import { fmtAgo } from "@/lib/format";
import type { Experiment, ExperimentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent Gym · SILEX" };

const PAGE_SIZE = 8;
const STATUS: Record<ExperimentStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amb-wash text-amb-text ring-1 ring-inset ring-amb" },
  queued: { label: "Queued", cls: "bg-inset text-fg2 ring-1 ring-inset ring-line2" },
  running: { label: "▷ Running", cls: "bg-blue-wash text-blue" },
  "needs-review": { label: "Needs review", cls: "bg-acc-wash text-acc-text" },
  done: { label: "✓ Done", cls: "bg-mint-wash text-mint-text" },
};
const TABS: { id: ExperimentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "needs-review", label: "Needs review" },
  { id: "done", label: "Done" },
];

function action(e: Experiment) {
  switch (e.status) {
    case "pending":
      return { label: "Configure", href: `/gym/experiments/${e.id}`, primary: false };
    case "needs-review":
      return { label: "Review", href: `/gym/experiments/${e.id}`, primary: true };
    case "running":
      return { label: "Open", href: `/gym/experiments/${e.id}`, primary: false };
    case "done":
      return { label: "Results", href: `/gym/experiments/${e.id}`, primary: false };
    default:
      return { label: "View", href: `/gym/experiments/${e.id}`, primary: false };
  }
}

export default async function GymQueuePage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.id === sp.status) ? (sp.status as ExperimentStatus | "all") : "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const counts = experimentCounts();
  const all = listExperiments(status === "all" ? undefined : status).filter((e) => {
    if (!q) return true;
    const team = getTeam(e.teamId);
    return e.title.toLowerCase().includes(q) || team?.name.toLowerCase().includes(q);
  });
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cap = getSandboxCapacity();
  const running = listExperiments("running")[0];
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ status, page: String(page), ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/gym?${p.toString()}`;
  };

  return (
    <Main>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-acc-wash text-acc-text"><IconFlask size={26} /></span>
        <div>
          <h1 className="m-0 text-[32px] font-bold tracking-tight">Agent Gym</h1>
          <div className="text-[15px] text-mut">Test, compare, and review changes to your agent teams.</div>
        </div>
        <div className="flex-1" />
        <span className={btnClass()}><IconLayers />Test sets</span>
        <Link href="/speedrun/teams/refund/variant" className={btnClass(true)}>+ New experiment</Link>
      </div>

      <section aria-label="Status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Pending", n: counts.pending, sub: "Awaiting configuration" },
          { label: "Queued", n: counts.queued, sub: "Ready to run" },
          { label: "Running", n: counts.running, sub: running?.progress ? `${running.progress.done} / ${running.progress.total} cases` : "—" },
          { label: "Needs review", n: counts["needs-review"], sub: "Results ready" },
        ].map((x) => (
          <div key={x.label} className="card flex flex-col gap-1.5 px-5 py-4">
            <span className="font-semibold">{x.label}</span>
            <span className="text-3xl font-bold">{x.n}</span>
            <span className="lbl !text-[13px]">{x.sub}</span>
          </div>
        ))}
      </section>

      <Card aria-label="Experiment queue" className="overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 px-5 pt-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[22px] font-bold">Experiment queue</span>
            <nav aria-label="Filter by status" className="flex flex-wrap gap-6">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={href({ status: t.id, page: 1 })}
                  aria-current={status === t.id ? "page" : undefined}
                  className={cx("flex h-10 items-center gap-1.5 border-b-2 text-sm", status === t.id ? "border-acc2 font-semibold text-fg" : "border-transparent text-mut hover:text-fg")}
                >
                  {t.label} <span className="lbl">{counts[t.id]}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <form action="/gym" className="flex flex-wrap gap-2.5 border-t border-line px-5 py-3.5">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={sp.q} aria-label="Search experiments" placeholder="Search experiments or agent teams…" className="h-[42px] flex-[1_1_320px] rounded-[10px] border border-line2 bg-card px-3.5 text-sm text-fg outline-none" />
          <button type="submit" className={btnClass()}>Search</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="h-11 border-y border-line text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-mut">
                <th className="px-5">Experiment / agent team</th>
                <th>Source</th>
                <th>Objective</th>
                <th>Status</th>
                <th>Progress / result</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const team = getTeam(e.teamId)!;
                const unit = getUnit(team.unitId)!.unit;
                const a = action(e);
                return (
                  <tr key={e.id} className={cx("h-14 border-b border-line last:border-0", e.status === "pending" && e.id === rows[0]?.id && "bg-wash")}>
                    <td className="px-5">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold"><span className="font-mono text-mut">#{e.id}</span> {e.title}</span>
                        <span className="lbl">{team.name} · {unit.name}</span>
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line2 px-2.5 text-xs font-medium text-fg2">
                        {e.source === "speedrun" ? <><IconBolt size={13} />Speedrun</> : <>▭ Agent Studio</>}
                      </span>
                    </td>
                    <td className={cx("font-semibold", e.objective === "Cost" ? "text-mint-text" : e.objective === "Latency" ? "text-acc-text" : "text-fg2")}>{e.objective}</td>
                    <td>
                      <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold", STATUS[e.status].cls)}>
                        {STATUS[e.status].label}
                        {e.status === "queued" && e.queuePosition ? ` · #${e.queuePosition}` : ""}
                      </span>
                    </td>
                    <td>
                      {e.progress ? (
                        <span className="flex max-w-[260px] flex-col gap-1">
                          <span className="flex items-center gap-2.5">
                            <span className="h-1.5 flex-1 rounded-full bg-track"><span className="block h-1.5 rounded-full bg-acc2" style={{ width: `${(e.progress.done / e.progress.total) * 100}%` }} /></span>
                            <span className="font-mono text-xs">{Math.round((e.progress.done / e.progress.total) * 100)}%</span>
                          </span>
                          <span className="lbl">{e.progress.done} / {e.progress.total} cases</span>
                        </span>
                      ) : e.result ? (
                        <span className={cx(e.result.tone === "good" && "font-semibold text-mint-text", e.result.tone === "warn" && "font-semibold text-amb-text", e.result.tone === "neutral" && "text-fg")}>
                          {e.result.tone === "warn" ? <IconWarn size={14} className="mr-1 inline align-[-2px]" /> : null}
                          {e.result.text}
                          {e.result.grade ? <span className="lbl ml-1.5 font-normal">{e.result.grade}</span> : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-[13px] text-mut">{fmtAgo(e.updatedMinutesAgo)}</td>
                    <td className="pr-5 text-right">
                      <Link href={a.href} className={cx("inline-flex h-[34px] w-[110px] items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold", a.primary ? "border-acc bg-acc text-white" : "border-line2 bg-card text-fg hover:bg-wash")}>
                        {a.label} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-mut">No experiments match.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-3.5">
          <span className="text-sm text-mut">Showing {rows.length} of {all.length} experiments</span>
          <div className="flex-1" />
          {page > 1 ? <Link href={href({ page: page - 1 })} className="rounded-lg border border-line2 px-3 py-1.5 text-[13px]">‹ Previous</Link> : null}
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={href({ page: p })} aria-current={p === page ? "page" : undefined} className={cx("flex h-[34px] w-9 items-center justify-center rounded-lg border text-[13px] font-semibold", p === page ? "border-acc bg-acc text-white" : "border-line2")}>
              {p}
            </Link>
          ))}
          {page < pages ? <Link href={href({ page: page + 1 })} className="rounded-lg border border-line2 px-3 py-1.5 text-[13px]">Next ›</Link> : null}
        </div>
      </Card>

      <Card className="flex flex-wrap items-center gap-3.5 px-5 py-3 text-sm">
        <IconPlay size={14} className="text-mint" />
        <strong>Sandbox capacity</strong>
        <span>{cap.inUse} / {cap.slots} {cap.environment} slot in use</span>
        <div className="flex-1" />
        <span className="text-mut">{counts.queued} queued experiments start when the slot frees</span>
      </Card>
    </Main>
  );
}
