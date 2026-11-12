import Link from "next/link";
import { cx } from "./ui";
import { IconBars, IconBuild, IconPlay, IconTeam } from "./icons";

/* One tab row for the app, drawn like the console's .tabs: a soft track, the current tab raised on it. */
const TABS = "flex gap-1 rounded-xl bg-inset p-1";
const tab = (on: boolean) =>
  cx("flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm", on ? "bg-card text-fg shadow-[var(--card-shadow)]" : "text-mut hover:text-fg");

/** Organization / Business Unit / Agent Team scope switch. */
export function ScopeNav({ active, unitId = "customer-service" }: { active: "org" | "unit" | "team"; unitId?: string }) {
  const items = [
    { id: "org", label: "Organization", href: "/speedrun" },
    { id: "unit", label: "Business Unit", href: `/speedrun/units/${unitId}` },
    { id: "team", label: "Agent Team", href: `/speedrun/units/${unitId}/teams` },
  ];
  return (
    <nav aria-label="Scope" className={TABS}>
      {items.map((it) => (
        <Link key={it.id} href={it.href} aria-current={it.id === active ? "page" : undefined} className={tab(it.id === active)}>
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
    <nav aria-label="Team views" className={cx(TABS, "flex-wrap")}>
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined} className={tab(t.id === active)}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
