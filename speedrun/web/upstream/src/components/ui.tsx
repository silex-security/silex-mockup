import Link from "next/link";
import type { ReactNode } from "react";
import type { AnomalyKind, ConceptGrade } from "@/lib/types";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("card", className)} {...rest}>
      {children}
    </section>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("kick", className)}>{children}</span>;
}

export type TagTone = "acc" | "amb" | "rose" | "mint" | "mut" | "solid" | "blue";
const TAG: Record<TagTone, string> = {
  acc: "bg-acc-wash text-acc-text",
  amb: "bg-amb-wash text-amb-text",
  rose: "bg-rose-wash text-rose-text",
  mint: "bg-mint-wash text-mint-text",
  mut: "bg-inset text-mut ring-1 ring-inset ring-line2",
  solid: "bg-acc text-white",
  blue: "bg-blue-wash text-blue",
};

export function Tag({ tone = "acc", children, className }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-2xs font-bold", TAG[tone], className)}>
      {children}
    </span>
  );
}

export const ANOMALY: Record<AnomalyKind, { label: string; tone: TagTone }> = {
  slow: { label: "Slow", tone: "amb" },
  expensive: { label: "Expensive", tone: "acc" },
  "low-success": { label: "Low success", tone: "rose" },
};

export function GradeTag({ grade }: { grade: ConceptGrade }) {
  return grade === "observed" ? (
    <span className="inline-flex h-[22px] items-center rounded-full bg-fg px-2 text-2xs font-bold text-bg">Observed</span>
  ) : (
    <span className="inline-flex h-[22px] items-center rounded-full px-2 text-2xs font-bold text-acc-text ring-[1.5px] ring-inset ring-acc2">Latent</span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card px-3 text-xs text-mut", className)}>
      {children}
    </span>
  );
}

const BTN = "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-base font-semibold transition-colors";
export const btnClass = (primary?: boolean) =>
  cx(BTN, primary ? "border-fg bg-fg text-bg hover:border-fg2 hover:bg-fg2" : "border-line bg-card text-fg hover:border-line2 hover:bg-wash");

export function ButtonLink({ href, primary, children, className }: { href: string; primary?: boolean; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx(btnClass(primary), className)}>
      {children}
    </Link>
  );
}

export function Avatar({ initials, variant = "wash", size = 24, title }: { initials: string; variant?: "wash" | "solid" | "lead"; size?: number; title?: string }) {
  const tone = variant === "solid" ? "bg-acc text-white" : variant === "lead" ? "bg-fg text-bg" : "bg-acc-wash text-acc-text";
  return (
    <span
      title={title}
      className={cx("inline-flex flex-none items-center justify-center rounded-full font-bold", tone)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
    >
      {initials}
    </span>
  );
}

export function Stat({ label, value, sub, valueClass }: { label: string; value: ReactNode; sub?: ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="lbl">{label}</span>
      <span className={cx("text-3xl font-bold tracking-tight", valueClass)}>{value}</span>
      {sub ? <span className="text-xs">{sub}</span> : null}
    </div>
  );
}

/** Simple progress / share bar. */
export function Bar({ value, tone = "acc2", height = 6 }: { value: number; tone?: "acc2" | "amb" | "rose" | "mint"; height?: number }) {
  const color = { acc2: "bg-acc2", amb: "bg-amb", rose: "bg-rose", mint: "bg-mint" }[tone];
  return (
    <span className="block w-full overflow-hidden rounded-full bg-track" style={{ height }}>
      <span className={cx("block h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

export function IllustrativeBadge() {
  return <Pill className="border-amb text-amb-text">Illustrative data</Pill>;
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <Kicker>{kicker}</Kicker>
        <h1 className="m-0 text-3xl font-bold leading-[1.15] tracking-tight">{title}</h1>
      </div>
      <div className="flex-1" />
      {children}
    </div>
  );
}
