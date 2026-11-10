import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { IllustrativeBadge, Pill, cx } from "./ui";
import { IconChevronDown } from "./icons";

const PRODUCTS = [
  { id: "studio", label: "Agent Studio", href: "#" },
  { id: "speedrun", label: "Speedrun", href: "/speedrun" },
  { id: "gym", label: "Agent Gym", href: "/gym" },
] as const;

export function AppHeader({ active }: { active: "speedrun" | "gym" }) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-hdr px-4 backdrop-blur sm:px-8">
      <Link href="/speedrun" className="flex h-14 items-center gap-2.5 text-fg no-underline">
        <span
          aria-hidden
          className="h-7 w-7 bg-[#e4dcff]"
          style={{ borderRadius: "46% 54% 50% 50% / 52% 44% 56% 48%", boxShadow: "5px 3px 0 -2px #7c5cff" }}
        />
        <span className="font-bold tracking-[0.06em]">SILEX</span>
      </Link>
      <span className="h-5 w-px bg-line2" />
      <nav aria-label="Products" className="flex gap-6">
        {PRODUCTS.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            aria-current={p.id === active ? "page" : undefined}
            className={cx(
              "flex h-14 items-center border-b-2 text-sm",
              p.id === active ? "border-acc2 font-semibold text-fg" : "border-transparent text-mut hover:text-fg",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      <IllustrativeBadge />
      <Pill className="hidden sm:inline-flex">
        Acme workspace <IconChevronDown size={12} />
      </Pill>
      <ThemeToggle />
      <span aria-label="Signed in as JD" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-acc-wash text-xs font-bold text-acc-text">
        JD
      </span>
    </header>
  );
}

export function Main({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-12 pt-5 sm:px-8">{children}</main>;
}
