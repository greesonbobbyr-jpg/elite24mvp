import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { Card } from "@/app/components/ui/Card";
import { EmailForm } from "./EmailForm";

// ADD YOUR EMAIL — once, for an older account that logs in with a username.
// Email is now the only login (owner, 2026-10-09). Outside the (main) layout,
// which sends username-only accounts here first.
export default async function AddEmailPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (ctx.user.email) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="e24-eyebrow">One quick thing</p>
        <h1 className="text-2xl font-black tracking-tight text-ink">Add your email</h1>
        <p className="text-sm text-muted">
          From now on you&apos;ll log in with your email instead of your username
          {ctx.user.username ? <> (<span className="font-semibold">{ctx.user.username}</span>)</> : null}. Your journal, points
          and team stay exactly the same.
        </p>
      </header>
      <Card>
        <EmailForm />
      </Card>
    </main>
  );
}
