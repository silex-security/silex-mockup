import Link from "next/link";
import type { AgentRole, AgentTeam } from "@/lib/types";
import { IconPerson, IconTeam } from "../icons";
import { Tag, cx } from "../ui";

/**
 * Teams on the left, teammates (non-lead roles) on the right, one edge per
 * membership. The selected role's edges are highlighted.
 */
export function RelationshipGraph({
  unitId,
  teams,
  teammates,
  selectedRoleId,
}: {
  unitId: string;
  teams: AgentTeam[];
  teammates: { role: AgentRole; teamIds: string[] }[];
  selectedRoleId: string;
}) {
  const W = 880;
  const rowT = 130;
  const rowA = 84;
  const H = Math.max(teams.length * rowT, teammates.length * rowA) + 40;
  const teamY = (i: number) => 40 + i * rowT + (H - 40 - teams.length * rowT) / 2 + rowT / 2 - 20;
  const roleY = (i: number) => 20 + i * rowA + rowA / 2;
  const TX = 280;
  const AX = 540;

  const edges = teammates.flatMap((tm, ai) =>
    tm.teamIds.map((tid) => {
      const ti = teams.findIndex((t) => t.id === tid);
      return { key: `${tid}-${tm.role.id}`, y1: teamY(ti), y2: roleY(ai), on: tm.role.id === selectedRoleId };
    }),
  );

  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0" aria-hidden>
        {edges
          .sort((a, b) => Number(a.on) - Number(b.on))
          .map((e) => (
            <path
              key={e.key}
              d={`M${TX} ${e.y1} C${TX + 130} ${e.y1} ${AX - 130} ${e.y2} ${AX} ${e.y2}`}
              fill="none"
              stroke={e.on ? "var(--acc2)" : "var(--line2)"}
              strokeWidth={e.on ? 3 : 1.3}
            />
          ))}
      </svg>
      <span className="lbl absolute left-10 top-0 text-[11px] font-semibold tracking-[0.14em]">AGENT TEAMS</span>
      <span className="lbl absolute top-0 text-[11px] font-semibold tracking-[0.14em]" style={{ left: AX }}>TEAMMATES</span>
      {teams.map((t, i) => (
        <Link
          key={t.id}
          href={`/speedrun/teams/${t.id}`}
          className="absolute flex h-[52px] w-[240px] items-center gap-2.5 rounded-xl border border-line2 bg-card px-3.5 text-sm font-medium text-fg hover:border-acc2"
          style={{ left: 40, top: teamY(i) - 26 }}
        >
          <IconTeam size={18} />
          {t.name}
          <span className="flex-1" />
          <span className="lbl">{t.members.length}</span>
        </Link>
      ))}
      {teammates.map((tm, i) => {
        const on = tm.role.id === selectedRoleId;
        return (
          <Link
            key={tm.role.id}
            href={`/speedrun/units/${unitId}?role=${tm.role.id}`}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={cx(
              "absolute flex h-[50px] w-[290px] items-center gap-2.5 rounded-xl bg-card px-3.5 text-sm text-fg",
              on ? "border-2 border-acc2 font-semibold ring-4 ring-acc-wash" : "border border-line2 hover:border-acc2",
            )}
            style={{ left: AX, top: roleY(i) - 25 }}
          >
            <IconPerson size={16} />
            {tm.role.name}
            <span className="flex-1" />
            {tm.teamIds.length > 1 ? (
              <Tag tone={on ? "solid" : "acc"}>Shared · {tm.teamIds.length} teams</Tag>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
