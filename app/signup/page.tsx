import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { safeNext } from "@/lib/safe-next";
import { normalizeCode } from "@/lib/invites";
import { SignupForm } from "./SignupForm";

// STEP 1 — create your account (everyone). Outside the (main) layout; a
// signed-in person goes on to where they were headed. `next` carries an
// invite link through sign-up; `code` a team code from a printed /join link.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string }>;
}) {
  const { next: rawNext, code: rawCode } = await searchParams;
  const next = safeNext(rawNext);
  const code = normalizeCode(rawCode) || null;
  if (await getCurrentContext()) redirect(next ?? (code ? `/welcome?code=${code}` : "/"));
  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <span
          role="img"
          aria-label="Elite24MVP"
          className="text-2xl font-black italic tracking-tight text-ink"
          style={{ fontFamily: "var(--font-barlow)" }}
        >
          Elite<span className="text-logo">24</span>MVP
        </span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-subtle">
          One account for everyone — players, parents, coaches and organizations. Next you&apos;ll start an
          organization, join a team, or train on your own.
        </p>
      </div>

      <section className="e24-surface rounded-2xl p-6">
        <div className="relative z-10">
          <SignupForm next={next} code={code} />
        </div>
      </section>

      <p className="text-center text-sm text-subtle">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
