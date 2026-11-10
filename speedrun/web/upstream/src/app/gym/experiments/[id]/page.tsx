import Link from "next/link";
import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { ExperimentConfigurator } from "@/components/ExperimentConfigurator";
import { IconFlask } from "@/components/icons";
import { Card, Tag, cx } from "@/components/ui";
import { getExperiment, getTeam, getUnit } from "@/lib/data/service";

export const dynamic = "force-dynamic";

const STATUS_TAG = {
  pending: { label: "Pending", tone: "amb" },
  queued: { label: "Queued", tone: "mut" },
  running: { label: "Running", tone: "blue" },
  "needs-review": { label: "Needs review", tone: "acc" },
  done: { label: "Done", tone: "mint" },
} as const;

const changedCount = (ps: { baseline: string; variant: string }[]) => ps.filter((p) => p.baseline !== p.variant).length;

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getExperiment(id);
  if (!e) notFound();
  const team = getTeam(e.teamId)!;
  const unit = getUnit(team.unitId)!.unit;
  const st = STATUS_TAG[e.status];
  const steps = ["Configure", "Run", "Review"];
  const stepIdx = e.status === "pending" ? 0 : e.status === "queued" || e.status === "running" ? 1 : 2;

  return (
    <Main>
      <nav aria-label="Breadcrumb" className="text-sm text-mut">
        <Link href="/gym" className="text-mut hover:text-fg">Agent Gym</Link> / <span>{team.name}</span> / <span className="font-semibold text-fg">Experiment #{e.id}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-acc-wash text-acc-text"><IconFlask size={24} /></span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-3xl font-bold tracking-tight">{e.title}</h1>
            <Tag tone={st.tone} className="!h-[26px] !text-xs">{st.label}</Tag>
          </div>
          <div className="text-sm text-mut">
            {unit.name} · {team.name} ·{" "}
            <Link href={`/speedrun/teams/${team.id}/trace`} className="text-acc-text">View source in Speedrun ↗</Link>
          </div>
        </div>
      </div>

      {e.config ? (
        <Card className="flex flex-wrap items-center gap-4 px-4 py-3 text-[15px]">
          <Tag tone="mut" className="!h-[26px] tracking-[0.08em]">BASELINE</Tag><span>{e.config.baseline}</span>
          <span aria-hidden className="text-mut">→</span>
          <Tag tone="solid" className="!h-[26px] tracking-[0.08em]">VARIANT</Tag><span className="font-mono font-semibold">{e.config.variantName}</span>
          <span className="h-5 w-px bg-line2" />
          <span>{e.config.target}</span>
          {e.config.sharedAcrossTeams > 1 ? <Tag>Shared · {e.config.sharedAcrossTeams} teams</Tag> : null}
          <div className="flex-1" />
          <span className="text-mut">{changedCount(e.config.params)} parameter{changedCount(e.config.params) === 1 ? "" : "s"} changed</span>
        </Card>
      ) : null}

      <ol aria-label="Steps" className="m-0 flex list-none flex-wrap items-center gap-3.5 p-0 text-[15px]">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3.5">
            {i > 0 ? <span aria-hidden className="hidden h-px w-16 bg-line2 sm:block" /> : null}
            <span className={cx("flex items-center gap-2.5", i === stepIdx ? "font-semibold" : "text-mut")}>
              <span className={cx("flex h-7 w-7 items-center justify-center rounded-full text-[13px]", i === stepIdx ? "bg-acc text-white" : "border border-line2")}>{i + 1}</span>
              {s}
            </span>
          </li>
        ))}
      </ol>

      {e.config ? (
        <ExperimentConfigurator config={e.config} sourceHref={`/speedrun/teams/${team.id}/trace`} />
      ) : (
        <Card className="flex flex-col gap-2 p-6">
          <div className="text-lg font-semibold">{e.result?.text ?? "In progress"}</div>
          {e.result?.grade ? <span className="lbl">Graded {e.result.grade} — production outcomes are measured after promotion.</span> : null}
          {e.progress ? <span className="lbl">{e.progress.done} / {e.progress.total} cases complete</span> : null}
          <span className="lbl">Detailed configuration isn&apos;t included in the mock data for this experiment.</span>
        </Card>
      )}
    </Main>
  );
}
