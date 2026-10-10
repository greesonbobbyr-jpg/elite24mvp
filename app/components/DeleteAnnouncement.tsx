"use client";

import { useState, useTransition } from "react";
import { deleteAnnouncement } from "@/app/(main)/announcements/actions";
import { Button } from "./ui/Button";

// Two taps to delete: it disappears for everyone and its pictures are
// deleted for good.
export function DeleteAnnouncement({ id }: { id: number }) {
  const [sure, setSure] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!sure) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setSure(true)}>
        Delete
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => setSure(false)} disabled={pending}>
        Keep
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => {
          const form = new FormData();
          form.set("announcementId", String(id));
          startTransition(() => deleteAnnouncement(form));
        }}
      >
        {pending ? "Deleting…" : "Delete for everyone"}
      </Button>
    </span>
  );
}
