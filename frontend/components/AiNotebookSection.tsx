"use client";

import { HandDrawnArrow, PaperTape } from "@/components/Sketch";

export default function AiNotebookSection() {
  return (
    <section className="py-16 md:py-24 bg-[var(--bg-paper-darker)]/60 border-t border-[var(--ink)]/15 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="font-hand text-sm uppercase tracking-widest text-[var(--coral)] font-bold">
            Under The Hood
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--ink)]">
            AI + Intelligent Visual Rendering
          </h2>
          <p className="font-sans text-base text-[var(--ink-soft)]">
            RoughPage doesn't just pass text to an LLM. It plans the layout of a physical notebook page before drawing strokes.
          </p>
        </div>

        {/* Transformation Pipeline Flowchart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16 relative">
          
          {/* Step 1: Lecture */}
          <div className="paper-card p-5 border-2 border-[var(--ink)] tilt-left text-center">
            <PaperTape className="absolute -top-3 left-4" />
            <div className="text-xs font-mono font-bold text-red-600 uppercase mb-1">Input</div>
            <h3 className="font-serif text-lg font-bold text-[var(--ink)] mb-2">LECTURE</h3>
            <p className="font-hand text-xs text-[var(--ink-soft)]">
              Raw audio transcript, video frames & timestamp markers.
            </p>
          </div>

          {/* Arrow 1 */}
          <div className="hidden md:flex items-center justify-center -mx-4 z-10">
            <HandDrawnArrow className="w-12 h-6" stroke="var(--turquoise)" />
          </div>

          {/* Step 2: Knowledge Map */}
          <div className="paper-card p-5 border-2 border-[var(--ink)] tilt-right text-center">
            <PaperTape className="absolute -top-3 left-4" />
            <div className="text-xs font-mono font-bold text-teal-600 uppercase mb-1">AI Reasoning</div>
            <h3 className="font-serif text-lg font-bold text-[var(--ink)] mb-2">KNOWLEDGE</h3>
            <p className="font-hand text-xs text-[var(--ink-soft)]">
              Key definitions, formulas, hierarchy & essential exam signals.
            </p>
          </div>

          {/* Arrow 2 */}
          <div className="hidden md:flex items-center justify-center -mx-4 z-10">
            <HandDrawnArrow className="w-12 h-6" stroke="var(--coral)" />
          </div>

          {/* Step 3: Notebook Plan */}
          <div className="paper-card p-5 border-2 border-[var(--ink)] tilt-left text-center">
            <PaperTape className="absolute -top-3 left-4" />
            <div className="text-xs font-mono font-bold text-amber-600 uppercase mb-1">Page Architecture</div>
            <h3 className="font-serif text-lg font-bold text-[var(--ink)] mb-2">NOTEBOOK PLAN</h3>
            <p className="font-hand text-xs text-[var(--ink-soft)]">
              Box allocations, margin sticky placement & column structure.
            </p>
          </div>

          {/* Arrow 3 */}
          <div className="hidden md:flex items-center justify-center -mx-4 z-10">
            <HandDrawnArrow className="w-12 h-6" stroke="var(--turquoise)" />
          </div>

          {/* Step 4: Handwritten Page */}
          <div className="paper-card p-5 border-2 border-[var(--ink)] tilt-right text-center bg-amber-50">
            <PaperTape className="absolute -top-3 left-4" />
            <div className="text-xs font-mono font-bold text-green-700 uppercase mb-1">Output PDF</div>
            <h3 className="font-serif text-lg font-bold text-[var(--ink)] mb-2">HANDWRITTEN PAGE</h3>
            <p className="font-hand text-xs text-[var(--ink-soft)] font-bold">
              Realistic ruled paper PDF with handwritten strokes & annotations.
            </p>
          </div>
        </div>

        {/* Interactive Notebook Composition Showcase */}
        <div className="max-w-4xl mx-auto bg-white notebook-ruled border-2 border-[var(--ink)] p-8 sm:p-12 relative shadow-[10px_12px_0px_#111827]">
          <PaperTape className="absolute -top-4 left-16" />
          <PaperTape className="absolute -top-4 right-16" />

          <div className="pl-8 sm:pl-12 space-y-6">
            <div className="flex flex-wrap items-center justify-between border-b-2 border-red-300 pb-3">
              <div>
                <span className="font-hand text-xs text-[var(--coral)] font-bold uppercase tracking-wider block">
                  AI Architecture Breakdown
                </span>
                <h3 className="font-hand text-3xl font-bold text-[var(--ink)]">
                  Why RoughPage Notes Feel Real
                </h3>
              </div>
              <span className="font-hand text-sm bg-teal-100 border border-teal-300 px-3 py-1 text-teal-900 font-bold">
                ✓ Render Engine v2.4
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              
              {/* Feature 1 */}
              <div className="p-4 bg-amber-50/80 border border-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-hand font-bold text-amber-900 text-base">
                  <span className="text-[var(--coral)]">01.</span>
                  <span>Intelligent Space Allocation</span>
                </div>
                <p className="font-hand text-xs text-slate-700 leading-relaxed">
                  Calculates exact vertical line spacing for headings, bullet points, and multi-line mathematical equations so notes never overlap.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-4 bg-teal-50/80 border border-teal-300 space-y-2">
                <div className="flex items-center gap-2 font-hand font-bold text-teal-900 text-base">
                  <span className="text-[var(--turquoise)]">02.</span>
                  <span>Natural Handwriting Variations</span>
                </div>
                <p className="font-hand text-xs text-slate-700 leading-relaxed">
                  Applies slight rotational jitter, natural line spacing, and varied stroke weights so text doesn't look like a standard computer font.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-4 bg-red-50/80 border border-red-300 space-y-2">
                <div className="flex items-center gap-2 font-hand font-bold text-red-900 text-base">
                  <span className="text-[var(--coral)]">03.</span>
                  <span>Margin Annotations & Sticky Notes</span>
                </div>
                <p className="font-hand text-xs text-slate-700 leading-relaxed">
                  Places important exam warnings, shortcuts, and key formula reminders directly inside the left margin or on sticky notes.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-4 bg-blue-50/80 border border-blue-300 space-y-2">
                <div className="flex items-center gap-2 font-hand font-bold text-blue-900 text-base">
                  <span className="text-blue-800">04.</span>
                  <span>High-Resolution Vector PDF Export</span>
                </div>
                <p className="font-hand text-xs text-slate-700 leading-relaxed">
                  Outputs clean vector paths ready for printing on physical paper or viewing in GoodNotes, Notability, or Apple Books.
                </p>
              </div>

            </div>

            {/* Bottom Signature quote */}
            <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between font-hand text-sm text-[var(--ink-soft)]">
              <span>"An intelligent AI assistant that turns lectures into the handwritten notes you wish you had."</span>
              <span className="text-[var(--coral)] font-bold">RoughPage ✎</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
