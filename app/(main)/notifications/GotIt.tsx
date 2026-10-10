"use client";

import { useState, useTransition } from "react";
import { markAnnouncementRead } from "../announcements/actions";
import { Button } from "@/app/components/ui/Button";

// "Got it" on an unread announcement: turns into a check at once, saves the
// read, and the ☰ number drops on the refresh behind it.
export function GotIt({ id }: { id: number }) {
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  if (done) {
    return <p className="self-start text-sm font-semibold text-good" role="status">✓ Got it</p>;
  }
  return (
    <Button
      size="sm"
      className="self-start"
      onClick={() => {
        setDone(true);
        const form = new FormData();
        form.set("announcementId", String(id));
        startTransition(() => markAnnouncementRead(form));
      }}
    >
      Got it
    </Button>
  );
}
