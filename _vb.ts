import { readBranding, validateImageDataUrl } from "./lib/branding";
const PNG = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
function fd(o: Record<string,string>) { const f = new FormData(); for (const k in o) f.set(k, o[k]); return f; }
const ok = (c: boolean, m: string) => console.log((c ? "PASS" : "FAIL") + "  " + m);

// Gary / Mustang team-settings save (relative logo + non-palette brand red + white + his photo)
const m = readBranding(fd({ name: "Mustang Broncos", logoUrl: "/mustang-logo.png", primaryColor: "#c8102e", secondaryColor: "#ffffff", photoUrl: PNG }));
ok("data" in m && m.data.logoUrl === "/mustang-logo.png" && m.data.primaryColor === "#c8102e", "Mustang branding accepted (was blocked)");
const gp = validateImageDataUrl(PNG, "photo");
ok("url" in gp, "coach photo (webp data URL) accepted");

// OKC (non-palette blue/orange)
const o = readBranding(fd({ name: "OKC Thunder", logoUrl: "", primaryColor: "#007ac1", secondaryColor: "#ef3b24" }));
ok("data" in o, "OKC branding accepted");

// security: protocol-relative + non-hex still rejected
ok("error" in validateImageDataUrl("//evil.com/x.png", "logo"), "protocol-relative logo rejected");
ok("error" in readBranding(fd({ name: "x", primaryColor: "red;background:url(x)" })), "non-hex color rejected");
ok("data" in validateImageDataUrl("", "logo") === false ? false : (validateImageDataUrl("","logo") as any).url === null, "empty -> null");
