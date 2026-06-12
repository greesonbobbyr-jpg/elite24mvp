"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

// PDF.js renders the pages into the page (works regardless of the browser's
// "download PDFs" setting). Worker is served from /public so its version
// matches the installed pdfjs-dist.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// One page that only renders to canvas while it's near the viewport, so a long
// playbook stays fast and memory-light. A sized placeholder reserves the right
// space when the page isn't mounted, keeping scroll position stable.
function LazyPage({
  pageNumber,
  width,
  estimatedHeight,
}: {
  pageNumber: number;
  width: number;
  estimatedHeight: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "1200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={`pdf-page-${pageNumber}`}
      className="flex justify-center"
      style={{ minHeight: estimatedHeight }}
    >
      {visible && (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<div style={{ height: estimatedHeight }} />}
        />
      )}
    </div>
  );
}

export function PdfViewer({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(1.3); // page height / width
  const [pageInput, setPageInput] = useState("");

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const onLoad = useCallback(async (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages);
    try {
      const first = await pdf.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      setAspect(viewport.height / viewport.width);
    } catch {
      // keep the default aspect estimate
    }
  }, []);

  const estimatedHeight = Math.round(width * aspect);

  const jumpToPage = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const n = Number.parseInt(pageInput, 10);
      if (!Number.isInteger(n)) return;
      const target = Math.min(Math.max(n, 1), numPages);
      document
        .getElementById(`pdf-page-${target}`)
        ?.scrollIntoView({ block: "start" });
    },
    [pageInput, numPages],
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {numPages > 0 && (
        <form
          onSubmit={jumpToPage}
          className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/80 px-3 py-2 text-xs backdrop-blur"
        >
          <span className="text-zinc-400">Jump to page</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            placeholder="1"
            className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 outline-none focus:border-red-500"
          />
          <span className="text-zinc-500">of {numPages}</span>
          <button
            type="submit"
            className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700"
          >
            Go
          </button>
        </form>
      )}

      <Document
        file={src}
        onLoadSuccess={onLoad}
        loading={<p className="p-6 text-sm text-zinc-400">Loading playbook…</p>}
        error={
          <p className="p-6 text-sm text-zinc-400">
            Couldn&apos;t load the playbook.
          </p>
        }
        className="flex flex-col gap-3"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <LazyPage
            key={i}
            pageNumber={i + 1}
            width={width}
            estimatedHeight={estimatedHeight}
          />
        ))}
      </Document>
    </div>
  );
}
