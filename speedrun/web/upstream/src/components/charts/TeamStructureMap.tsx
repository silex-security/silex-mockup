import type { AgentTeam, TeamStructure } from "@/lib/types";
import { getRole, teamsForRole } from "@/lib/data/service";
import { IconPerson } from "../icons";
import { Avatar, Tag, cx } from "../ui";

const STATE = {
  done: { label: "Done", tone: "mint" },
  "in-progress": { label: "In progress", tone: "amb" },
  blocked: { label: "Blocked", tone: "mut" },
  pending: { label: "Pending", tone: "mut" },
} as const;

/**
 * Lead (left) → shared task list (centre) → teammates (right).
 * Dashed edges = a teammate claims a task; solid edges on the right = mailbox messages.
 */
export function TeamStructureMap({ team, structure }: { team: AgentTeam; structure: TeamStructure }) {
  const lead = team.members.find((mb) => mb.isLead)!;
  const mates = team.members.filter((mb) => !mb.isLead);
  const W = 900;
  const H = Math.max(430, 70 + structure.tasks.length * 56 + 60);
  const taskY = (i: number) => 64 + i * 56 + 24; // centre of task row
  const mateTop = (i: number) => 30 + i * ((H - 120) / Math.max(1, mates.length - 1));
  const mateY = (i: number) => mateTop(i) + 48;
  const TX = 250;
  const TW = 310;
  const MX = 625;
  const MW = 240;

  const focusCandidate = structure.candidates.find((c) => c.status === "recommended");
  const tagsFor = (roleId: string) => structure.candidates.filter((c) => c.status !== "rejected" && c.roleIds.includes(roleId));

  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0" aria-hidden>
        {structure.tasks.map((t, i) => {
          if (t.ownerRoleId === lead.roleId) return <path key={t.id} d={`M220 ${taskY(i)} L${TX} ${taskY(i)}`} stroke="var(--acc2)" strokeDasharray="4 4" strokeOpacity={0.7} strokeWidth={1.5} fill="none" />;
          const mi = mates.findIndex((mb) => mb.roleId === t.ownerRoleId);
          const y2 = mateY(mi);
          return <path key={t.id} d={`M${TX + TW} ${taskY(i)} C${TX + TW + 30} ${taskY(i)} ${MX - 30} ${y2} ${MX} ${y2}`} stroke="var(--acc2)" strokeDasharray="4 4" strokeOpacity={0.7} strokeWidth={1.5} fill="none" />;
        })}
        {structure.mailbox.map((e) => {
          const a = mates.findIndex((mb) => mb.roleId === e.fromRoleId);
          const b = mates.findIndex((mb) => mb.roleId === e.toRoleId);
          if (a < 0 || b < 0) return null;
          const y1 = mateTop(a) + 96;
          const y2 = mateTop(b);
          const x = MX + MW;
          return (
            <g key={`${e.fromRoleId}-${e.toRoleId}`}>
              <path d={`M${x} ${y1 - 30} C${x + 28} ${y1} ${x + 28} ${y2} ${x} ${y2 + 18}`} stroke="var(--acc2)" strokeWidth={2} fill="none" />
              <text x={x - 6} y={(y1 + y2) / 2} textAnchor="end" fill="var(--mut)" fontSize={10} fontFamily="var(--font-mono)">{e.label}</text>
            </g>
          );
        })}
        {team.humanReviewers && structure.humanReview ? <path d={`M120 150 L120 300`} stroke="var(--line2)" strokeDasharray="3 4" fill="none" /> : null}
      </svg>

      <div className="absolute flex w-[200px] flex-col gap-1.5 rounded-xl border-2 border-fg bg-card px-3 py-2.5" style={{ left: 20, top: 40 }}>
        <div className="flex items-center gap-2 text-md font-semibold">
          <Avatar initials={getRole(lead.roleId).initials} variant="lead" />
          {getRole(lead.roleId).name}
        </div>
        <Tag tone="mut" className="self-start">Team lead</Tag>
        <span className="lbl !text-2xs leading-snug">Creates and assigns tasks. Teammates inherit its permissions.</span>
      </div>
      {team.humanReviewers && structure.humanReview ? (
        <div className="absolute flex w-[200px] flex-col gap-1 rounded-xl border border-dashed border-line2 bg-card px-3 py-2.5" style={{ left: 20, top: 300 }}>
          <div className="flex items-center gap-2 text-md font-semibold"><IconPerson size={18} />Manual review</div>
          <span className="lbl !text-2xs">{structure.humanReview}</span>
        </div>
      ) : null}

      <div className="absolute flex flex-col gap-2 rounded-xl border border-line2 bg-card p-3" style={{ left: TX, top: 20, width: TW, height: H - 40 }}>
        <div className="flex items-center gap-2">
          <span className="text-md font-semibold">Shared task list</span>
          <span className="flex-1" />
          <span className="lbl">run #{structure.runId} · at {structure.atSeconds}s</span>
        </div>
        {structure.tasks.map((t) => {
          const owner = getRole(t.ownerRoleId);
          const st = STATE[t.state];
          return (
            <div
              key={t.id}
              className={cx(
                "grid h-12 grid-cols-[30px_minmax(0,1fr)_24px_auto] items-center gap-2 rounded-lg border bg-inset px-2.5 text-base",
                t.state === "in-progress" ? "border-amb bg-amb-wash" : t.reusable ? "border-[1.5px] border-dashed border-acc2" : "border-line",
              )}
            >
              <span className="lbl font-mono">{t.id}</span>
              <span className={t.state === "in-progress" ? "font-semibold" : ""}>
                {t.title} {t.dependsOn ? <span className="lbl">← {t.dependsOn}</span> : null}
              </span>
              <Avatar initials={owner.initials} variant={t.ownerRoleId === lead.roleId ? "lead" : teamsForRole(t.ownerRoleId).length > 1 ? "solid" : "wash"} />
              <Tag tone={st.tone}>{st.label}</Tag>
            </div>
          );
        })}
        <span className="lbl !text-2xs leading-normal">Teammates self-claim unblocked tasks. A dependency unblocks when its task is marked complete.</span>
      </div>

      {mates.map((mb, i) => {
        const r = getRole(mb.roleId);
        const shared = teamsForRole(mb.roleId).length;
        const isFocus = focusCandidate?.roleIds.includes(mb.roleId);
        const cands = tagsFor(mb.roleId);
        return (
          <div
            key={mb.roleId}
            className={cx("absolute flex flex-col gap-1.5 rounded-xl bg-card px-3 py-2.5", isFocus ? "border-2 border-acc2 ring-4 ring-acc-wash" : "border border-line2")}
            style={{ left: MX, top: mateTop(i), width: MW }}
          >
            <div className="flex items-center gap-2 text-md font-semibold">
              <Avatar initials={r.initials} variant={shared > 1 ? "solid" : "wash"} />
              {r.name}
              <span className="flex-1" />
              {cands.map((c) => <Tag key={c.id} tone="acc">{c.id}</Tag>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shared > 1 ? <Tag tone="solid">Shared · {shared} teams</Tag> : null}
              <span className="lbl !text-2xs">{mb.duty}{r.primaryTool ? ` · ${r.primaryTool}` : ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
