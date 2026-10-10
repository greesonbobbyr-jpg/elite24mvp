import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { normalizeCode } from "@/lib/invites";

// Old printed links (/join?code=MUSTJV) keep working: create an account
// first, then the code is waiting on the next screen.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = normalizeCode((await searchParams).code);
  const q = code ? `?code=${code}` : "";
  redirect((await getCurrentContext()) ? `/welcome${q}` : `/signup${q}`);
}
