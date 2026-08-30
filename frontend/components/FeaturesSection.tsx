"use client";

import { PaperTape } from "@/components/Sketch";

const FEATURE_FRAGMENTS = [
  {
    title: "AI Lecture Understanding",
    tag: "Core Engine",
    accent: "var(--turquoise)",
    content: (
      <div className="font-hand text-sm space-y-1.5 text-slate-800">
        <p>• Transcribes & analyzes full audio transcript</p>
        <p>• Filters out filler words, banter & tangents</p>
        <p className="bg-teal-100/70 p-1 border border-teal-200 text-teal-900 font-bold">
          ➔ Retains high-signal academic concepts only
        </p>
      </div>
    ),
  },
  {
    title: "Automatic Definitions & Glossary",
    tag: "Terminology",
    accent: "var(--coral)",
    content: (
      <div className="font-hand text-sm space-y-2">
        <div className="border-l-3 border-[var(--coral)] pl-2 py-0.5">
          <strong className="text-[var(--coral)] font-bold">Polymorphism:</strong> The ability of a single interface to represent different underlying data types.
        </div>
        <div className="border-l-3 border-[var(--turquoise)] pl-2 py-0.5">
          <strong className="text-[var(--turquoise)] font-bold">Recursion:</strong> A function calling itself until a base condition is met.
        </div>
      </div>
    ),
  },
  {
    title: "Comparison Tables",
    tag: "Structured Synthesis",
    accent: "var(--coral)",
    content: (
      <div className="font-hand text-xs border border-slate-300 rounded overflow-hidden">
        <div className="grid grid-cols-3 bg-amber-100/80 p-1.5 font-bold border-b border-slate-300">
          <span>Feature</span>
          <span>Stack</span>
          <span>Queue</span>
        </div>
        <div className="grid grid-cols-3 p-1.5 border-b border-slate-200">
          <span>Order</span>
          <span>LIFO</span>
          <span>FIFO</span>
        </div>
        <div className="grid grid-cols-3 p-1.5 bg-slate-50">
          <span>Primary Op</span>
          <span>Push/Pop</span>
          <span>Enqueue/Dequeue</span>
        </div>
      </div>
    ),
  },
  {
    title: "Algorithms & Flowcharts",
    tag: "Visual Logic",
    accent: "var(--turquoise)",
    content: (
      <div className="font-hand text-xs space-y-1 text-center">
        <div className="inline-block bg-amber-100 border border-amber-300 px-3 py-1 font-bold">
          Start (Input Array)
        </div>
        <div className="text-[var(--turquoise)] font-bold">↓</div>
        <div className="inline-block bg-teal-50 border border-teal-300 px-3 py-1">
          Partition around Pivot element
        </div>
        <div className="text-[var(--turquoise)] font-bold">↓</div>
        <div className="inline-block bg-red-50 border border-red-300 px-3 py-1 font-bold text-[var(--coral)]">
          Recursive QuickSort Sub-arrays
        </div>
      </div>
    ),
  },
  {
    title: "Handwritten Formulas",
    tag: "Math & Science",
    accent: "var(--coral)",
    content: (
      <div className="p-3 bg-amber-50/90 border border-amber-200 text-center font-hand space-y-1">
        <span className="text-xs text-amber-800 block uppercase font-bold">Quadratic Equation</span>
        <div className="text-lg font-bold text-slate-900">
          x = (-b ± √(b² - 4ac)) / (2a)
        </div>
        <span className="text-xs text-[var(--coral)] italic block">★ Highlighted for quick revision</span>
      </div>
    ),
  },
  {
    title: "Code Snippets & Syntax",
    tag: "Computer Science",
    accent: "var(--turquoise)",
    content: (
      <div className="bg-slate-900 text-teal-300 font-mono text-xs p-3 rounded border border-slate-700 space-y-1">
        <span className="text-slate-500">// Binary Search Implementation</span>
        <p><span className="text-amber-400">def</span> binary_search(arr, target):</p>
        <p className="pl-3">low, high = 0, len(arr) - 1</p>
        <p className="pl-3"><span className="text-amber-400">while</span> low &lt;= high:</p>
        <p className="pl-6 text-teal-200">mid = (low + high) // 2</p>
      </div>
    ),
  },
  {
    title: "Video Frame Callouts",
    tag: "Visual Context",
    accent: "var(--coral)",
    content: (
      <div className="flex items-center gap-3 bg-slate-100 p-2 border border-slate-300">
        <div className="w-16 h-12 bg-slate-800 rounded flex items-center justify-center text-[10px] text-slate-300 font-mono">
          [Frame 14:02]
        </div>
        <div className="font-hand text-xs text-slate-800">
          <p className="font-bold">Prof. Strang on Blackboard:</p>
          <p className="text-[var(--coral)]">"Column space C(A) contains all linear combinations."</p>
        </div>
      </div>
    ),
  },
  {
    title: "Export to PDF",
    tag: "Downloadable Document",
    accent: "var(--turquoise)",
    content: (
      <div className="p-3 bg-teal-50 border border-teal-200 text-center font-hand space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900 bg-teal-100 px-2 py-0.5 border border-teal-300">
          📄 High-Resolution Vector PDF
        </div>
        <p className="text-xs text-slate-700">
          Print directly onto A4 or view on iPad / tablet with perfect stroke fidelity.
        </p>
      </div>
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-16 md:py-24 bg-[var(--bg-paper)] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="font-hand text-sm uppercase tracking-widest text-[var(--turquoise)] font-bold">
            Built for Serious Studying
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--ink)]">
            Every Fragment of a Real Notebook
          </h2>
          <p className="font-sans text-base text-[var(--ink-soft)]">
            RoughPage doesn't just output plain Markdown. It renders authentic handwritten fragments pinned to your note sheets.
          </p>
        </div>

        {/* Feature Notebook Fragments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURE_FRAGMENTS.map((item, i) => (
            <div
              key={item.title}
              className={`paper-card p-5 relative border-2 border-[var(--ink)] flex flex-col justify-between ${
                i % 2 === 0 ? "tilt-left" : "tilt-right"
              } hover:-translate-y-1 transition-transform`}
            >
              <PaperTape className="absolute -top-3 left-6" />

              <div>
                <div className="flex items-center justify-between mb-3 border-b border-dashed border-[var(--ink)]/20 pb-2">
                  <span className="font-hand text-xs font-bold px-2 py-0.5 bg-amber-100 border border-amber-200" style={{ color: item.accent }}>
                    {item.tag}
                  </span>
                  <span className="font-hand text-xs text-[var(--ink-faded)]">#0{i + 1}</span>
                </div>

                <h3 className="font-serif text-lg font-bold text-[var(--ink)] mb-3">
                  {item.title}
                </h3>

                {item.content}
              </div>

              <div className="mt-4 pt-2 flex items-center justify-between text-[11px] font-hand text-[var(--ink-faded)]">
                <span>Handwritten Renderer</span>
                <span className="text-[var(--coral)]">✓ Verified</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
