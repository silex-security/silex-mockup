import Link from "next/link";
import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { TeamHeader } from "@/components/TeamHeader";
import { TeamKpis } from "@/components/TeamKpis";
import { TeamStructureMap } from "@/components/charts/TeamStructureMap";
import { IconArrowRight } from "@/components/icons";
import { ButtonLink, Card, Kicker, Tag, cx } from "@/components/ui";
import { getTeam, getTeamStructure } from "@/lib/data/service";

export default async function TeamStructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { teamId } = await params;
  const { c } = await searchParams;
  const team = getTeam(teamId);
  if (!team) notFound();
  const s = getTeamStructure(teamId);

  return (
    <Main>
      <TeamHeader team={team} tab="structure" />
      <TeamKpis team={team} />

      {!s ? (
        <Card className="p-8 text-center text-mut">
          The team structure for {team.name} hasn&apos;t been reconstructed yet. It appears once enough traces are grounded against the L3 agent-execution ontology.
        </Card>
      ) : (
        <StructureBody teamId={teamId} team={team} s={s} selectedId={c} />
      )}
    </Main>
  );
}

function StructureBody({
  teamId,
  team,
  s,
  selectedId,
}: {
  teamId: string;
  team: NonNullable<ReturnType<typeof getTeam>>;
  s: NonNullable<ReturnType<typeof getTeamStructure>>;
  selectedId?: string;
}) {
  const sig = s.signals;
  const selected = s.candidates.find((x) => x.id === selectedId && x.status !== "rejected") ?? s.candidates.find((x) => x.status === "recommended")!;
  const tone = { Latency: "acc", Cost: "mint", Quality: "amb" } as const;

  return (
    <>
      <Card aria-label="Teamwork signals" className="flex flex-wrap items-stretch overflow-hidden">
        <div className="flex min-w-[200px] flex-col justify-center gap-1 border-r border-line bg-wash px-4 py-3">
          <Kicker>Teamwork signals</Kicker>
          <span className="lbl">How the team coordinates — not only what it outputs</span>
        </div>
        <div className="grid flex-[1_1_640px] grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Coordination overhead", value: `${sig.coordinationOverheadPct}%`, note: "of tokens on lead + messages" },
            { label: "Blocked teammate time", value: `${sig.blockedSecondsPerRun}s / run`, note: sig.blockedNote, warn: true },
            { label: "Duplicate context loads", value: `${sig.duplicateContextLoads} × ${sig.duplicateContextTokens}`, note: sig.duplicateNote },
            { label: "Stuck tasks · 7d", value: String(sig.stuckTasks7d), note: "work done, task not closed" },
          ].map((x, i) => (
            <div key={x.label} className={cx("flex flex-col gap-0.5 px-4 py-3", i > 0 && "border-l border-line")}>
              <span className="lbl">{x.label}</span>
              <span className={cx("text-xl font-bold", x.warn && "text-amb-text")}>{x.value}</span>
              <span className="lbl">{x.note}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card aria-label="Team structure" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-4 py-3">
          <span className="font-semibold">Team structure</span>
          <div className="flex flex-wrap gap-3.5 text-xs text-mut">
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-[1.5px] border-dashed border-acc2" />Claims task</span>
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-acc2" />Mailbox message</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-[1.5px] border-dashed border-acc2" />Reusable context</span>
          </div>
        </div>
        <div className="flex flex-wrap">
          <div className="dot-grid min-w-0 flex-[999_1_640px] overflow-x-auto">
            <TeamStructureMap team={team} structure={s} />
          </div>

          <aside aria-label="Performance optimizer" className="flex min-w-0 max-w-[460px] flex-[1_1_380px] flex-col gap-3 border-l border-line p-5">
            <span className="text-xl font-bold">Performance optimizer</span>
            <span className="lbl !text-[13px]">Ranked across quality, latency and cost · estimates until tested</span>
            {s.candidates.map((x) =>
              x.status === "rejected" ? (
                <div key={x.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border border-line p-2.5 text-[13px] opacity-80">
                  <span className="font-mono text-mut">✕</span>
                  <span>
                    <span className="block font-semibold line-through">{x.title}</span>
                    <span className="lbl">{x.note}</span>
                  </span>
                  <Tag tone="mut">Rejected</Tag>
                </div>
              ) : (
                <Link
                  key={x.id}
                  href={`/speedrun/teams/${teamId}?c=${x.id}`}
                  scroll={false}
                  aria-current={x.id === selected.id ? "true" : undefined}
                  className={cx(
                    "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] p-2.5 text-[13px] text-fg",
                    x.id === selected.id ? "border-2 border-acc2 bg-acc-wash" : "border border-line hover:bg-wash",
                  )}
                >
                  <span className={cx("font-mono font-bold", x.id === selected.id ? "text-acc-text" : "text-mut")}>{x.id}</span>
                  <span>
                    <span className="block font-semibold">{x.title}</span>
                    <span className="lbl">{x.note}</span>
                  </span>
                  <Tag tone={tone[x.objective]}>{x.objective}</Tag>
                </Link>
              ),
            )}

            <div className="flex flex-col gap-2.5 border-t border-line pt-3">
              <Kicker className="!text-mut">{selected.id} · {selected.diagnosis ? "Diagnosis" : "Proposal"}</Kicker>
              <p className="m-0 text-[13px] leading-relaxed text-fg2">{selected.diagnosis ?? selected.note}</p>
              {selected.params ? (
                <div className={cx("grid gap-2", selected.params.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {selected.params.map((p) => (
                    <div key={p.name} className="rounded-[10px] border border-line2 bg-inset p-2.5">
                      <div className="lbl">{p.name}</div>
                      <div className="text-lg font-bold">
                        {p.current} <span className="text-mut">→</span> <span className="text-acc-text">{p.candidate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {selected.estimate ? (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold text-acc-text">{selected.estimate}</span>
                  <span className="lbl !text-[13px]">{selected.estimateNote}</span>
                  <Tag tone="mut">Not yet tested</Tag>
                </div>
              ) : null}
              {selected.guardrail ? (
                <div className="flex gap-2 text-xs leading-snug text-acc-text">
                  <span aria-hidden>◆</span>
                  {selected.guardrail}
                </div>
              ) : null}
            </div>
            <ButtonLink href={`/speedrun/teams/${teamId}/trace`} primary>
              Inspect trace &amp; create variant <IconArrowRight />
            </ButtonLink>
          </aside>
        </div>
      </Card>
    </>
  );
}
