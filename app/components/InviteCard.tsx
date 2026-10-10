"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";

// A freshly made invite or org code: the big code, the phone's share sheet
// (Messages, WhatsApp, mail…), copy buttons, and a QR code to scan in person.
// No email service needed. The code and link exist in the clear only now —
// the app keeps just a fingerprint of them.
export function InviteCard({
  code,
  link,
  qr,
  what,
  days,
}: {
  code: string;
  link: string;
  qr: string;
  what: string;
  days: number;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const copy = async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: the text is on screen to copy by hand */
    }
  };
  const share = async () => {
    const text = `You're invited to Elite24MVP — ${what}. Open this link, or enter code ${code}:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Elite24MVP invite", text, url: link });
        return;
      } catch {
        /* cancelled — fall through to copy */
      }
    }
    await copy(`${text} ${link}`, "link");
  };

  return (
    <div className="e24-reveal flex flex-col items-center gap-4 rounded-xl border border-line bg-sunken p-4 text-center">
      <p className="text-sm text-muted">{what}</p>
      <p className="break-all rounded-xl border border-line-strong bg-panel px-4 py-3 font-mono text-2xl font-black tracking-[0.15em] text-ink sm:text-3xl">
        {code}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" onClick={share}>Share invite…</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => copy(code, "code")}>
          {copied === "code" ? "Copied ✓" : "Copy code"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => copy(link, "link")}>
          {copied === "link" ? "Copied ✓" : "Copy link"}
        </Button>
      </div>
      <p className="max-w-full break-all font-mono text-xs text-subtle" data-invite-link>{link}</p>
      {/* The QR keeps black-on-white in both modes so phones can read it. */}
      <div className="h-40 w-40 overflow-hidden rounded-xl border border-line" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="text-xs text-subtle">
        {/* One string: the JSX compiler drops the space after {days} when the
            same text run holds an &apos; entity. */}
        {`Works once · expires in ${days} days. Share or copy it now — for safety the app can't show this code again.`}
      </p>
    </div>
  );
}
