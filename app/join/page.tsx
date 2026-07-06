import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { JoinForm } from "./JoinForm";

// Player self-join with the coach's team code. Outside the (main) layout;
// already-authenticated users skip into the app.
export default async function JoinPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <span
          className="text-2xl font-black italic tracking-tight text-white"
          style={{ fontFamily: "var(--font-barlow)" }}
        >
          Elite<span style={{ color: "#e1102a" }}>24</span>MVP
        </span>
        <p className="mt-2 text-sm text-zinc-500">Join your team</p>
      </div>

      <section className="e24-surface rounded-2xl border border-red-600/30 p-6">
        <div className="relative z-10">
          <JoinForm />
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
