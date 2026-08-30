import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Kalam, Playfair_Display } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif-loaded",
});
const kalam = Kalam({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-hand-loaded",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-sans-loaded" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });

export const metadata: Metadata = {
  title: "RoughPage — AI Handwritten Study-Notes Platform",
  description:
    "Paste a YouTube lecture URL and get structured, handwritten-style study notes as a downloadable PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${playfair.variable} ${kalam.variable} ${inter.variable} ${mono.variable} min-h-full font-sans antialiased text-[var(--ink)]`}>
        <div className="relative min-h-screen flex flex-col">
          <NavBar />
          <main className="flex-1 w-full pt-16">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}