"use client";

import Link from "next/link";
import { SketchUnderline, HandDrawnArrow, PaperTape } from "@/components/Sketch";

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden py-12 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Column - Editorial Typography & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 bg-amber-100/90 border border-amber-200/80 px-3 py-1.5 tilt-left shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[var(--coral)] animate-pulse" />
              <span className="font-hand text-xs sm:text-sm font-semibold tracking-wide text-[var(--ink)]">
                AI-Powered Handwritten Study Platform
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] leading-[1.15] tracking-tight">
              Turn lectures into{" "}
              <span className="relative inline-block text-[var(--coral)] font-serif italic">
                notes worth keeping.
                <SketchUnderline className="absolute -bottom-2 left-0 h-3 w-full" stroke="var(--coral)" />
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-[var(--ink-soft)] leading-relaxed max-w-xl font-sans">
              RoughPage extracts lecture transcripts, analyzes key concepts, and organizes knowledge into structured, realistic handwritten study notes ready to download as PDF.
            </p>

            {/* CTAs */}
            <div className="pt-4 flex flex-wrap items-center gap-4 sm:gap-6">
              <Link
                href="/generate"
                className="group relative inline-flex items-center gap-3 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-7 py-3.5 text-base sm:text-lg font-medium shadow-[4px_5px_0px_#111827] transition-all hover:-translate-y-1 active:translate-y-0 active:shadow-none cursor-pointer"
              >
                <span>Create My Notes</span>
                <span className="font-hand text-xl group-hover:translate-x-1 transition-transform">✎</span>
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-[var(--ink)] hover:text-[var(--coral)] border-b-2 border-dashed border-[var(--ink)]/30 pb-0.5 transition-colors cursor-pointer"
              >
                <span>See How It Works</span>
                <HandDrawnArrow className="w-6 h-3" stroke="currentColor" />
              </a>
            </div>

            {/* Hand-drawn annotation note */}
            <div className="pt-4 flex items-center gap-3">
              <span className="font-hand text-sm text-[var(--turquoise)] font-bold">★ Note:</span>
              <span className="font-hand text-xs sm:text-sm text-[var(--ink-faded)] italic">
                "Not a generic AI summary — authentic handwritten pages with diagrams, formulas & tables."
              </span>
            </div>
          </div>

          {/* Right Hero Column - Asymmetrical Editorial Visual Collage */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0">
            <div className="relative mx-auto max-w-lg lg:max-w-none">
              
              {/* Paper Card 1: YouTube Video Frame */}
              <div className="absolute -top-6 left-0 z-20 w-64 sm:w-72 bg-slate-900 text-white p-3 border-2 border-[var(--ink)] shadow-[4px_6px_0px_rgba(0,0,0,0.15)] tilt-left">
                <PaperTape className="absolute -top-3 left-6" />
                <div className="relative aspect-video bg-slate-800 rounded flex items-center justify-center border border-slate-700 overflow-hidden group">
                  {/* YouTube Player Mock */}
                  <div className="absolute inset-0 bg-cover bg-center opacity-40 bg-[url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop')]" />
                  <div className="relative z-10 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-xs text-[10px] font-mono px-2 py-0.5 text-slate-300 truncate">
                    MIT 18.06 Linear Algebra Lecture 1
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Extracting Transcript...</span>
                  <span className="text-[var(--turquoise)]">✓ 100%</span>
                </div>
              </div>

              {/* Paper Card 2: AI Processing Circuitry Fragment */}
              <div className="absolute top-24 -right-2 z-30 w-52 sm:w-60 sticky-note-turquoise p-3 tilt-right border border-teal-300">
                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-teal-800 mb-1">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                  <span>AI Knowledge Map</span>
                </div>
                <div className="space-y-1 font-hand text-xs text-teal-900">
                  <p>✓ Key Concept: Vector Spaces</p>
                  <p>✓ Formula: A·x = λ·x</p>
                  <p>✓ Comparison: Rank vs Nullity</p>
                </div>
              </div>

              {/* Central Main Paper Card: Realistic Notebook Page */}
              <div className="relative z-10 w-full sm:w-11/12 ml-auto mt-12 bg-white notebook-ruled border-2 border-[var(--ink)] p-6 sm:p-8 pt-10 shadow-[8px_10px_0px_#111827]">
                <PaperTape className="absolute -top-3 right-12" />
                
                {/* Red Left Margin Line Representation is built into notebook-ruled CSS */}
                
                {/* Handwritten Content */}
                <div className="space-y-4 pl-8 sm:pl-10">
                  {/* Notebook Title */}
                  <div className="border-b-2 border-red-400/50 pb-2">
                    <span className="font-hand text-xs text-[var(--coral)] uppercase tracking-wider block font-bold">
                      Lecture 04 • Study Notes
                    </span>
                    <h2 className="font-hand text-2xl sm:text-3xl font-bold text-[var(--ink)]">
                      Linear Transformations & Matrices
                    </h2>
                  </div>

                  {/* Bullet points handwritten */}
                  <div className="space-y-2 font-hand text-base sm:text-lg text-slate-800 leading-snug">
                    <p className="flex items-start gap-2">
                      <span className="text-[var(--coral)] font-bold">•</span>
                      <span><strong className="highlight-yellow">Definition:</strong> A transformation T: V → W preserves vector addition & scalar multiplication.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-[var(--turquoise)] font-bold">•</span>
                      <span>Matrix representation depends on chosen basis vectors e₁, e₂.</span>
                    </p>
                  </div>

                  {/* Formula Box */}
                  <div className="my-3 p-3 bg-amber-50 border-2 border-dashed border-amber-300 rounded-sm font-hand text-center">
                    <span className="text-xs text-amber-800 block font-sans uppercase font-bold">Key Formula</span>
                    <span className="text-xl font-bold text-[var(--ink)]">T(c·u + v) = c·T(u) + T(v)</span>
                  </div>

                  {/* Hand-drawn diagram snippet */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="font-hand text-xs text-[var(--turquoise)] font-bold bg-teal-50 px-2 py-1 border border-teal-200">
                      [Diagram] Axis Rotation θ
                    </div>
                    <div className="font-hand text-xs text-[var(--coral)] underline">
                      Exported to PDF Page 1
                    </div>
                  </div>
                </div>

                {/* Floating Yellow Sticky Note */}
                <div className="absolute -bottom-6 -left-4 z-40 w-44 sticky-note-yellow p-3 text-slate-900 border border-yellow-300">
                  <span className="font-hand text-xs font-bold text-amber-800 block">Exam Tip 💡</span>
                  <p className="font-hand text-xs text-slate-800">
                    Always check det(A) ≠ 0 before attempting matrix inversion!
                  </p>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}