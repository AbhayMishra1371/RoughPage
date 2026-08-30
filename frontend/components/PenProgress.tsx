"use client";

import { PaperTape } from "@/components/Sketch";

const PROGRESS_STEPS = [
  { label: "Extracting lecture transcript", triggerPercent: 10 },
  { label: "Understanding concepts & key terms", triggerPercent: 30 },
  { label: "Organizing knowledge structure", triggerPercent: 50 },
  { label: "Designing notebook page layout", triggerPercent: 70 },
  { label: "Writing handwritten notes & drawing formulas", triggerPercent: 85 },
  { label: "Preparing final vector PDF document", triggerPercent: 95 },
];

export default function PenProgress({
  percent = 0,
  label = "Processing your lecture...",
}: {
  percent?: number;
  label?: string;
}) {
  return (
    <div className="bg-white notebook-ruled border-2 border-[var(--ink)] p-8 sm:p-10 relative shadow-[8px_10px_0px_#111827] max-w-2xl mx-auto my-8">
      <PaperTape className="absolute -top-4 left-1/2 -translate-x-1/2" />

      <div className="pl-6 sm:pl-8 space-y-6">
        
        {/* Animated Pen Writing Header */}
        <div className="flex items-center justify-between border-b-2 border-red-300 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">✎</span>
            <div>
              <h3 className="font-hand text-2xl font-bold text-[var(--ink)]">
                Writing Your Study Notebook...
              </h3>
              <p className="font-hand text-xs text-[var(--coral)] font-bold">
                {label}
              </p>
            </div>
          </div>
          <span className="font-hand text-2xl font-bold text-[var(--turquoise)]">
            {Math.round(percent)}%
          </span>
        </div>

        {/* Progress Bar Ruled Line */}
        <div className="space-y-1">
          <div className="h-4 w-full bg-amber-100 border border-amber-300 overflow-hidden relative p-0.5">
            <div
              className="h-full bg-[var(--coral)] transition-all duration-300"
              style={{ width: `${Math.max(5, percent)}%` }}
            />
          </div>
          <div className="flex justify-between font-hand text-xs text-[var(--ink-faded)]">
            <span>0%</span>
            <span>Notebook In Creation</span>
            <span>100%</span>
          </div>
        </div>

        {/* Step-by-Step Checklist */}
        <div className="space-y-3 font-hand text-sm sm:text-base">
          {PROGRESS_STEPS.map((step, idx) => {
            const isDone = percent >= step.triggerPercent + 10;
            const isCurrent = percent >= step.triggerPercent && percent < step.triggerPercent + 10;

            return (
              <div
                key={step.label}
                className={`flex items-center justify-between p-2 rounded transition-colors ${
                  isDone
                    ? "bg-teal-50 text-teal-900 font-bold border border-teal-200"
                    : isCurrent
                    ? "bg-amber-100/90 text-amber-950 font-bold border border-amber-300 animate-pulse"
                    : "text-slate-400 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border">
                    {isDone ? "✓" : isCurrent ? "✎" : "○"}
                  </span>
                  <span>{step.label}</span>
                </div>
                <span className="text-xs font-mono">
                  {isDone ? "DONE" : isCurrent ? "WRITING..." : "WAITING"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-dashed border-slate-300 font-hand text-xs text-[var(--ink-faded)] text-center">
          "AI extracts knowledge while the renderer draws authentic handwritten strokes."
        </div>

      </div>
    </div>
  );
}