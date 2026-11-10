import { AppHeader } from "@/components/AppHeader";

export default function GymLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader active="gym" />
      {children}
    </>
  );
}
