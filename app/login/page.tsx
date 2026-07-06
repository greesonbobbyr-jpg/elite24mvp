import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

// Coach credential login. Sits OUTSIDE the (main) layout (no app header / tab
// bar / onboarding gate). Already-authenticated users skip straight into the app.
export default async function LoginPage() {
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
        <p className="mt-2 text-sm text-zinc-500">Sign in</p>
      </div>

      <section className="e24-surface rounded-2xl border border-red-600/30 p-6">
        <div className="relative z-10">
          <LoginForm />
        </div>
      </section>

      <div className="flex flex-col gap-2 text-center text-sm text-zinc-500">
        <p>
          Have a team code?{" "}
          <Link href="/join" className="font-medium text-red-500 hover:underline">
            Join your team
          </Link>
        </p>
        <p>
          Coach, new here?{" "}
          <Link href="/signup" className="font-medium text-red-500 hover:underline">
            Create a team
          </Link>
        </p>
      </div>
    </main>
  );
}
