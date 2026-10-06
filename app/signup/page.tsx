import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignupForm } from "./SignupForm";

// Coach self-signup (creates the coach + their team). Outside the (main) layout;
// already-authenticated users skip into the app.
export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

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
        <p className="mt-2 text-sm text-subtle">Create your team</p>
      </div>

      <section className="e24-surface rounded-2xl p-6">
        <div className="relative z-10">
          <SignupForm />
        </div>
      </section>

      <div className="flex flex-col gap-2 text-center text-sm text-subtle">
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </p>
        <p>
          A player?{" "}
          <Link href="/join" className="font-medium text-brand hover:underline">
            Join with a code
          </Link>
        </p>
      </div>
    </main>
  );
}
