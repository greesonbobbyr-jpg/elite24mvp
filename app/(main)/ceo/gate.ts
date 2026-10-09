import { notFound } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { ceoAccessFrom, type CeoAccess } from "@/lib/data/ceo";

// Every CEO View page calls this FIRST, before any read: the layout's check
// alone doesn't stop a page from rendering (lib/data/ceo explains). Anyone
// but the CEO gets a 404.
export async function requireCeo(): Promise<CeoAccess> {
  const ceo = ceoAccessFrom(await getCurrentContext());
  if (!ceo) notFound();
  return ceo;
}
