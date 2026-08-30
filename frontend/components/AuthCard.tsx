"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { PaperTape, PenIcon, NotebookIcon } from "@/components/Sketch";

export default function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Account created! Check your inbox to confirm, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/library");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      
      {/* Centered Stationery Auth Card */}
      <div className="max-w-md w-full relative">
        
        {/* Taped Top Accent */}
        <PaperTape className="absolute -top-4 left-1/2 -translate-x-1/2 z-20" />

        {/* Paper Container */}
        <div className="bg-white paper-card border-2 border-[var(--ink)] p-8 sm:p-10 shadow-[8px_10px_0px_#111827] relative z-10">
          
          {/* Header Branding */}
          <div className="text-center space-y-2 mb-8">
            <Link href="/" className="inline-block">
              <span className="font-hand text-4xl font-bold text-[var(--ink)] block hover:text-[var(--coral)] transition-colors">
                RoughPage
              </span>
            </Link>
            <span className="font-serif text-2xl font-bold text-[var(--ink)] block">
              {mode === "sign-in" ? "Welcome back" : "Create your notebook"}
            </span>
            <p className="font-sans text-xs text-[var(--ink-soft)]">
              {mode === "sign-in"
                ? "Sign in to access your handwritten study notes library."
                : "Sign up to start transforming lecture videos into study PDFs."}
            </p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={submit}>
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)] font-sans">
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-[var(--bg-paper-darker)]/40 border-2 border-[var(--ink)]/30 px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faded)]/60 focus:outline-none focus:border-[var(--coral)] focus:bg-white transition-colors"
                disabled={busy}
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)] font-sans">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--bg-paper-darker)]/40 border-2 border-[var(--ink)]/30 px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faded)]/60 focus:outline-none focus:border-[var(--coral)] focus:bg-white transition-colors"
                disabled={busy}
              />
            </div>

            {/* Notice Message */}
            {notice && (
              <div role="status" className="p-3 bg-teal-50 border border-teal-200 text-xs font-hand text-teal-900">
                ✓ {notice}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs font-hand text-[var(--coral)] font-bold">
                ✗ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-[var(--coral)] hover:bg-[#d43a2c] text-white py-3.5 px-6 font-medium text-sm sm:text-base shadow-[3px_4px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer disabled:opacity-60"
            >
              <PenIcon className="w-4 h-4" />
              <span>
                {busy
                  ? "Processing..."
                  : mode === "sign-in"
                  ? "Sign In To Library →"
                  : "Create Account →"}
              </span>
            </button>
          </form>

          {/* Bottom Switcher */}
          <div className="mt-8 pt-4 border-t border-dashed border-[var(--ink)]/20 text-center font-sans text-xs text-[var(--ink-soft)]">
            {mode === "sign-in" ? (
              <p>
                Don't have a notebook account?{" "}
                <Link href="/sign-up" className="font-bold text-[var(--coral)] underline hover:text-[#d43a2c]">
                  Sign up here
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <Link href="/sign-in" className="font-bold text-[var(--coral)] underline hover:text-[#d43a2c]">
                  Sign in here
                </Link>
              </p>
            )}
          </div>

        </div>

        {/* Small Decorative Notebook Icon Card floating below */}
        <div className="mt-4 flex items-center justify-center gap-2 font-hand text-xs text-[var(--ink-faded)]">
          <NotebookIcon className="w-4 h-4 text-[var(--turquoise)]" />
          <span>Your lectures, organized into handwritten PDFs</span>
        </div>

      </div>

    </div>
  );
}