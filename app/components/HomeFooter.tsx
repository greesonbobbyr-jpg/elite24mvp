"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

// The "Powered by Elite 24 MVP" mark. Rendered ONLY on the Home route ("/") —
// on every other page it returns null. (Owner branding decision to keep the
// footer to Home; the mark still anchors the app's landing/home.)
export function HomeFooter() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <footer className="flex flex-col items-center gap-2 border-t border-zinc-900 py-5 text-center text-xs text-zinc-500">
      <Image
        src="/logo.png"
        alt="Elite 24 MVP"
        width={40}
        height={40}
        className="h-10 w-10"
      />
      <span>
        Powered by{" "}
        <span className="font-semibold text-red-500">Elite 24 MVP</span>
      </span>
    </footer>
  );
}
