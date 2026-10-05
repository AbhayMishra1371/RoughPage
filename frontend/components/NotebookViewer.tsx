"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { downloadNotebookPdfById, getNotebook, type NotebookDetail } from "@/lib/api";
import { PdfIcon, NotebookIcon } from "@/components/Sketch";
import { getSupabase } from "@/lib/supabase/client";
import NotebookRenderer from "@/components/renderer/NotebookRenderer";

interface NotebookViewerProps {
  id: string;
}

export default function NotebookViewer({ id }: NotebookViewerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPhysicalPages, setTotalPhysicalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [viewAllPages, setViewAllPages] = useState(false);

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

  async function handleDownloadPDF() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadNotebookPdfById(id, detail?.title);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Downloading PDF failed. Please try again in a few moments.");
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

  if (error || !detail || !detail.document) {
    return (
      <div className="py-20 max-w-xl mx-auto px-4 text-center space-y-4">
        <div className="p-6 bg-red-50 border-2 border-red-200 font-hand text-base text-[var(--coral)]">
          ✗ {error || "Notebook not found or has no content."}
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

  const effectiveTotalPages = Math.max(1, totalPhysicalPages);

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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-4 py-2 text-sm font-medium shadow-[2px_3px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <PdfIcon className="w-4 h-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--ink)]/30 text-[var(--ink)] px-3 py-2 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>{copiedShare ? "✓ Copied Link" : "🔗 Share"}</span>
          </button>
        </div>
      </div>

      {/* Toolbar Controls: Pagination, Zoom, Style */}
      <div className="bg-white paper-card p-3 border-2 border-[var(--ink)] flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-2 font-hand text-sm font-bold text-[var(--ink)]">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || viewAllPages}
            className="px-3 py-1 bg-[var(--bg-paper-darker)] border border-[var(--ink)]/30 disabled:opacity-40 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            ← Prev Page
          </button>

          <span className="px-3 py-1 bg-amber-100 border border-amber-300">
            {viewAllPages ? `All ${effectiveTotalPages} Pages` : `Page ${currentPage} of ${effectiveTotalPages}`}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(effectiveTotalPages, p + 1))}
            disabled={currentPage >= effectiveTotalPages || viewAllPages}
            className="px-3 py-1 bg-[var(--bg-paper-darker)] border border-[var(--ink)]/30 disabled:opacity-40 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            Next Page →
          </button>

          {effectiveTotalPages > 1 && (
            <label className="flex items-center gap-1.5 text-xs font-sans font-medium text-slate-600 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={viewAllPages}
                onChange={(e) => setViewAllPages(e.target.checked)}
                className="cursor-pointer"
              />
              <span>View all</span>
            </label>
          )}
        </div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-2 font-sans text-xs font-medium border-x border-slate-200 px-4">
          <span className="text-[var(--ink-faded)] hidden sm:inline">Zoom:</span>
          <button
            onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
            className="px-2 py-1 bg-slate-100 border border-slate-300 hover:bg-slate-200 cursor-pointer"
            title="Zoom out"
          >
            -
          </button>
          <span className="font-mono w-10 text-center">{zoomLevel}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="px-2 py-1 bg-slate-100 border border-slate-300 hover:bg-slate-200 cursor-pointer"
            title="Zoom in"
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

      {/* Handwritten Notebook Sheet Viewport */}
      <div className="overflow-x-auto py-4 flex justify-center bg-slate-100/50 rounded-md border border-slate-200/80 p-2 sm:p-6">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top center",
          }}
          className="transition-transform duration-200"
        >
          <NotebookRenderer
            doc={detail.document}
            breakOnTopic={false}
            activePageNumber={viewAllPages ? undefined : currentPage}
            onTotalPages={(total) => {
              if (total > 0) setTotalPhysicalPages(total);
            }}
            shadow={true}
            signalReady={false}
          />
        </div>
      </div>
    </div>
  );
}
