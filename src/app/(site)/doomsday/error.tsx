"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { DoomsdayError } from "@/components/doomsday/states";

/** A Doomsday tab failed to render: the amber banner with Try again, never the raw error (WEB-61, Nico 2026-10-29). */
export default function Error({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <DoomsdayError
      retry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
