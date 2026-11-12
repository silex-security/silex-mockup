import Link from "next/link";
import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { BuildButton } from "@/components/BuildButton";
import { TeamHeader } from "@/components/TeamHeader";
import { Bar, Card, GradeTag, Kicker, Tag, btnClass, cx } from "@/components/ui";
import { builderImpact, getBenchmarks, getBuilder, getTeam } from "@/lib/data/service";
import type { Tier } from "@/lib/types";

const TIER: Record<Tier, string> = { L1: "L1 · GENERAL", L2: "L2 · DOMAIN", L3: "L3 · AGENT TEAM EXECUTION" };

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { teamId } = await params;
  const { r } = await searchParams;
  const team = getTeam(teamId);
  if (!team) notFound();
  const view = getBuilder(teamId);
  const bench = getBenchmarks(teamId);

  if (!view || !bench) {
    return (
      <Main>
        <TeamHeader team={team} tab="builder" crumb="Benchmark Builder" />
        <Card className="p-8 text-center text-mut">
          The ontology hasn&apos;t been grounded for {team.name} yet, so there are no concepts to build cases from.
        </Card>
      </Main>
    );
  }

  const cases = bench.suite.anchorCases + bench.suite.rollingCases;
  const impact = builderImpact(view, bench.suite.costPerExecution, bench.suite.repeats, cases);
  const maxCases = Math.max(...view.concepts.map((c) => c.cases));
  const selected = view.recommendations.find((x) => x.id === r) ?? view.recommendations.find((x) => x.id === view.construction.recommendationId)!;
  const c = view.construction;
  const showConstruction = selected.id === c.recommendationId;

  return (
    <Main>
      <TeamHeader team={team} tab="builder" crumb="Benchmark Builder" />

      <Card aria-label="How recommendations are made" className="flex flex-wrap items-center gap-4 px-5 py-3.5">
        <div className="min-w-0 flex-[1_1_520px] text-md leading-relaxed text-fg2">
          <strong className="text-fg">Traces show what happened. The ontology shows what can happen.</strong> The builder lists every concept {team.name} can reach by type — from L1–L3 and this team&apos;s L4 instances — and checks which ones the current suite actually tests.
        </div>
        <div className="flex flex-wrap gap-5">
          <div><div className="lbl">Suite</div><div className="font-bold">{view.suiteName} · {cases} cases</div></div>
          <div><div className="lbl">Concepts tested</div><div className="font-bold"><span className="text-amb-text">{impact.conceptsTested}</span> of {impact.conceptsTotal}</div></div>
          <div><div className="lbl">Ontology</div><div className="font-mono text-base font-semibold">{view.ontologyVersions}</div></div>
        </div>
        <div className="flex basis-full flex-wrap gap-2.5 text-xs text-mut">
          <span className="flex items-center gap-1.5"><GradeTag grade="observed" />seen in this team&apos;s production traffic</span>
          <span className="flex items-center gap-1.5"><GradeTag grade="latent" />possible by type, never seen — a hypothesis you can dismiss</span>
        </div>
      </Card>

      <div className="flex flex-wrap items-start gap-3.5">
        <Card aria-label="Concept coverage" className="min-w-0 max-w-[460px] flex-[1_1_380px] px-5 py-4">
          <div className="flex items-baseline gap-2"><span className="text-lg font-semibold">Concept coverage</span><span className="lbl">cases in suite per concept</span></div>
          {(["L1", "L2", "L3"] as Tier[]).map((tier) => (
            <div key={tier}>
              <div className="pb-1 pt-2.5 text-2xs font-bold tracking-[0.12em] text-mut">{TIER[tier]}</div>
              {view.concepts
                .filter((x) => x.tier === tier)
                .map((x) => (
                  <div key={x.id} className={cx("grid min-h-[30px] grid-cols-[minmax(0,1fr)_90px_34px] items-center gap-2.5 text-base", x.cases === 0 && "text-rose-text")}>
                    <span>{x.cases === 0 ? <strong>{x.name}</strong> : x.name} {x.note ? <span className="lbl">{x.note}</span> : null}</span>
                    <Bar value={x.cases / maxCases} tone={x.thin ? "amb" : "acc2"} />
                    <span className={cx("text-right font-mono", x.cases === 0 && "font-bold")}>{x.cases}</span>
                  </div>
                ))}
            </div>
          ))}
          <div className="mt-2.5 border-t border-line pt-2.5 text-xs leading-snug text-mut">{view.outOfScopeNote}</div>
        </Card>

        <section aria-label="Recommendations" className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-lg font-semibold">Recommended case families</span>
            <span className="lbl">ranked by expected impact on benchmark fit and blind spots</span>
            <div className="flex-1" />
            <span className="lbl">{view.recommendations.length} recommended · {view.recommendations.reduce((s, x) => s + x.cases, 0)} cases</span>
          </div>
          {view.recommendations.map((rec) => {
            const on = rec.id === selected.id;
            return (
              <div key={rec.id} className={cx("grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-3.5 py-3", on ? "border-2 border-acc2 bg-wash" : "border border-line bg-card")}>
                <Link href={`/speedrun/teams/${teamId}/builder?r=${rec.id}`} scroll={false} className={cx("font-mono text-md font-bold", on ? "text-acc-text" : "text-mut")}>{rec.id}</Link>
                <div className="flex flex-col gap-1">
                  <Link href={`/speedrun/teams/${teamId}/builder?r=${rec.id}`} scroll={false} className="flex flex-wrap items-center gap-2 text-fg">
                    <strong className="text-md">{rec.title}</strong>
                    <Tag tone="mut" className="font-mono">{rec.ontologyType}</Tag>
                    <GradeTag grade={rec.grade} />
                  </Link>
                  <span className="text-base text-fg2">{rec.rationale}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{rec.cases} cases</div>
                  {rec.status === "proposed" ? <BuildButton teamId={teamId} recommendationId={rec.id} /> : <div className="lbl">{rec.status}</div>}
                </div>
              </div>
            );
          })}
          {view.skipped.map((s) => (
            <div key={s.title} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-line bg-card px-3.5 py-3 opacity-75">
              <span className="font-mono text-mut">✕</span>
              <div className="flex flex-col gap-1"><strong className="text-md line-through">{s.title}</strong><span className="lbl !text-base">Not recommended · {s.reason}</span></div>
              <Tag tone="mut">Skipped</Tag>
            </div>
          ))}
        </section>
      </div>

      <Card aria-label="Case construction" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <span className="font-mono font-bold text-acc-text">{selected.id}</span>
          <span className="text-lg font-semibold">{showConstruction ? "Building" : "Ready to build"}: {selected.title}</span>
          <div className="flex-1" />
          <ol aria-label="Construction steps" className="m-0 flex list-none flex-wrap gap-3.5 p-0">
            {c.steps.map((st, i) => {
              const done = showConstruction && st.done;
              const current = showConstruction && !st.done && (i === 0 || c.steps[i - 1].done);
              return (
                <li key={st.name} className={cx("flex items-center gap-2 text-base", current ? "font-semibold text-fg" : "text-mut")}>
                  <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] font-mono text-2xs font-bold", done ? "border-acc bg-acc text-on-acc" : current ? "border-acc2 text-acc-text" : "border-line2")}>
                    {done ? "✓" : i + 1}
                  </span>
                  {st.name}
                </li>
              );
            })}
          </ol>
        </div>

        {showConstruction ? (
          <div className="flex flex-wrap">
            <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-2.5 border-r border-line px-4 py-4">
              <Kicker className="!text-mut">From type to instance</Kicker>
              {[
                ["Type (L3)", c.type, true],
                ["This team's instances (L4)", c.instances, false],
                [c.profilesLabel, c.profiles, true],
              ].map(([k, v, mono]) => (
                <div key={k as string} className="rounded-lg border border-line bg-inset px-3 py-2.5 text-base">
                  <span className="lbl">{k}</span>
                  <div className={mono ? "font-mono font-semibold" : ""}>{v}</div>
                </div>
              ))}
              <span className="lbl leading-snug">{c.expansion}</span>
            </div>
            <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-2.5 border-r border-line px-4 py-4">
              <Kicker className="!text-mut">Generated case</Kicker>
              <div className="overflow-hidden rounded-xl border border-line2 text-base">
                <div className="bg-wash px-3 py-2.5 font-semibold"><span className="font-mono">{c.preview.id}</span> {c.preview.title}</div>
                <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 px-3 py-2.5 leading-snug">
                  <dt className="lbl">Seed state</dt><dd className="m-0 font-mono text-xs">{c.preview.seedState}</dd>
                  <dt className="lbl">Injected</dt><dd className="m-0 font-mono text-xs">{c.preview.injected}</dd>
                  <dt className="lbl">Task</dt><dd className="m-0">{c.preview.task}</dd>
                  <dt className="lbl">Pass if</dt><dd className="m-0 font-mono text-xs">{c.preview.passIf}</dd>
                  <dt className="lbl">Record</dt><dd className="m-0">{c.preview.record}</dd>
                </dl>
              </div>
            </div>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 px-4 py-4">
              <Kicker className="!text-mut">Before it enters the suite</Kicker>
              {c.checks.map((ck) => (
                <div key={ck.label} className="flex items-start gap-2 text-base leading-snug">
                  <span className={cx("font-bold", ck.state === "pass" ? "text-mint-text" : ck.state === "running" ? "text-acc-text" : "text-rose-text")}>
                    {ck.state === "pass" ? "✓" : ck.state === "running" ? "◐" : "✕"}
                  </span>
                  <span>{ck.label}</span>
                </div>
              ))}
              <div className="rounded-lg bg-inset px-3 py-2.5 text-xs leading-snug text-fg2"><strong>Review:</strong> {c.reviewNote}</div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 text-md text-mut">
            {selected.status === "proposed"
              ? "Press Build to generate cases: the builder instantiates the type over this team's instances, drafts seed states and pass checks, then runs the validation checks."
              : `Construction started (${selected.status}). Generated cases appear here once the first validation pass completes.`}
          </div>
        )}
      </Card>

      <Card aria-label="Suite impact" className="flex flex-wrap items-center gap-5 px-5 py-3.5">
        <Kicker>If all {view.recommendations.length} are accepted</Kicker>
        <div><div className="lbl">Cases</div><div className="text-xl font-bold">{impact.casesBefore} → {impact.casesAfter}</div></div>
        <div><div className="lbl">Concepts tested</div><div className="text-xl font-bold">{impact.conceptsTested} → {impact.conceptsAfter} of {impact.conceptsTotal}</div></div>
        <div><div className="lbl">Weekly run cost</div><div className="text-xl font-bold">${impact.weeklyCostBefore} → ${impact.weeklyCostAfter}</div></div>
        <div className="flex-[1_1_260px] text-base leading-snug text-mut">
          New cases join the <strong className="text-fg2">rolling set</strong> as {view.suiteName.replace(/v(\d+)/, (_, n) => `v${Number(n) + 1}`)}-draft. They move to the frozen anchor set only after 4 stable weekly runs, so the long-term trend isn&apos;t broken.
        </div>
        <button type="button" className={btnClass()}>Save draft</button>
        <button type="button" className={btnClass(true)}>Send {selected.id} for review →</button>
      </Card>
    </Main>
  );
}
