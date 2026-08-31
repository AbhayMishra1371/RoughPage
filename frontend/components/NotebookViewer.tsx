"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPdfUrl } from "@/lib/api";
import { PaperTape, HandDrawnArrow, PdfIcon, PenIcon, NotebookIcon } from "@/components/Sketch";
import { getSupabase } from "@/lib/supabase/client";

interface NotebookViewerProps {
  id: string;
}

export default function NotebookViewer({ id }: NotebookViewerProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeStyle, setActiveStyle] = useState<"detailed" | "topper" | "last_minute">("detailed");
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (!data?.user) {
        router.push("/sign-in");
      }
    });
  }, [router]);

  const totalPages = 3;

  async function handleDownloadPDF() {
    setIsDownloading(true);
    try {
      window.open(await getPdfUrl(id), "_blank");
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

  return (
    <div className="py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      
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
              {activeStyle.replace("_", " ")} Notes
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-tight">
            Data Structures & Algorithms — Lecture 04
          </h1>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
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
            Page {currentPage} of {totalPages}
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

        {/* Right: Note Style Switcher */}
        <div className="flex items-center gap-1.5 font-sans text-xs">
          <span className="text-[var(--ink-faded)] hidden lg:inline mr-1">Style View:</span>
          {[
            { id: "detailed", label: "Detailed" },
            { id: "topper", label: "Topper" },
            { id: "last_minute", label: "Last Minute" },
          ].map((style) => (
            <button
              key={style.id}
              onClick={() => setActiveStyle(style.id as any)}
              className={`px-3 py-1.5 border transition-all cursor-pointer font-medium ${
                activeStyle === style.id
                  ? "bg-[var(--coral)] text-white border-[var(--coral)] font-bold shadow-xs"
                  : "bg-white text-[var(--ink-soft)] border-slate-300 hover:bg-amber-50"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

      </div>

      {/* Authentic Physical Notebook Page Canvas Container */}
      <div className="overflow-x-auto py-4 flex justify-center">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
          className="transition-transform duration-200"
        >
          <div className="w-[820px] min-h-[1080px] bg-white notebook-ruled border-2 border-[var(--ink)] p-10 sm:p-12 relative shadow-[12px_16px_0px_#111827]">
            <PaperTape className="absolute -top-4 left-20" />
            <PaperTape className="absolute -top-4 right-20" />

            {/* Left Margin Annotations Layer (positioned in the left red line margin area) */}
            <div className="absolute left-2 top-24 w-10 space-y-16 pointer-events-none">
              <div className="font-hand text-[10px] text-[var(--coral)] font-bold tilt-left -rotate-90 origin-top-left whitespace-nowrap">
                ★ EXAM HIGH YIELD
              </div>
              <div className="font-hand text-[10px] text-[var(--turquoise)] font-bold -rotate-90 origin-top-left whitespace-nowrap">
                DEFINITION #04
              </div>
            </div>

            {/* Main Notebook Content Area (Offset past red line margin) */}
            <div className="pl-10 space-y-6">
              
              {/* Notebook Header Title */}
              <div className="border-b-2 border-red-400 pb-3 flex items-end justify-between">
                <div>
                  <span className="font-hand text-xs text-[var(--coral)] font-bold uppercase tracking-wider block">
                    Data Structures • Lecture 04
                  </span>
                  <h2 className="font-hand text-3xl font-bold text-[var(--ink)]">
                    Trees, Binary Search Trees & Balancing
                  </h2>
                </div>
                <div className="font-hand text-xs text-slate-500 text-right">
                  <span>Date: Oct 24</span>
                  <span className="block text-[var(--turquoise)] font-bold">Page 01</span>
                </div>
              </div>

              {/* Section 1: Core Definition & Concept */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-hand text-xl font-bold text-[var(--ink)]">
                  <span className="text-[var(--coral)]">1.</span>
                  <span className="highlight-yellow">Binary Search Tree (BST) Invariant</span>
                </div>
                <p className="font-hand text-base text-slate-800 leading-relaxed pl-4">
                  For every node <code className="font-mono text-sm bg-amber-100 px-1">X</code>: all keys in its left subtree are <strong>strictly smaller</strong> than <code className="font-mono text-sm bg-amber-100 px-1">X.key</code>, and all keys in its right subtree are <strong>strictly greater</strong>.
                </p>
              </div>

              {/* Formula Sticky Note Floating */}
              <div className="relative my-4">
                <div className="w-80 sticky-note-yellow p-4 border border-amber-300 space-y-1 text-slate-900 font-hand">
                  <span className="font-bold text-xs uppercase text-amber-900 block">
                    ★ Key Time Complexity:
                  </span>
                  <div className="text-sm space-y-1">
                    <p>• Search / Insert: <strong>O(h)</strong> where h = height</p>
                    <p>• Balanced Tree (AVL/Red-Black): <strong>O(log N)</strong></p>
                    <p className="text-[var(--coral)] font-bold">
                      • Degenerate Linked List: O(N) [Worst Case!]
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Hand-drawn Comparison Table */}
              <div className="space-y-3">
                <div className="font-hand text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                  <span className="text-[var(--turquoise)]">2.</span>
                  <span>Comparison: Array vs Linked List vs BST</span>
                </div>

                {/* Hand-drawn style Table */}
                <div className="border-2 border-[var(--ink)] rounded-xs overflow-hidden font-hand text-xs">
                  <div className="grid grid-cols-4 bg-amber-100 p-2 font-bold border-b border-[var(--ink)]">
                    <span>Data Structure</span>
                    <span>Search</span>
                    <span>Insert</span>
                    <span>Delete</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 border-b border-slate-200">
                    <span className="font-bold">Unsorted Array</span>
                    <span>O(N)</span>
                    <span>O(1)</span>
                    <span>O(N)</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 border-b border-slate-200 bg-slate-50">
                    <span className="font-bold">Sorted Array</span>
                    <span className="text-teal-700 font-bold">O(log N)</span>
                    <span>O(N)</span>
                    <span>O(N)</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 bg-teal-50/70 font-bold text-teal-900">
                    <span>Balanced BST</span>
                    <span>O(log N)</span>
                    <span>O(log N)</span>
                    <span>O(log N)</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Algorithm Flowchart Diagram */}
              <div className="space-y-3 pt-2">
                <div className="font-hand text-lg font-bold text-[var(--ink)]">
                  3. Tree Search Algorithm Logic
                </div>

                <div className="p-4 bg-teal-50/60 border border-teal-200 rounded flex flex-col items-center gap-2 font-hand text-xs text-slate-800 text-center">
                  <div className="bg-amber-100 border border-amber-300 px-4 py-1.5 font-bold">
                    Start: Node = Root, Key = Target
                  </div>
                  <HandDrawnArrow className="w-8 h-4 rotate-90" stroke="var(--turquoise)" />
                  <div className="bg-white border border-slate-300 px-4 py-1.5">
                    If Target == Node.Key ➔ Return Node (Found!)
                  </div>
                  <div className="flex gap-8 items-center mt-1">
                    <div className="bg-red-50 border border-red-200 px-3 py-1">
                      If Target &lt; Node.Key ➔ Recurse Left
                    </div>
                    <div className="bg-blue-50 border border-blue-200 px-3 py-1">
                      If Target &gt; Node.Key ➔ Recurse Right
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Code Snippet Card */}
              <div className="space-y-2 pt-2">
                <div className="font-hand text-lg font-bold text-[var(--ink)]">
                  4. Python Recursive Search Implementation
                </div>

                <div className="bg-slate-900 text-teal-300 font-mono text-xs p-4 rounded border-2 border-slate-700 space-y-1">
                  <p className="text-slate-500">// Recursive BST Search</p>
                  <p><span className="text-amber-400">def</span> search(root, key):</p>
                  <p className="pl-4"><span className="text-amber-400">if</span> root <span className="text-amber-400">is</span> None <span className="text-amber-400">or</span> root.val == key:</p>
                  <p className="pl-8 text-teal-200">return root</p>
                  <p className="pl-4"><span className="text-amber-400">if</span> key &lt; root.val:</p>
                  <p className="pl-8 text-teal-200">return search(root.left, key)</p>
                  <p className="pl-4"><span className="text-amber-400">return</span> search(root.right, key)</p>
                </div>
              </div>

              {/* Section 5: Video Callout Screenshot Fragment */}
              <div className="p-3 bg-slate-100 border border-slate-300 flex items-center gap-4">
                <div className="w-24 h-16 bg-slate-800 rounded flex items-center justify-center text-[10px] text-slate-300 font-mono">
                  [Timestamp 18:42]
                </div>
                <div className="font-hand text-xs text-slate-800">
                  <p className="font-bold text-[var(--coral)]">Prof. Demaine Explanation:</p>
                  <p className="italic text-slate-700">"Notice how AVL rotations rebalance height in constant O(1) time."</p>
                </div>
              </div>

              {/* Notebook Footer */}
              <div className="pt-6 border-t border-dashed border-slate-300 flex items-center justify-between font-hand text-xs text-[var(--ink-faded)]">
                <span>RoughPage Handwritten PDF Generator v2.4</span>
                <span>Page 01 of 03</span>
              </div>

            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
