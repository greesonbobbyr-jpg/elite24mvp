"use client";

import dynamic from "next/dynamic";

// react-pdf / pdfjs use browser-only globals (DOMMatrix, etc.), so the viewer
// must NOT be server-rendered. ssr:false is only allowed inside a Client
// Component, which is why this thin wrapper exists.
const PdfViewer = dynamic(
  () => import("./PdfViewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <p className="p-6 text-sm text-zinc-400">Loading viewer…</p>
    ),
  },
);

export function PdfViewerLoader({ src }: { src: string }) {
  return <PdfViewer src={src} />;
}
