"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { NotebookIcon, PenIcon } from "@/components/Sketch";

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      setEmail(data?.user?.email ?? null);
      if (!data?.user) setEmail(null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: string, session: any) => {
        setEmail(session?.user?.email ?? null);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function signOut() {
    await getSupabase().auth.signOut();
    setEmail(null);
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-paper)]/95 backdrop-blur-xs border-b border-[var(--ink)]/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav className="flex items-center justify-between" aria-label="Main Navigation">
          {/* Logo & Tagline */}
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-hand text-3xl font-bold tracking-tight text-[var(--ink)] group-hover:text-[var(--coral)] transition-colors">
              RoughPage
            </span>
            <span className="hidden md:inline-block text-xs font-sans text-[var(--ink-faded)] border-l border-[var(--ink)]/20 pl-2">
              AI Handwritten Notes
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 text-sm font-sans font-medium text-[var(--ink-soft)]">
            <Link
              href="/"
              className={`hover:text-[var(--coral)] transition-colors ${
                pathname === "/" ? "text-[var(--coral)] font-semibold" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/library"
              className={`flex items-center gap-1.5 hover:text-[var(--coral)] transition-colors ${
                pathname === "/library" ? "text-[var(--coral)] font-semibold" : ""
              }`}
            >
              <NotebookIcon className="w-4 h-4" />
              <span>My Notebooks</span>
            </Link>
            <Link
              href="/#how-it-works"
              className="hover:text-[var(--coral)] transition-colors"
            >
              How It Works
            </Link>
          </div>

          {/* Right Action / Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/generate"
              className="flex items-center gap-2 bg-[var(--coral)] hover:bg-[#d43a2c] text-white px-4 py-2 text-sm font-medium rounded-none shadow-[2px_3px_0px_#111827] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer"
            >
              <PenIcon className="w-4 h-4" />
              <span>Create Notes</span>
            </Link>

            {email ? (
              <div className="flex items-center gap-3 border-l border-[var(--ink)]/15 pl-3">
                <span className="font-hand text-sm text-[var(--ink)] bg-amber-100 px-2 py-0.5 border border-amber-200" title={email}>
                  {email.split("@")[0]}
                </span>
                <button
                  onClick={signOut}
                  className="font-sans text-xs text-[var(--ink-faded)] hover:text-[var(--coral)] underline cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l border-[var(--ink)]/15 pl-3">
                <Link
                  href="/sign-in"
                  className="text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] px-2 py-1 cursor-pointer"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="text-xs font-medium bg-[var(--bg-paper-darker)] border border-[var(--ink)]/20 text-[var(--ink)] px-3 py-1.5 hover:bg-white transition-colors cursor-pointer"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/generate"
              className="bg-[var(--coral)] text-white p-2 shadow-[2px_2px_0px_#111827]"
              title="Create Notes"
            >
              <PenIcon className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 border border-[var(--ink)]/20 bg-white text-[var(--ink)]"
              aria-label="Toggle Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--bg-paper)] border-b border-[var(--ink)]/20 px-4 pt-3 pb-5 space-y-3 shadow-lg">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-[var(--ink)] hover:bg-amber-100/50"
          >
            Home
          </Link>
          <Link
            href="/library"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-[var(--ink)] hover:bg-amber-100/50"
          >
            My Notebooks
          </Link>
          <Link
            href="/generate"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-[var(--coral)] font-semibold hover:bg-amber-100/50"
          >
            + Create My Notes
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-[var(--ink-soft)] hover:bg-amber-100/50"
          >
            How It Works
          </Link>

          <div className="pt-3 border-t border-[var(--ink)]/15 flex items-center justify-between">
            {email ? (
              <>
                <span className="font-hand text-sm text-[var(--ink)] bg-amber-100 px-2 py-1 border border-amber-200">
                  {email}
                </span>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="text-xs text-[var(--coral)] underline cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 border border-[var(--ink)]/20 bg-white text-xs font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 bg-[var(--coral)] text-white text-xs font-medium shadow-[2px_2px_0px_#111827]"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}