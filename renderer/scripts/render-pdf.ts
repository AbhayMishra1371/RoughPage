/**
 * render-pdf.ts
 * =============
 * NotebookDocument JSON  ->  handwritten-notebook PDF.
 *
 *   npm run render -- fixtures/sample-notebook.json out/sample.pdf
 *   npm run render -- fixtures/live.json out/live.pdf --url http://localhost:3210
 *
 * THE NODE / BROWSER SPLIT, which is the whole reason this file is short:
 * everything that needs real layout — font loading, measurement, pagination,
 * rough.js — happens in the browser, inside <NotebookRenderer>. Node's only jobs
 * are to hand the document over, wait for an HONEST ready signal, print, and
 * check the result. There is no second layout implementation here to drift out of
 * sync with what the preview page shows.
 *
 * WAIT ON THE FLAG, NEVER ON A TIMER. `window.__ROUGHPAGE_READY__` is set only
 * after fonts have loaded, measurement finished, pagination committed, and the
 * DOM has gone quiet for several frames. A `sleep(3000)` in its place is how you
 * get PDFs with half-drawn boxes on a slow machine and no way to reproduce it.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer, { type Browser, type ConsoleMessage } from 'puppeteer';

import { PAGE_H, PAGE_W } from '../lib/geometry';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// ── CLI ─────────────────────────────────────────────────────────────────────

interface Args {
  input: string;
  output: string;
  /** Reuse an already-running server (e.g. `next dev`) instead of spawning one. */
  url?: string;
  breakOnTopic: boolean;
  timeoutMs: number;
  keepOpen: boolean;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const out: Partial<Args> = { breakOnTopic: true, timeoutMs: 60_000, keepOpen: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--no-topic-break') out.breakOnTopic = false;
    else if (a === '--timeout') out.timeoutMs = Number(argv[++i]) || 60_000;
    else if (a === '--keep-open') out.keepOpen = true;
    else if (a.startsWith('-')) fail(`unknown flag ${a}`);
    else positional.push(a);
  }

  if (positional.length === 0) {
    fail(
      'usage: npm run render -- <input.json> [output.pdf] ' +
        '[--url http://localhost:3210] [--no-topic-break] [--timeout ms]',
    );
  }

  return {
    input: resolve(positional[0]),
    output: resolve(positional[1] ?? deriveOutput(positional[0])),
    url: out.url,
    breakOnTopic: out.breakOnTopic!,
    timeoutMs: out.timeoutMs!,
    keepOpen: out.keepOpen!,
  };
}

function deriveOutput(input: string): string {
  const base = input.replace(/\.json$/i, '').split(/[/\\]/).pop() ?? 'notebook';
  return join(ROOT, 'out', `${base}.pdf`);
}

function fail(message: string): never {
  console.error(`render-pdf: ${message}`);
  process.exit(1);
}

// ── Input ───────────────────────────────────────────────────────────────────

/** The shape Node needs: enough to sanity-check, not a second copy of the schema. */
interface RawDoc extends Record<string, unknown> {
  pages: unknown[];
}

/**
 * Reads the document, tolerating a stray log line before the JSON — because the
 * documented way to get real AI output is `test_pipeline.py > live.json`, and a
 * pipeline that prints one line of progress first shouldn't cost you the render.
 */
async function readDocument(path: string): Promise<RawDoc> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    fail(`cannot read ${path}`);
  }

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first < 0 || last <= first) fail(`${path} is not JSON`);
    try {
      doc = JSON.parse(raw.slice(first, last + 1));
      console.warn('render-pdf: input had non-JSON preamble; parsed the embedded object.');
    } catch {
      fail(`${path} is not JSON`);
    }
  }

  if (!doc || typeof doc !== 'object') fail(`${path} is not a JSON object`);
  const d = doc as Record<string, unknown>;
  if (!Array.isArray(d.pages)) {
    fail(`${path} has no "pages" array — is this a NotebookDocument?`);
  }
  return d as RawDoc;
}

// ── Server lifecycle ────────────────────────────────────────────────────────

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => res(typeof addr === 'object' && addr ? addr.port : 3000));
    });
  });
}

/** Newest mtime under `dirs`, ignoring build output and dependencies. */
async function newestMtime(dirs: string[]): Promise<number> {
  let newest = 0;
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        const s = await stat(p).catch(() => null);
        if (s && s.mtimeMs > newest) newest = s.mtimeMs;
      }
    }
  };
  await Promise.all(dirs.map(walk));
  return newest;
}

/**
 * `next start` serves whatever was last built. A build that predates the source
 * would silently produce a perfectly plausible PDF of the OLD renderer — the
 * hardest kind of bug to notice — so the build is refreshed whenever any source
 * file is newer than it.
 */
async function ensureBuild(): Promise<void> {
  const buildId = join(ROOT, '.next', 'BUILD_ID');
  const built = await stat(buildId).catch(() => null);

  if (built) {
    const src = await newestMtime([
      join(ROOT, 'app'),
      join(ROOT, 'components'),
      join(ROOT, 'lib'),
    ]);
    const cfgs = await Promise.all(
      ['next.config.ts', 'next.config.js', 'package.json', 'tsconfig.json'].map((f) =>
        stat(join(ROOT, f)).catch(() => null),
      ),
    );
    const newestCfg = Math.max(0, ...cfgs.map((s) => s?.mtimeMs ?? 0));
    if (Math.max(src, newestCfg) <= built.mtimeMs) return;
    console.log('render-pdf: source is newer than the last build — rebuilding.');
  } else {
    console.log('render-pdf: no production build found — building (first run only).');
  }

  await run(nextBin(), ['build'], 'next build');
}

function nextBin(): string {
  return createRequire(import.meta.url).resolve('next/dist/bin/next');
}

function run(script: string, args: string[], label: string): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('error', rej);
    child.on('exit', (code) =>
      code === 0 ? res() : rej(new Error(`${label} exited with code ${code}`)),
    );
  });
}

interface Server {
  url: string;
  stop: () => void;
}

async function startServer(): Promise<Server> {
  await ensureBuild();

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const log: string[] = [];

  const child: ChildProcess = spawn(
    process.execPath,
    [nextBin(), 'start', '-p', String(port), '-H', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout?.on('data', (b) => log.push(String(b)));
  child.stderr?.on('data', (b) => log.push(String(b)));

  let exited = false;
  child.on('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (exited) {
      throw new Error(`next start exited before becoming ready:\n${log.join('')}`);
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`next start did not become ready in 60s:\n${log.join('')}`);
    }
    try {
      const r = await fetch(`${url}/render`, { redirect: 'manual' });
      if (r.status < 500) break;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }

  console.log(`render-pdf: server ready on ${url}`);
  return { url, stop: () => child.kill() };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Browser ─────────────────────────────────────────────────────────────────

async function launchBrowser(): Promise<Browser> {
  // `--font-render-hinting=none` keeps glyph metrics identical across machines,
  // which is what makes two renders of the same JSON comparable at all.
  const args = ['--font-render-hinting=none'];
  try {
    return await puppeteer.launch({ headless: true, args });
  } catch (e) {
    console.warn(
      `render-pdf: bundled Chromium unavailable (${(e as Error).message.split('\n')[0]}); ` +
        'falling back to system Chrome.',
    );
    return await puppeteer.launch({ headless: true, channel: 'chrome', args });
  }
}

// ── PDF inspection ──────────────────────────────────────────────────────────

/**
 * Page count straight from the PDF, so a trailing sliver page cannot slip
 * through unnoticed. Returns null when the page objects live inside compressed
 * object streams and this cheap scan can't see them — in which case the check is
 * skipped loudly rather than faked.
 */
function countPdfPages(buf: Buffer): number | null {
  const found = buf.toString('latin1').match(/\/Type\s*\/Page(?![sA-Za-z])/g);
  return found && found.length > 0 ? found.length : null;
}

/**
 * Hash of the PDF with its timestamps and file ID blanked out.
 *
 * Chrome stamps /CreationDate, /ModDate and a random /ID into every PDF, so the
 * raw bytes of two identical renders never match and a plain sha256 says nothing
 * about determinism. Blanking those three fields makes the comparison mean what
 * it's supposed to mean: same JSON in, same drawing out.
 */
function contentHash(buf: Buffer): string {
  const normalised = buf
    .toString('latin1')
    .replace(/\/(?:CreationDate|ModDate)\s*\(D:[^)]*\)/g, '')
    .replace(/\/ID\s*\[\s*(?:<[^>]*>\s*)+\]/g, '');
  return createHash('sha256').update(Buffer.from(normalised, 'latin1')).digest('hex');
}

/**
 * Which fonts actually ended up embedded.
 *
 * This check exists because a font substitution is invisible in the output — the
 * page still looks like handwriting — but it is a portability bug: `→` and `★`
 * were once supplied by Segoe Print and Segoe UI Symbol, which do not exist off
 * Windows, so the same JSON rendered differently elsewhere. Finished output
 * should contain Kalam and nothing else. Monospace is tolerated because the
 * `Unsupported` dev placeholder uses it and never appears in a real notebook.
 */
function fontReport(buf: Buffer): { all: string[]; suspicious: string[] } {
  const all = [
    ...new Set(
      (buf.toString('latin1').match(/\/BaseFont\s*\/[A-Za-z0-9+#_-]+/g) ?? []).map((s) =>
        // Strip the six-letter subset tag Chrome prefixes, e.g. "AAAAAA+Kalam".
        s.replace(/^\/BaseFont\s*\//, '').replace(/^[A-Z]{6}\+/, ''),
      ),
    ),
  ].sort();

  const MONOSPACE = /mono|consol|menlo|courier|dejavu|liberation|cascadia/i;
  const suspicious = all.filter((n) => !/^Kalam/i.test(n) && !MONOSPACE.test(n));
  return { all, suspicious };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const doc = await readDocument(args.input);

  const server = args.url ? null : await startServer();
  const baseUrl = args.url ?? server!.url;

  const browser = await launchBrowser();
  const problems: string[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_W, height: PAGE_H, deviceScaleFactor: 2 });

    page.on('console', (m: ConsoleMessage) => {
      const t = m.type();
      if (t === 'error' || t === 'warn') problems.push(`[console.${t}] ${m.text()}`);
    });
    page.on('pageerror', (e: unknown) =>
      problems.push(`[pageerror] ${e instanceof Error ? e.message : String(e)}`),
    );
    // A failed request names the URL; the console equivalent is an anonymous
    // "Failed to load resource: 404" that tells you nothing. This is how a font
    // that didn't ship becomes a one-line diagnosis instead of a mystery.
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`);
    });
    page.on('requestfailed', (r) =>
      problems.push(`[requestfailed] ${r.url()} — ${r.failure()?.errorText}`),
    );

    // Injected BEFORE navigation: a real notebook is far too large for a query
    // string, and an API route would mean server-side state for a one-shot job.
    await page.evaluateOnNewDocument(
      `window.__NOTEBOOK__ = ${JSON.stringify(doc)};
       window.__ROUGHPAGE_OPTS__ = ${JSON.stringify({ breakOnTopic: args.breakOnTopic })};`,
    );

    console.log('render-pdf: loading /render …');
    await page.goto(`${baseUrl}/render`, { waitUntil: 'networkidle0', timeout: args.timeoutMs });

    // Fonts first. Measuring against a fallback font produces a document whose
    // every line wraps in the wrong place — and it looks fine until you compare.
    await page.evaluateHandle('document.fonts.ready');

    try {
      await page.waitForFunction('window.__ROUGHPAGE_READY__ === true', {
        timeout: args.timeoutMs,
        polling: 'raf',
      });
    } catch {
      const phase = await page
        .evaluate(() => ({
          phase: window.__ROUGHPAGE_PHASE__ ?? '(none)',
          papers: document.querySelectorAll('.paper').length,
          error: document.querySelector('pre')?.textContent?.slice(0, 400) ?? null,
        }))
        .catch(() => null);
      throw new Error(
        `the page never signalled ready within ${args.timeoutMs}ms.\n` +
          `  phase: ${phase?.phase}, .paper elements: ${phase?.papers}\n` +
          (phase?.error ? `  page reported: ${phase.error}\n` : '') +
          (problems.length ? `  browser said:\n    ${problems.join('\n    ')}\n` : ''),
      );
    }

    const state = await page.evaluate(() => ({
      pages: window.__ROUGHPAGE_PAGES__ ?? 0,
      warnings: window.__ROUGHPAGE_WARNINGS__ ?? [],
      papers: document.querySelectorAll('.paper').length,
      // If the CSS failed to load, the ruled lines are gone and the PDF is a
      // sheet of blank white — which `printBackground` alone cannot tell you.
      ruled: getComputedStyle(document.querySelector('.paper')!).backgroundImage !== 'none',
      inkChars: (document.querySelector('.page-content')?.textContent ?? '').trim().length,
    }));

    if (state.papers === 0) throw new Error('no pages were rendered.');
    if (!state.ruled) {
      throw new Error('the ruled-paper background is missing — stylesheet did not load.');
    }
    if (state.inkChars === 0) throw new Error('pages rendered but contain no text.');

    for (const w of state.warnings) console.warn(`render-pdf: layout warning — ${w}`);

    await mkdir(dirname(args.output), { recursive: true });
    const pdf = Buffer.from(
      await page.pdf({
        // Explicit, and equal to the `@page` rule in globals.css by construction.
        // When the page box and the paper size disagree by even a pixel, Chrome
        // emits a trailing sliver page.
        width: '210mm',
        height: '297mm',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        // Without this the paper, the ruled lines and the sticky note all vanish.
        printBackground: true,
        preferCSSPageSize: false,
      }),
    );
    await writeFile(args.output, pdf);

    const pdfPages = countPdfPages(pdf);
    const fonts = fontReport(pdf);
    const declared = (doc.metadata as { total_pages?: number } | undefined)?.total_pages;

    console.log('');
    console.log(`  wrote          ${args.output}`);
    console.log(`  size           ${(pdf.length / 1024).toFixed(0)} KB`);
    console.log(`  pages          ${state.papers} (reflowed from ${doc.pages.length} topic groups)`);
    if (declared !== undefined && declared !== state.papers) {
      console.log(`                 metadata.total_pages said ${declared} — ignored, as designed`);
    }
    console.log(`  fonts          ${fonts.all.join(', ')}`);
    console.log(`  content hash   ${contentHash(pdf)}`);

    if (fonts.suspicious.length) {
      console.warn(
        `\nrender-pdf: ${fonts.suspicious.join(', ')} got embedded, which Kalam should have\n` +
          '  covered. Some character fell through to a system font — the PDF will look\n' +
          '  different on a machine that lacks it, and the glyph is printed, not written.\n' +
          '  Find the character and draw it (lib/roughShapes.tsx) or replace it.',
      );
    }

    if (pdfPages === null) {
      console.warn('  page check     skipped — PDF uses compressed object streams');
    } else if (pdfPages !== state.papers) {
      throw new Error(
        `the PDF has ${pdfPages} pages but ${state.papers} were laid out. ` +
          'A trailing sliver page usually means the page box and the paper size disagree.',
      );
    } else {
      console.log(`  page check     ok — PDF contains exactly ${pdfPages}`);
    }

    if (problems.length) {
      console.warn('\nrender-pdf: the browser reported problems during the render:');
      for (const p of problems) console.warn(`  ${p}`);
    }

    if (args.keepOpen) {
      console.log('\nrender-pdf: --keep-open, press Ctrl+C to exit.');
      await new Promise(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
    server?.stop();
  }
}

main().catch((e: unknown) => {
  console.error(`\nrender-pdf: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
