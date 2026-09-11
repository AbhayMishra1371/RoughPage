"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadNotebookPdfById, getNotebook, type NotebookDetail } from "@/lib/api";
import { PaperTape, HandDrawnArrow, PdfIcon, NotebookIcon } from "@/components/Sketch";
import { getAccessToken, getSupabase } from "@/lib/supabase/client";
import type { NotebookElement } from "@/lib/types";

interface NotebookViewerProps {
  id: string;
}

export default function NotebookViewer({ id }: NotebookViewerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [viewMode, setViewMode] = useState<"renderer_pdf" | "html_pages">("renderer_pdf");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (!data?.user) {
        router.push("/sign-in");
      } else {
        getNotebook(id)
          .then((d) => {
            setDetail(d);
            setLoading(false);
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Failed to load notebook");
            setLoading(false);
          });
      }
    });
  }, [id, router]);

  useEffect(() => {
    let active = true;
    async function fetchPdfBlob() {
      setPdfLoading(true);
      try {
        const token = await getAccessToken();
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
        const res = await fetch(`${apiBase}/notebooks/${id}/pdf?disposition=inline`, {
          headers: {
            Authorization: `Bearer ${token ?? ""}`,
          },
        });
        if (res.ok) {
          const blob = await res.blob();
          if (active) {
            const url = window.URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setPdfLoading(false);
          }
        } else {
          if (active) setPdfLoading(false);
        }
      } catch (err) {
        console.warn("Could not prefetch PDF blob:", err);
        if (active) setPdfLoading(false);
      }
    }

    fetchPdfBlob();

    return () => {
      active = false;
    };
  }, [id]);

  const pages = detail?.document?.pages || [];
  const totalPages = Math.max(1, pages.length);
  const activePage = pages[currentPage - 1] || pages[0];

  async function handleDownloadPDF() {
    setIsDownloading(true);
    try {
      if (pdfBlobUrl) {
        const a = document.createElement("a");
        a.href = pdfBlobUrl;
        a.download = `${detail?.title || "notebook"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        await downloadNotebookPdfById(id, detail?.title);
      }
    } catch {
      alert("Downloading PDF failed or PDF is still preparing.");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  }

  if (loading) {
    return (
      <div className="py-24 max-w-4xl mx-auto px-4 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="font-hand text-xl text-[var(--ink)]">
          Opening handwritten study notebook...
        </p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="py-20 max-w-xl mx-auto px-4 text-center space-y-4">
        <div className="p-6 bg-red-50 border-2 border-red-200 font-hand text-base text-[var(--coral)]">
          ✗ {error || "Notebook not found."}
        </div>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-sm font-sans text-[var(--ink)] hover:underline font-medium"
        >
          ← Return to Library
        </Link>
      </div>
    );
  }

  const meta = detail.document?.metadata || {
    title: detail.title,
    subject: detail.subject,
    style: detail.style,
  };

  return (
    <div className="py-6 sm:py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Top Breadcrumb & Notebook Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--ink)]/15 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans text-[var(--ink-soft)] mb-1">
            <Link href="/library" className="hover:underline flex items-center gap-1">
              <NotebookIcon className="w-3.5 h-3.5" />
              <span>My Notebooks</span>
            </Link>
            <span>/</span>
            <span className="font-hand font-bold text-[var(--coral)] uppercase">
              {detail.style.replace("_", " ")} Notes
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-tight">
            {detail.title}
          </h1>
          {detail.subject && (
            <p className="font-sans text-xs text-[var(--ink-soft)] mt-0.5">
              Subject: {detail.subject}
            </p>
          )}
        </div>

        {/* Action Header Buttons & View Modes */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex bg-[var(--bg-paper-darker)] p-1 border border-[var(--ink)]/30 rounded-xs font-sans text-xs">
            <button
              onClick={() => setViewMode("renderer_pdf")}
              className={`px-3 py-1.5 transition-all cursor-pointer font-medium ${
                viewMode === "renderer_pdf"
                  ? "bg-[var(--ink)] text-white shadow-xs"
                  : "text-[var(--ink-soft)] hover:text-black"
              }`}
            >
              📄 Handwritten Notebook (Renderer)
            </button>
            <button
              onClick={() => setViewMode("html_pages")}
              className={`px-3 py-1.5 transition-all cursor-pointer font-medium ${
                viewMode === "html_pages"
                  ? "bg-[var(--ink)] text-white shadow-xs"
                  : "text-[var(--ink-soft)] hover:text-black"
              }`}
            >
              📑 Topic Pages Reader
            </button>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-4 py-2 text-sm font-medium shadow-[2px_3px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer disabled:opacity-50"
          >
            <PdfIcon className="w-4 h-4" />
            <span>{isDownloading ? "Preparing..." : "Download PDF"}</span>
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--ink)]/30 text-[var(--ink)] px-3 py-2 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>{copiedShare ? "✓ Copied Link" : "🔗 Share"}</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: THE AUTHENTIC RENDERER FORMAT (PUPPETEER / ROUGH.JS / KALAM) */}
      {viewMode === "renderer_pdf" && (
        <div className="space-y-4">
          {pdfLoading && (
            <div className="py-20 text-center bg-white paper-card border-2 border-[var(--ink)] p-8 max-w-2xl mx-auto space-y-4 shadow-sm">
              <PaperTape className="mx-auto" />
              <div className="w-10 h-10 border-3 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="font-hand text-2xl font-bold text-[var(--ink)]">
                Preparing Handwritten Notebook Pages...
              </h3>
              <p className="font-sans text-xs text-[var(--ink-soft)] max-w-md mx-auto">
                Running Rough.js sketch layout, ruled line snapping, and font metrics via the renderer.
              </p>
            </div>
          )}

          {pdfBlobUrl && (
            <div className="w-full flex flex-col items-center justify-center">
              <iframe
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={detail.title}
                className="w-full max-w-5xl h-[850px] sm:h-[1100px] border-2 border-[var(--ink)] shadow-[12px_16px_0px_#111827] rounded-sm bg-slate-200"
              />
            </div>
          )}

          {!pdfLoading && !pdfBlobUrl && (
            <div className="p-8 text-center bg-amber-50 border-2 border-amber-300 font-hand space-y-3 max-w-lg mx-auto">
              <p className="text-base text-amber-950 font-bold">
                Could not stream live preview. Please click Download PDF above.
              </p>
              <button
                onClick={() => setViewMode("html_pages")}
                className="text-xs font-sans text-[var(--coral)] underline hover:text-black cursor-pointer"
              >
                Switch to Topic Pages Reader
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: HTML PAGES READER */}
      {viewMode === "html_pages" && (
        <div className="space-y-6">
          {/* Floating Toolbar Controls */}
          <div className="bg-white paper-card p-3 border-2 border-[var(--ink)] flex flex-wrap items-center justify-between gap-4 shadow-sm">
            
            {/* Left: Page Navigation */}
            <div className="flex items-center gap-2 font-hand text-sm font-bold text-[var(--ink)]">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-[var(--bg-paper-darker)] border border-[var(--ink)]/30 disabled:opacity-40 cursor-pointer hover:bg-amber-100"
              >
                ← Prev Page
              </button>

              <span className="px-3 py-1 bg-amber-100 border border-amber-300">
                Topic Section {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-[var(--bg-paper-darker)] border border-[var(--ink)]/30 disabled:opacity-40 cursor-pointer hover:bg-amber-100"
              >
                Next Page →
              </button>
            </div>

            {/* Center: Zoom Controls */}
            <div className="flex items-center gap-2 font-sans text-xs font-medium border-x border-slate-200 px-4">
              <span className="text-[var(--ink-faded)] hidden sm:inline">Zoom:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                className="px-2 py-1 bg-slate-100 border border-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="px-2 py-1 bg-slate-100 border border-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="px-2 py-1 bg-white border border-slate-300 text-slate-600 hover:text-black cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Right: Style Badge */}
            <div className="flex items-center gap-1.5 font-hand text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1 border border-amber-300">
              <span>STYLE: {detail.style.toUpperCase()}</span>
            </div>

          </div>

          {/* Physical Ruled Sheet */}
          <div className="overflow-x-auto py-4 flex justify-center">
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
              className="transition-transform duration-200"
            >
              <div className="w-[820px] min-h-[1080px] bg-white notebook-ruled border-2 border-[var(--ink)] p-10 sm:p-12 relative shadow-[12px_16px_0px_#111827]">
                <PaperTape className="absolute -top-4 left-20" />
                <PaperTape className="absolute -top-4 right-20" />

                {/* Left Margin Annotations */}
                <div className="absolute left-2 top-24 w-10 space-y-16 pointer-events-none">
                  <div className="font-hand text-[10px] text-[var(--coral)] font-bold -rotate-90 origin-top-left whitespace-nowrap">
                    ★ TOPIC {currentPage}
                  </div>
                </div>

                {/* Content */}
                <div className="pl-10 space-y-6">
                  <div className="border-b-2 border-red-400 pb-3 flex items-end justify-between">
                    <div>
                      <span className="font-hand text-xs text-[var(--coral)] font-bold uppercase tracking-wider block">
                        {meta.subject || detail.title}
                      </span>
                      <h2 className="font-hand text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                        {activePage?.topic || detail.title}
                      </h2>
                    </div>
                    <div className="font-hand text-xs text-slate-500 text-right">
                      <span className="block text-[var(--turquoise)] font-bold">
                        Section {String(currentPage).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {activePage?.elements?.map((el, idx) => (
                      <RenderElementItem key={idx} element={el} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function RenderElementItem({ element }: { element: NotebookElement }) {
  const type = element.type;

  switch (type) {
    case "heading": {
      const level = (element.level as number) || 1;
      return (
        <div className="pt-2 pb-1 border-b border-amber-300">
          <h3
            className={`font-hand font-bold text-[var(--ink)] ${
              level === 1 ? "text-2xl text-[var(--coral)]" : "text-xl"
            }`}
          >
            {String(element.text || "")}
          </h3>
        </div>
      );
    }

    case "paragraph": {
      return (
        <p className="font-hand text-base text-slate-800 leading-relaxed pl-1">
          {String(element.text || "")}
        </p>
      );
    }

    case "bullet_list": {
      const items = Array.isArray(element.items) ? (element.items as string[]) : [];
      return (
        <div className="space-y-1.5 pl-2">
          {Boolean(element.title) && (
            <h4 className="font-hand font-bold text-sm text-[var(--turquoise)]">
              {String(element.title)}
            </h4>
          )}
          <ul className="space-y-1 font-hand text-sm text-slate-800">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[var(--coral)] font-bold">→</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "definition": {
      return (
        <div className="p-3 bg-amber-50/70 border-2 border-dashed border-amber-400 rounded-sm font-hand space-y-1">
          <div className="font-bold text-base text-[var(--ink)]">
            <span className="highlight-yellow">{String(element.term || "Term")}</span>
          </div>
          <p className="text-sm text-slate-800 pl-1">{String(element.meaning || "")}</p>
          {Boolean(element.example) && (
            <p className="text-xs text-slate-600 italic pl-1">
              e.g. {String(element.example)}
            </p>
          )}
        </div>
      );
    }

    case "important_note": {
      return (
        <div className="p-3 bg-red-50/80 border-2 border-red-300 rounded-sm font-hand text-sm text-red-950 flex items-start gap-2 shadow-xs">
          <span className="text-[var(--coral)] text-lg font-bold">★</span>
          <div>
            <strong className="block text-xs uppercase tracking-wider text-[var(--coral)]">
              Important Note
            </strong>
            <span>{String(element.text || "")}</span>
          </div>
        </div>
      );
    }

    case "sticky_formula": {
      return (
        <div className="w-full sm:w-96 sticky-note-yellow p-4 border border-amber-300 font-hand space-y-1 my-3 shadow-sm">
          <span className="font-bold text-xs uppercase text-amber-900 block">
            ★ {String(element.label || "Key Formula")}
          </span>
          <div className="text-base font-mono bg-white/60 p-2 border border-amber-200 rounded text-slate-900 font-bold">
            {String(element.formula || "")}
          </div>
        </div>
      );
    }

    case "comparison": {
      const leftLabel = String(element.left_label || "Option A");
      const rightLabel = String(element.right_label || "Option B");
      const rows = Array.isArray(element.rows) ? (element.rows as [string, string][]) : [];
      return (
        <div className="space-y-2 my-2 font-hand">
          {Boolean(element.title) && (
            <h4 className="font-bold text-base text-[var(--ink)]">
              {String(element.title)}
            </h4>
          )}
          <div className="border-2 border-[var(--ink)] rounded-xs overflow-hidden text-xs">
            <div className="grid grid-cols-2 bg-amber-100 p-2 font-bold border-b border-[var(--ink)]">
              <span>{leftLabel}</span>
              <span>{rightLabel}</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={i}
                className={`grid grid-cols-2 p-2 border-b border-slate-200 ${
                  i % 2 === 1 ? "bg-slate-50" : "bg-white"
                }`}
              >
                <span className="pr-2">{r[0]}</span>
                <span className="pl-2 border-l border-slate-200">{r[1]}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "flowchart": {
      const steps = Array.isArray(element.steps) ? (element.steps as string[]) : [];
      return (
        <div className="space-y-2 p-4 bg-teal-50/60 border border-teal-200 rounded font-hand">
          {Boolean(element.title) && (
            <h4 className="font-bold text-sm text-teal-900">
              {String(element.title)}
            </h4>
          )}
          <div className="flex flex-col items-center gap-2 text-xs text-slate-800 text-center">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="bg-white border border-teal-300 px-4 py-1.5 shadow-xs font-medium">
                  {step}
                </div>
                {i < steps.length - 1 && (
                  <HandDrawnArrow className="w-6 h-3 rotate-90" stroke="var(--turquoise)" />
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "code_block": {
      return (
        <div className="my-2 bg-slate-900 text-teal-300 font-mono text-xs p-4 rounded border-2 border-slate-700 space-y-1 overflow-x-auto">
          {Boolean(element.language) && (
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-800">
              {String(element.language)}
            </span>
          )}
          <pre className="pt-1 whitespace-pre-wrap">{String(element.code || "")}</pre>
        </div>
      );
    }

    case "example": {
      return (
        <div className="p-3.5 bg-blue-50/60 border-l-4 border-blue-400 font-hand space-y-1 text-sm">
          <strong className="text-blue-900 block text-xs uppercase tracking-wider">
            Worked Example: {String(element.context || "")}
          </strong>
          <p className="text-slate-800 whitespace-pre-wrap">
            {String(element.walkthrough || "")}
          </p>
        </div>
      );
    }

    case "summary": {
      const points = Array.isArray(element.points) ? (element.points as string[]) : [];
      return (
        <div className="p-4 bg-amber-100/70 border border-amber-300 rounded font-hand space-y-2">
          <strong className="text-amber-950 font-bold text-sm uppercase tracking-wide block">
            ★ Summary Takeaways
          </strong>
          <ul className="space-y-1 text-sm text-slate-800">
            {points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-800 font-bold">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    default: {
      const fallbackText =
        typeof element.text === "string"
          ? element.text
          : JSON.stringify(element);
      return (
        <div className="p-2 border border-slate-200 font-hand text-xs text-slate-600">
          {fallbackText}
        </div>
      );
    }
  }
}
