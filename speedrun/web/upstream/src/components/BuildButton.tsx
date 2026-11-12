"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";

export function BuildButton({ teamId, recommendationId }: { teamId: string; recommendationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/teams/${teamId}/builder/recommendations/${recommendationId}`, { method: "POST" });
        router.push(`/speedrun/teams/${teamId}/builder?r=${recommendationId}`, { scroll: false });
        router.refresh();
        setBusy(false);
      }}
      className={cx("mt-1 inline-flex h-[34px] items-center rounded-lg border border-line2 bg-card px-3 text-base font-semibold text-fg hover:bg-wash disabled:opacity-50")}
    >
      {busy ? "Starting…" : "Build"}
    </button>
  );
}
