import Link from "next/link";
import { buttonClass } from "@/app/components/ui/Button";
import { cardMaterial } from "@/app/components/ui/Card";
import { fieldClass, labelClass } from "@/app/components/ui/Field";
import { AuthFrame, MockNote } from "../MockShell";

// STEP 1 — everyone creates the same account first (owner, 2026-10-09:
// "like TeamSnap, LinkedIn, SportsEngine"). No role yet; email is the login.
export default function PreviewSignup() {
  return (
    <AuthFrame subtitle="Create your account">
      <section className={`${cardMaterial} relative`}>
        <div className="relative z-10 flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="pv-name">Your name</label>
            <input id="pv-name" className={fieldClass} placeholder="First and last name" />
          </div>
          <div>
            <label className={labelClass} htmlFor="pv-email">Email</label>
            <input id="pv-email" className={fieldClass} placeholder="you@example.com" />
            <p className="mt-1 text-xs text-subtle">
              This is how you&apos;ll log in. Under 13? Use a parent&apos;s email. Brothers or sisters
              can use <span className="font-semibold text-ink-mid">parent+name@gmail.com</span>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="pv-pw">Password</label>
              <input id="pv-pw" type="password" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="pv-pw2">Confirm</label>
              <input id="pv-pw2" type="password" className={fieldClass} />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-field-line bg-sunken p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-raised-2 text-xl text-muted">+</span>
            <span className="text-sm text-ink-mid">
              Add a photo <span className="text-subtle">(optional — you can add it later)</span>
            </span>
          </div>
          <Link href="/preview/welcome" className={`${buttonClass("primary", "lg")} mt-1 w-full`}>
            Create my account
          </Link>
        </div>
      </section>
      <p className="text-center text-sm text-muted">
        Already have an account? <span className="font-semibold text-brand">Log in</span>
      </p>
      <MockNote>One account for everyone — players, coaches, org owners. What you do next is step 2.</MockNote>
    </AuthFrame>
  );
}
