import Link from "next/link";
import { cx } from "./ui";
import { IconBars, IconBuild, IconPlay, IconTeam } from "./icons";

/** Organization / Business Unit / Agent Team scope switch. */
export function ScopeNav({ active, unitId = "customer-service" }: { active: "org" | "unit" | "team"; unitId?: string }) {
  const items = [
    { id: "org", label: "Organization", href: "/speedrun" },
    { id: "unit", label: "Business Unit", href: `/speedrun/units/${unitId}` },
    { id: "team", label: "Agent Team", href: `/speedrun/units/${unitId}/teams` },
  ];
  return (
    <nav aria-label="Scope" className="flex rounded-xl border border-line bg-card p-1">
      {items.map((it) => (
        <Link
          key={it.id}
          href={it.href}
          aria-current={it.id === active ? "page" : undefined}
          className={cx(
            "flex h-9 items-center rounded-[9px] px-4 text-[13px]",
            it.id === active ? "bg-acc font-semibold text-white" : "text-mut hover:text-fg",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export type TeamTab = "structure" | "trace" | "benchmarks" | "builder";

/** Tabs inside an agent team. */
export function TeamTabs({ teamId, active }: { teamId: string; active: TeamTab }) {
  const tabs = [
    { id: "structure", label: "Team structure", href: `/speedrun/teams/${teamId}`, icon: <IconTeam size={15} /> },
    { id: "trace", label: "Trace replay", href: `/speedrun/teams/${teamId}/trace`, icon: <IconPlay size={13} /> },
    { id: "benchmarks", label: "Benchmarks", href: `/speedrun/teams/${teamId}/benchmarks`, icon: <IconBars size={15} /> },
    { id: "builder", label: "Benchmark Builder", href: `/speedrun/teams/${teamId}/builder`, icon: <IconBuild size={15} /> },
  ];
  return (
    <nav aria-label="Team views" className="flex flex-wrap rounded-[10px] border border-line bg-inset p-[3px]">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={cx(
            "flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px]",
            t.id === active ? "border-acc2 bg-card font-semibold text-acc-text" : "border-transparent text-mut hover:text-fg",
          )}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
