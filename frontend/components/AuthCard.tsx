"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { PaperTape, PenIcon, NotebookIcon } from "@/components/Sketch";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError) {
        setError(urlError);
      }
    }
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      const supabase = getSupabase();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign in with Google.";
      if (msg.includes("Unsupported provider") || msg.includes("not enabled")) {
        setError("Google Sign-In is not enabled in your Supabase project. Please enable Google under Authentication → Providers in your Supabase Dashboard.");
      } else {
        setError(msg);
      }
      setGoogleBusy(false);
    }
  }

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

  const isFormDisabled = busy || googleBusy;

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      
      {/* Centered Stationery Auth Card */}
      <div className="max-w-md w-full relative">
        
        {/* Taped Top Accent */}
        <PaperTape className="absolute -top-4 left-1/2 -translate-x-1/2 z-20" />

        {/* Paper Container */}
        <div className="bg-white paper-card border-2 border-[var(--ink)] p-8 sm:p-10 shadow-[8px_10px_0px_#111827] relative z-10">
          
          {/* Header Branding */}
          <div className="text-center space-y-2 mb-6">
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

          {/* Notice Message */}
          {notice && (
            <div role="status" className="mb-4 p-3 bg-teal-50 border border-teal-200 text-xs font-hand text-teal-900">
              ✓ {notice}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-xs font-hand text-[var(--coral)] font-bold">
              ✗ {error}
            </div>
          )}

          {/* Google Sign In / Sign Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isFormDisabled}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-[var(--ink)] border-2 border-[var(--ink)] py-3 px-6 font-medium text-sm sm:text-base shadow-[3px_4px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>
              {googleBusy
                ? "Connecting to Google..."
                : mode === "sign-in"
                ? "Sign in with Google"
                : "Sign up with Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-[var(--ink)]/30" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-sans text-[var(--ink-soft)] font-semibold tracking-wider">
                Or continue with email
              </span>
            </div>
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
                disabled={isFormDisabled}
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
                disabled={isFormDisabled}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isFormDisabled}
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