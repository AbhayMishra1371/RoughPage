import LandingHero from "@/components/LandingHero";
import HowItWorks from "@/components/HowItWorks";
import FeaturesSection from "@/components/FeaturesSection";
import AiNotebookSection from "@/components/AiNotebookSection";
import Link from "next/link";
import { PenIcon } from "@/components/Sketch";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Redesigned Hero */}
      <LandingHero />

      {/* 4-Step How It Works */}
      <HowItWorks />

      {/* AI → Notebook Pipeline Explanation */}
      <AiNotebookSection />

      {/* Handwritten Notebook Fragment Features */}
      <FeaturesSection />

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-[var(--bg-paper-darker)] border-t border-[var(--ink)]/15 text-center relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <span className="font-hand text-sm font-bold text-[var(--coral)] uppercase tracking-wider block">
            Start Learning Faster Today
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--ink)]">
            Ready to turn your next lecture into handwritten study notes?
          </h2>
          <p className="font-sans text-base text-[var(--ink-soft)] max-w-xl mx-auto">
            Paste any YouTube video URL. RoughPage structures the knowledge and creates a realistic PDF notebook for you.
          </p>

          <div className="pt-4 flex justify-center">
            <Link
              href="/generate"
              className="inline-flex items-center gap-3 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-8 py-4 text-lg font-medium shadow-[4px_5px_0px_#111827] transition-all hover:-translate-y-1 active:translate-y-0 active:shadow-none cursor-pointer"
            >
              <PenIcon className="w-5 h-5" />
              <span>Create My Notes Now</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stationery Footer */}
      <footer className="py-8 bg-[var(--bg-paper)] border-t border-[var(--ink)]/10 text-center font-sans text-xs text-[var(--ink-faded)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-hand text-lg font-bold text-[var(--ink)]">RoughPage</span>
            <span>— AI Handwritten Study Notes</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-[var(--ink)]">Home</Link>
            <Link href="/generate" className="hover:text-[var(--ink)]">Create Notes</Link>
            <Link href="/library" className="hover:text-[var(--ink)]">My Notebooks</Link>
            <Link href="/sign-in" className="hover:text-[var(--ink)]">Sign In</Link>
          </div>
          <p>© {new Date().getFullYear()} RoughPage. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}