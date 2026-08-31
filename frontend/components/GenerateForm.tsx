"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PenProgress from "@/components/PenProgress";
import { SketchUnderline, PaperTape, HandDrawnArrow, PenIcon, PdfIcon } from "@/components/Sketch";
import { getAccessToken, getSupabase } from "@/lib/supabase/client";

const STYLES: {
  value: "detailed" | "topper" | "last_minute";
  label: string;
  title: string;
  badge: string;
  description: string;
  previewSnippet: string;
}[] = [
  {
    value: "detailed",
    label: "DETAILED",
    title: "Detailed Lecture Notes",
    badge: "Comprehensive",
    description: "Clean, complete handwritten notes covering every concept & detail in full.",
    previewSnippet: "• Complete definitions & derivations\n• Step-by-step lecture walkthrough\n• All diagrams & full code examples",
  },
  {
    value: "topper",
    label: "TOPPER",
    title: "Topper's High-Signal Notes",
    badge: "Exam Focused",
    description: "Structured notes emphasizing crucial concepts, formulas, and comparison tables.",
    previewSnippet: "• High-yield exam shortcuts & formulas\n• Comparison matrices & key traps\n• Highlighted definitions",
  },
  {
    value: "last_minute",
    label: "LAST MINUTE",
    title: "Last-Minute Cram Notes",
    badge: "Quick Revision",
    description: "Compact revision sheets focusing strictly on formulas, facts & summary boxes.",
    previewSnippet: "⚡ Sticky-note formula cheat sheets\n⚡ Flashcard-style definitions\n⚡ 1-page summary for rapid review",
  },
];

type Phase =
  | { kind: "idle" }
  | { kind: "working"; percent: number; message: string }
  | { kind: "saved"; notebook: any }
  | { kind: "error"; message: string };

export default function GenerateForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [style, setStyle] = useState<"detailed" | "topper" | "last_minute">("detailed");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [downloading, setDownloading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (!data?.user) {
        router.push("/sign-in");
      }
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind === "working") return;
    setPhase({ kind: "working", percent: 4, message: "Fetching the lecture transcript..." });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1"}/generate/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({
            url,
            style,
            ...(subject.trim() ? { subject: subject.trim() } : {}),
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok || !res.body) {
        let detail = `${res.status}`;
        try {
          detail = (await res.json()).detail ?? detail;
        } catch {
          /* not json */
        }
        throw new Error(detail);
      }

      let doc: any = null;
      for await (const frame of (await res.body) as any) {
        if (frame.event === "progress") {
          const p = JSON.parse(frame.data);
          const percent =
            p.current != null && p.total
              ? Math.max(8, (p.current / p.total) * 92)
              : Math.min(90, (phase as { percent?: number }).percent ?? 30);
          setPhase({ kind: "working", percent, message: p.message });
        } else if (frame.event === "document") {
          doc = JSON.parse(frame.data);
        } else if (frame.event === "error") {
          throw new Error(JSON.parse(frame.data).detail ?? "Generation failed.");
        }
      }
      if (!doc) throw new Error("The generation stream completed without a document.");

      setPhase({
        kind: "working",
        percent: 96,
        message: "Filing handwritten notebook into your library...",
      });

      setPhase({ kind: "saved", notebook: doc });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong during note generation.",
      });
    }
  }

  async function download(id: string) {
    setDownloading(true);
    try {
      window.open(`/api/notebooks/${id}/pdf-url`, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="py-8 sm:py-12 max-w-5xl mx-auto px-4 sm:px-6">
      
      {/* Top Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 bg-amber-100 px-3 py-1 border border-amber-300 font-hand text-xs text-amber-900">
          <PenIcon className="w-4 h-4 text-[var(--coral)]" />
          <span>Lecture Notebook Generator</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--ink)] tracking-tight">
          Create Handwritten Notes
        </h1>
        <p className="font-sans text-base text-[var(--ink-soft)]">
          Paste your YouTube lecture link, choose your preferred note style, and let AI build your study notebook.
        </p>
      </div>

      {/* Main Creation Card */}
      <div className="bg-white paper-card border-2 border-[var(--ink)] p-6 sm:p-10 relative shadow-[8px_10px_0px_#111827]">
        <PaperTape className="absolute -top-4 left-12" />
        <PaperTape className="absolute -top-4 right-12" />

        {/* Visual Pipeline Side Explanation Header */}
        <div className="mb-8 p-4 bg-amber-50/80 border border-amber-300 flex flex-wrap items-center justify-between gap-4 text-xs font-hand text-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--coral)] uppercase">Process Flow:</span>
            <span className="bg-white px-2 py-0.5 border border-slate-300 font-bold">1. YouTube URL</span>
            <HandDrawnArrow className="w-6 h-3" stroke="var(--turquoise)" />
            <span className="bg-teal-50 text-teal-900 px-2 py-0.5 border border-teal-200 font-bold">2. AI Understanding</span>
            <HandDrawnArrow className="w-6 h-3" stroke="var(--coral)" />
            <span className="bg-red-50 text-red-900 px-2 py-0.5 border border-red-200 font-bold">3. Handwritten PDF</span>
          </div>
          <span className="text-[var(--ink-faded)] italic hidden lg:inline">
            Directly ready for print or tablet apps
          </span>
        </div>

        {/* Creation Form */}
        <form onSubmit={submit} className="space-y-8">
          
          {/* Step 1: URL Input */}
          <div className="space-y-2">
            <label className="block">
              <span className="font-serif text-lg font-bold text-[var(--ink)] block">
                01 — Paste YouTube Lecture URL <span className="text-[var(--coral)]">*</span>
              </span>
              <span className="font-sans text-xs text-[var(--ink-soft)] block mb-2">
                Supports lectures, course videos, conference talks & seminars.
              </span>
              <div className="relative">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[var(--bg-paper-darker)]/40 border-2 border-[var(--ink)]/40 px-4 py-3.5 pl-11 text-base text-[var(--ink)] placeholder:text-[var(--ink-faded)]/60 focus:outline-none focus:border-[var(--coral)] focus:bg-white transition-colors"
                  disabled={phase.kind === "working"}
                />
                <span className="absolute left-3.5 top-4 text-slate-500 font-mono text-sm">
                  🔗
                </span>
              </div>
            </label>
          </div>

          {/* Step 2: Subject Optional */}
          <div className="space-y-2">
            <label className="block">
              <span className="font-serif text-base font-bold text-[var(--ink)] block">
                Subject or Class Name <span className="text-xs font-normal text-[var(--ink-faded)]">(optional)</span>
              </span>
              <input
                type="text"
                value={subject}
                maxLength={120}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms, Organic Chemistry II"
                className="w-full sm:w-2/3 bg-[var(--bg-paper-darker)]/40 border border-[var(--ink)]/30 px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faded)]/60 focus:outline-none focus:border-[var(--coral)] focus:bg-white transition-colors"
                disabled={phase.kind === "working"}
              />
            </label>
          </div>

          {/* Step 3: Choose Note Style with 3 Visual Preview Cards */}
          <div className="space-y-4 pt-2">
            <div>
              <span className="font-serif text-lg font-bold text-[var(--ink)] block">
                02 — Choose Note Style
              </span>
              <span className="font-sans text-xs text-[var(--ink-soft)] block">
                Select how structured and concise you want your handwritten pages.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STYLES.map((s) => {
                const isSelected = style === s.value;
                return (
                  <div
                    key={s.value}
                    onClick={() => phase.kind !== "working" && setStyle(s.value)}
                    className={`cursor-pointer p-4 border-2 transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-50 border-[var(--coral)] shadow-[4px_4px_0px_#e64a3b] -translate-y-1"
                        : "bg-white border-[var(--ink)]/30 hover:border-[var(--ink)] hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`font-hand text-xs font-bold px-2 py-0.5 border ${
                            isSelected
                              ? "bg-[var(--coral)] text-white border-[var(--coral)]"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {s.label}
                        </span>
                        <span className="font-sans text-[11px] text-teal-800 font-semibold">
                          {s.badge}
                        </span>
                      </div>

                      <h3 className="font-serif text-base font-bold text-[var(--ink)] mb-1">
                        {s.title}
                      </h3>
                      <p className="font-sans text-xs text-[var(--ink-soft)] leading-snug mb-3">
                        {s.description}
                      </p>

                      {/* Small Handwritten Preview Snippet Card */}
                      <div className="p-2.5 bg-white border border-slate-200 font-hand text-xs text-slate-700 space-y-1 rounded-xs">
                        <span className="text-[10px] text-amber-800 font-bold block uppercase font-sans">Preview Structure:</span>
                        <p className="whitespace-pre-line text-[11px] leading-tight text-slate-800">
                          {s.previewSnippet}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between font-hand text-xs">
                      <span>{isSelected ? "✓ Selected" : "Click to select"}</span>
                      <span className="text-[var(--coral)]">RoughPage ✎</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary CTA Submit Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-[var(--ink)]/15">
            <button
              type="submit"
              disabled={phase.kind === "working" || !url.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-8 py-4 text-lg font-medium shadow-[4px_5px_0px_#111827] transition-all hover:-translate-y-1 active:translate-y-0 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PenIcon className="w-5 h-5" />
              <span>{phase.kind === "working" ? "Writing Notes..." : "Generate Notes ✎"}</span>
            </button>

            <span className="font-hand text-xs text-[var(--ink-faded)] italic">
              * Note generation takes ~30–60 seconds for lecture analysis & stroke rendering.
            </span>
          </div>

        </form>
      </div>

      {/* Animated Feedback & Progress Region */}
      <div className="mt-8">
        {phase.kind === "working" && (
          <PenProgress percent={phase.percent} label={phase.message} />
        )}

        {phase.kind === "error" && (
          <div role="alert" className="paper-card p-6 bg-red-50 border-2 border-red-300 max-w-xl mx-auto space-y-2">
            <div className="flex items-center gap-2 font-serif text-lg font-bold text-[var(--coral)]">
              <span>✗ Generation Issue</span>
            </div>
            <p className="font-sans text-sm text-slate-800">{phase.message}</p>
            <button
              onClick={() => setPhase({ kind: "idle" })}
              className="mt-2 text-xs font-semibold text-[var(--coral)] underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {phase.kind === "saved" && (
          <div className="paper-card p-8 bg-amber-50 border-2 border-[var(--ink)] max-w-xl mx-auto space-y-4 text-center shadow-[6px_8px_0px_#111827]">
            <PaperTape className="mx-auto" />
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto text-teal-800 font-hand text-3xl font-bold">
              ✓
            </div>
            <h3 className="font-serif text-2xl font-bold text-[var(--ink)]">
              Notebook Ready & Filed!
            </h3>
            <p className="font-hand text-lg text-slate-800">
              "{phase.notebook.title}" · {phase.notebook.page_count} page{phase.notebook.page_count === 1 ? "" : "s"}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => download(phase.notebook.id)}
                disabled={downloading}
                className="inline-flex items-center gap-2 bg-[var(--coral)] text-white px-5 py-2.5 font-medium text-sm shadow-[2px_3px_0px_#111827] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <PdfIcon className="w-4 h-4" />
                <span>{downloading ? "Preparing PDF..." : "Download PDF Notebook"}</span>
              </button>

              <Link
                href="/library"
                className="inline-flex items-center gap-1.5 bg-white border border-[var(--ink)] text-[var(--ink)] px-5 py-2.5 font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                <span>View in Library</span>
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}