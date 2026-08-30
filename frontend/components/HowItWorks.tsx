"use client";

import { HandDrawnArrow, PaperTape } from "@/components/Sketch";

const STEPS = [
  {
    number: "01",
    title: "Paste a lecture",
    description: "Drop a YouTube lecture link or transcript URL into RoughPage.",
    accent: "var(--coral)",
    bgColor: "bg-red-50/80",
    borderColor: "border-red-200",
    illustration: (
      <svg className="w-16 h-16 text-[var(--coral)]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <path d="M26 24L42 32L26 40V24Z" fill="currentColor" />
        <path d="M12 40C20 44 44 44 52 40" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "AI understands it",
    description: "AI extracts core concepts, definitions, formulas, and structural flow.",
    accent: "var(--turquoise)",
    bgColor: "bg-teal-50/80",
    borderColor: "border-teal-200",
    illustration: (
      <svg className="w-16 h-16 text-[var(--turquoise)]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M32 12V6M32 58V52M12 32H6M58 32H52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 28L32 34L38 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "RoughPage structures knowledge",
    description: "Synthesizes comparison tables, algorithm diagrams, and emphasized callouts.",
    accent: "var(--coral)",
    bgColor: "bg-amber-50/80",
    borderColor: "border-amber-200",
    illustration: (
      <svg className="w-16 h-16 text-amber-700" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="12" y="12" width="40" height="40" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <path d="M12 26H52M28 26V52" stroke="currentColor" strokeWidth="2" />
        <path d="M18 19H34M18 34H22M34 34H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Get handwritten notes",
    description: "Generates authentic ruled paper study notes ready to download as PDF.",
    accent: "var(--turquoise)",
    bgColor: "bg-blue-50/80",
    borderColor: "border-blue-200",
    illustration: (
      <svg className="w-16 h-16 text-blue-700" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M14 10H42L50 18V54H14V10Z" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <path d="M42 10V18H50" stroke="currentColor" strokeWidth="2" />
        <path d="M20 24H38M20 32H38M20 40H32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M36 42L46 32L50 36L40 46L34 46L36 42Z" fill="var(--coral)" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-[var(--bg-paper-darker)]/40 border-y border-[var(--ink)]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="font-hand text-sm uppercase tracking-widest text-[var(--coral)] font-bold">
            Simple 4-Step Process
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--ink)]">
            How RoughPage Works
          </h2>
          <p className="font-sans text-base text-[var(--ink-soft)]">
            From a raw video URL to clean, organized handwritten study notes in seconds.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className={`paper-card p-6 relative flex flex-col justify-between border-2 border-[var(--ink)] ${
                index % 2 === 0 ? "tilt-left" : "tilt-right"
              } hover:-translate-y-1 transition-transform`}
            >
              <PaperTape className="absolute -top-3 left-8" />

              <div>
                {/* Step Number & Illustration */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-hand text-3xl font-bold text-[var(--ink)] bg-amber-100 px-2 py-0.5 border border-amber-200">
                    {step.number}
                  </span>
                  <div className={`p-2 rounded border ${step.borderColor} ${step.bgColor}`}>
                    {step.illustration}
                  </div>
                </div>

                {/* Step Title & Description */}
                <h3 className="font-serif text-xl font-bold text-[var(--ink)] mb-2">
                  {step.title}
                </h3>
                <p className="font-sans text-sm text-[var(--ink-soft)] leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Bottom annotation */}
              <div className="mt-6 pt-3 border-t border-dashed border-[var(--ink)]/15 flex items-center justify-between font-hand text-xs text-[var(--ink-faded)]">
                <span>Step {step.number} of 04</span>
                <span style={{ color: step.accent }} className="font-bold">
                  RoughPage ✎
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Floating Connective Line for Desktop */}
        <div className="hidden lg:flex items-center justify-center mt-12 gap-2 text-[var(--ink-faded)]">
          <span className="font-hand text-sm">YouTube Link</span>
          <HandDrawnArrow className="w-10 h-4" stroke="var(--coral)" />
          <span className="font-hand text-sm text-[var(--turquoise)] font-bold">AI Analysis</span>
          <HandDrawnArrow className="w-10 h-4" stroke="var(--turquoise)" />
          <span className="font-hand text-sm text-[var(--coral)] font-bold">Handwritten PDF</span>
        </div>

      </div>
    </section>
  );
}
