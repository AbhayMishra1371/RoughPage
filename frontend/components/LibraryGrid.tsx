"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteNotebook, getPdfUrl, listNotebooks, type NotebookSummary } from "@/lib/api";
import { relativeDate } from "@/lib/jitter";
import { PaperTape, PenIcon, PdfIcon, NotebookIcon } from "@/components/Sketch";

export default function LibraryGrid() {
  const [items, setItems] = useState<NotebookSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string>("all");

  async function load() {
    try {
      setItems(await listNotebooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your library.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function download(id: string) {
    setBusyId(id);
    try {
      window.open(await getPdfUrl(id), "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: NotebookSummary) {
    if (!confirm(`Throw away notebook "${item.title}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    try {
      await deleteNotebook(item.id);
      setItems((xs) => (xs ? xs.filter((x) => x.id !== item.id) : xs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  // Filter notebooks based on search and style filter
  const filteredItems = (items || []).filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subject && item.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStyle = selectedStyle === "all" || item.style === selectedStyle;
    return matchesSearch && matchesStyle;
  });

  return (
    <div className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Dashboard Top Header & CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-2 border-[var(--ink)]/15 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-100 px-3 py-1 border border-amber-300 font-hand text-xs text-amber-900 mb-2">
            <NotebookIcon className="w-4 h-4 text-[var(--coral)]" />
            <span>Student Desk & Digital Binder</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--ink)] tracking-tight">
            My Study Notebooks
          </h1>
          <p className="font-sans text-sm text-[var(--ink-soft)] mt-1">
            Access your AI-generated handwritten lecture PDFs anytime.
          </p>
        </div>

        <Link
          href="/generate"
          className="inline-flex items-center justify-center gap-2 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-6 py-3 font-medium text-sm sm:text-base shadow-[3px_4px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer self-start md:self-auto"
        >
          <PenIcon className="w-4 h-4" />
          <span>+ Create New Notes</span>
        </Link>
      </div>

      {/* Filter Controls: Search Bar & Note Style Tabs */}
      <div className="bg-white paper-card p-4 border-2 border-[var(--ink)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notebooks, subjects, or concepts..."
            className="w-full bg-[var(--bg-paper-darker)]/40 border border-[var(--ink)]/30 px-4 py-2.5 pl-10 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faded)] focus:outline-none focus:border-[var(--coral)] focus:bg-white transition-colors"
          />
          <svg className="w-4 h-4 text-[var(--ink-faded)] absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Note Style Filter Tabs */}
        <div className="flex items-center gap-1.5 font-sans text-xs font-medium">
          <span className="text-[var(--ink-faded)] hidden lg:inline mr-1">Style:</span>
          {[
            { id: "all", label: "All Styles" },
            { id: "detailed", label: "Detailed" },
            { id: "topper", label: "Topper" },
            { id: "last_minute", label: "Last Minute" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStyle(tab.id)}
              className={`px-3 py-2 border transition-all cursor-pointer ${
                selectedStyle === tab.id
                  ? "bg-[var(--ink)] text-white border-[var(--ink)] font-semibold shadow-[1px_2px_0px_#111827]"
                  : "bg-white text-[var(--ink-soft)] border-[var(--ink)]/20 hover:bg-amber-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="p-4 bg-red-50 border-2 border-red-200 font-hand text-base text-[var(--coral)] font-bold">
          ✗ {error}
        </div>
      )}

      {/* Empty State */}
      {items !== null && filteredItems.length === 0 && (
        <div className="text-center py-16 bg-white paper-card border-2 border-[var(--ink)] p-8 max-w-xl mx-auto space-y-4">
          <PaperTape className="mx-auto" />
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-[var(--coral)] font-hand text-3xl font-bold">
            ✎
          </div>
          <h3 className="font-serif text-2xl font-bold text-[var(--ink)]">
            No notebooks found
          </h3>
          <p className="font-sans text-sm text-[var(--ink-soft)] max-w-sm mx-auto">
            {searchQuery
              ? `No notes matching "${searchQuery}". Try clearing your search.`
              : "You haven't generated any study notes yet. Paste a lecture link to start."}
          </p>
          <div className="pt-2">
            <Link
              href="/generate"
              className="inline-flex items-center gap-2 bg-[var(--coral)] text-white px-5 py-2.5 text-sm font-medium shadow-[2px_3px_0px_#111827] hover:-translate-y-0.5 transition-all"
            >
              <PenIcon className="w-4 h-4" />
              <span>Generate My First Notes</span>
            </Link>
          </div>
        </div>
      )}

      {/* Loading state skeletons */}
      {items === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white paper-card p-6 border-2 border-[var(--ink)]/30 animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 w-3/4" />
              <div className="h-3 bg-slate-200 w-1/2" />
              <div className="h-28 bg-amber-50 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Notebook Cards Grid - Represented as Physical Ruled Paper Previews */}
      {items !== null && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((nb, i) => (
            <article
              key={nb.id}
              className={`group bg-white notebook-ruled border-2 border-[var(--ink)] p-6 relative flex flex-col justify-between shadow-[6px_8px_0px_#111827] ${
                i % 2 === 0 ? "tilt-left" : "tilt-right"
              } hover:-translate-y-1 hover:shadow-[8px_10px_0px_#111827] transition-all`}
            >
              <PaperTape className="absolute -top-3 right-8" />

              <div className="pl-6 space-y-3">
                
                {/* Header Title & Subject */}
                <div className="border-b border-red-300 pb-2">
                  <div className="flex items-center justify-between text-xs font-hand text-[var(--ink-faded)] mb-1">
                    <span className="bg-amber-100 px-2 py-0.5 border border-amber-200 uppercase font-bold text-amber-900">
                      {nb.style.replace("_", " ")}
                    </span>
                    <span>{relativeDate(nb.created_at)}</span>
                  </div>
                  <h2 className="font-hand text-xl font-bold text-[var(--ink)] group-hover:text-[var(--coral)] transition-colors line-clamp-2">
                    <Link href={`/notes/${nb.id}`} className="hover:underline">
                      {nb.title}
                    </Link>
                  </h2>
                  <p className="font-sans text-xs text-[var(--ink-soft)] font-medium mt-0.5">
                    {nb.subject || "General Lecture"}
                  </p>
                </div>

                {/* Small Handwritten Text Preview Container */}
                <Link href={`/notes/${nb.id}`} className="block">
                  <div className="h-32 bg-amber-50/60 border border-amber-200 p-3 rounded-sm font-hand text-xs text-slate-800 space-y-1.5 overflow-hidden relative group-hover:border-[var(--coral)] transition-colors">
                    <p className="font-bold text-[var(--coral)]">★ Handwritten Note Summary:</p>
                    <p className="line-clamp-3 text-slate-700 italic">
                      • Lecture concepts structured into definitions & key points\n• Important formulas highlighted in sticky notes\n• High-resolution vector PDF ready
                    </p>
                    <div className="absolute bottom-2 right-2 bg-white px-2 py-0.5 border border-slate-300 text-[10px] font-sans font-bold text-teal-800 shadow-xs">
                      {nb.page_count} {nb.page_count === 1 ? "page" : "pages"}
                    </div>
                  </div>
                </Link>

              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-dashed border-[var(--ink)]/20 flex items-center justify-between font-sans text-xs">
                
                {/* View Details Link */}
                <Link
                  href={`/notes/${nb.id}`}
                  className="font-hand text-sm font-bold text-[var(--ink)] hover:text-[var(--coral)] underline cursor-pointer"
                >
                  Open Notebook ✎
                </Link>

                {/* PDF & Delete Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => download(nb.id)}
                    disabled={busyId === nb.id}
                    className="flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 border border-amber-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
                    title="Download PDF"
                  >
                    <PdfIcon className="w-3.5 h-3.5" />
                    <span>{busyId === nb.id ? "Preparing..." : "PDF"}</span>
                  </button>

                  <button
                    onClick={() => remove(nb)}
                    disabled={busyId === nb.id}
                    className="p-1 text-[var(--ink-faded)] hover:text-[var(--coral)] transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete Notebook"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

              </div>

            </article>
          ))}
        </div>
      )}

    </div>
  );
}