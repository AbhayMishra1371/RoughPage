import type { Metadata } from 'next';

// Fonts are bundled, NOT loaded from a CDN. Puppeteer must never be waiting on
// a network font when page.pdf() fires — a missed font silently falls back to a
// system face and the entire handwritten effect evaporates.
import '@fontsource/kalam/300.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/jetbrains-mono/400.css';

// Same rule for the maths. `katex/dist/katex.min.css` declares its twenty faces
// with relative `url(fonts/…)`, which the bundler resolves and emits locally — so
// KaTeX's fonts travel with the build exactly like Kalam's. The OS fallback that
// CSS also names (`Times New Roman, serif`) is overridden in globals.css.
import 'katex/dist/katex.min.css';

import './globals.css';

export const metadata: Metadata = {
  title: 'RoughPage Renderer',
  description: 'NotebookDocument → handwritten notebook pages',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
