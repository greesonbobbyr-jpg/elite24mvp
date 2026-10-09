"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";

// Copy code / copy link / the phone's own share sheet (falls back to copy).
export function ShareButtons({ code, link }: { code: string; link: string }) {
  const [done, setDone] = useState<string | null>(null);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(what);
      setTimeout(() => setDone(null), 1600);
    } catch {
      /* clipboard blocked: nothing to do in a mockup */
    }
  };
  const share = async () => {
    const text = `You're invited to coach on Elite24MVP. Code: ${code}`;
    if (navigator.share) {
      await navigator.share({ title: "Elite24MVP invite", text, url: link }).catch(() => {});
    } else {
      void copy(`${text}\n${link}`, "invite");
    }
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <Button type="button" onClick={share} className="w-full">Share invite…</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => copy(code, "code")}>
          {done === "code" ? "✓ Copied" : "Copy code"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => copy(link, "link")}>
          {done === "link" ? "✓ Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
