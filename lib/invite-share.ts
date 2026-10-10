import { headers } from "next/headers";
import QRCode from "qrcode";

// What an inviter gets to share once an invite exists: the code, a link to
// /invite/<token>, and a QR code of that link (server-rendered SVG, black on
// white so any phone camera reads it). Server-only (request headers).

export type MadeInvite = { code: string; link: string; qr: string; what: string; days: number };

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "elite24mvp.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function shareable(code: string, token: string, what: string, days: number): Promise<MadeInvite> {
  const link = `${await appOrigin()}/invite/${token}`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  return { code, link, qr, what, days };
}
