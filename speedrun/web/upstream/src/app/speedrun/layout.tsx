import { AppHeader } from "@/components/AppHeader";

export default function SpeedrunLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader active="speedrun" />
      {children}
    </>
  );
}
