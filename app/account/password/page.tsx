import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { MIN_PASSWORD_LENGTH } from "@/lib/account";
import { Card } from "@/app/components/ui/Card";
import { PasswordForm } from "./PasswordForm";

// Change your own password. Outside the (main) layout on purpose: that layout
// sends anyone whose password was chosen by someone else (mustChangePassword)
// here first, so this page can't sit behind its own gate.
export default async function ChangePasswordPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  const forced = ctx.user.mustChangePassword;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="e24-eyebrow">Your account</p>
        <h1 className="text-2xl font-black tracking-tight text-ink">
          {forced ? "Pick your own password" : "Change password"}
        </h1>
        {forced && (
          <p className="text-sm text-muted">
            Someone else set up this account for you. Choose a password only you know to keep going.
          </p>
        )}
      </header>
      <Card>
        <PasswordForm minLength={MIN_PASSWORD_LENGTH} />
      </Card>
      {!forced && (
        <Link href="/" className="text-sm font-semibold text-brand">
          ← Back
        </Link>
      )}
    </main>
  );
}
