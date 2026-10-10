import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./LoginForm";

// Login (everyone, by email). Outside the (main) layout. `next` brings someone
// back to where they were headed — e.g. an invite link — after logging in.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next ?? "/");
  const signupHref = `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <span
          role="img"
          aria-label="Elite24MVP"
          className="text-2xl font-black italic tracking-tight text-ink"
          style={{ fontFamily: "var(--font-barlow)" }}
        >
          Elite<span className="text-logo">24</span>MVP
        </span>
        <p className="mt-2 text-sm text-subtle">Sign in</p>
      </div>

      <section className="e24-surface rounded-2xl p-6">
        <div className="relative z-10">
          <LoginForm next={next} />
        </div>
      </section>

      <p className="text-center text-sm text-subtle">
        New here?{" "}
        <Link href={signupHref} className="font-medium text-brand hover:underline">
          Create your account
        </Link>
      </p>
    </main>
  );
}
