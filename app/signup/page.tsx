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
          className="text-2xl font-black italic tracking-tight text-white"
          style={{ fontFamily: "var(--font-barlow)" }}
        >
          Elite<span style={{ color: "#e1102a" }}>24</span>MVP
        </span>
        <p className="mt-2 text-sm text-zinc-500">Create your team</p>
      </div>

      <section className="e24-surface rounded-2xl border border-red-600/30 p-6">
        <div className="relative z-10">
          <SignupForm />
        </div>
      </section>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-red-500 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
