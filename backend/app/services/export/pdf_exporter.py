"""
pdf_exporter.py
===============
NotebookDocument → PDF bytes, by driving the renderer's own CLI.

WHY A SUBPROCESS AND NOT A PORT OF THE LAYOUT CODE. The pagination, the ruled-line
grid, the rough.js drawing and the font handling all need real browser layout —
they measure elements at CONTENT_W in a hidden container and snap every height to
the 32px rule pitch. Reimplementing any part of that in Python would create a
second layout implementation that silently drifts from the one the preview page
shows, which is the exact failure the renderer's design goes out of its way to
avoid. So this module does no layout thinking at all. It hands the document to
`scripts/render-pdf.ts` and reports what came back.

INVOKED AS `node node_modules/tsx/dist/cli.mjs …`, NOT `npm run render`. On Windows
npm is a `.cmd` shim, which needs `shell=True`, which means every path is subject
to shell quoting — and a Windows temp path contains spaces (`C:\\Users\\…\\AppData\\
Local\\Temp\\…`) roughly always. Resolving tsx's entry point and calling node
directly keeps argv a real list on every platform.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


class ExportError(Exception):
    """A failure specific to printing. Carries the CLI's own output when there is any."""

    code = "export_failed"
    http_status = 500

    def __init__(self, detail: str, *, output: str = "", code: str | None = None,
                 http_status: int | None = None):
        super().__init__(detail)
        self.detail = detail
        self.output = output
        if code:
            self.code = code
        if http_status:
            self.http_status = http_status


# ─────────────────────────────────────────────
# Is the renderer usable at all?
# ─────────────────────────────────────────────


@dataclass(frozen=True)
class RendererStatus:
    ok: bool
    tsx_cli: Path | None
    notes: list[str] = field(default_factory=list)


def renderer_status() -> RendererStatus:
    """
    Check the renderer checkout without running anything.

    Each of these produces a completely different subprocess failure — a missing
    node_modules gives "Cannot find module", a missing directory gives ENOENT from
    the spawn itself — and all of them mean the same thing to the operator: the
    renderer is not installed where the API expects it.
    """
    settings = get_settings()
    root = settings.renderer_dir
    notes: list[str] = []

    if not root.is_dir():
        return RendererStatus(False, None, [f"renderer_dir does not exist: {root}"])

    if not (root / "package.json").is_file():
        notes.append(f"no package.json in {root} — is renderer_dir pointing at the right place?")

    if not (root / "scripts" / "render-pdf.ts").is_file():
        notes.append("scripts/render-pdf.ts is missing")

    tsx = root / "node_modules" / "tsx" / "dist" / "cli.mjs"
    if not tsx.is_file():
        notes.append(f"tsx not installed — run `npm install` in {root}")
        tsx = None  # type: ignore[assignment]

    if shutil.which(settings.node_bin) is None:
        notes.append(f"`{settings.node_bin}` is not on PATH")

    return RendererStatus(ok=not notes, tsx_cli=tsx, notes=notes)


# ─────────────────────────────────────────────
# Concurrency
# ─────────────────────────────────────────────

_semaphore: asyncio.Semaphore | None = None


def _gate() -> asyncio.Semaphore:
    """
    One semaphore per process, created lazily.

    Not a module-level `asyncio.Semaphore(n)`: constructing one at import time
    binds it to whatever event loop happens to be current then, which under
    uvicorn's reloader is not the loop that serves requests.
    """
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(get_settings().export_concurrency)
    return _semaphore


# ─────────────────────────────────────────────
# Reading the CLI's report
# ─────────────────────────────────────────────


@dataclass(frozen=True)
class ExportResult:
    pdf: bytes
    pages: int | None
    fonts: list[str]
    content_hash: str | None
    warnings: list[str]
    duration_s: float
    stdout: str


_PAGES_RE = re.compile(r"^\s*pages\s+(\d+)", re.MULTILINE)
_FONTS_RE = re.compile(r"^\s*fonts\s+(.+)$", re.MULTILINE)
_HASH_RE = re.compile(r"^\s*content hash\s+([0-9a-f]{64})", re.MULTILINE)


def _parse_report(stdout: str) -> tuple[int | None, list[str], str | None]:
    """
    Lift the summary the CLI already prints out of its stdout.

    Scraping stdout is not elegant, and the alternative — teaching the CLI a
    `--json` mode — would mean two output formats to keep in step for the sake of
    three numbers that are, by design, printed for a human to read. These three
    are worth surfacing because they are the ones that answer real questions:
    page count (did a sliver page appear?), fonts (did a system font sneak in?),
    and the content hash (is this render identical to the last one?).
    """
    pages_m = _PAGES_RE.search(stdout)
    fonts_m = _FONTS_RE.search(stdout)
    hash_m = _HASH_RE.search(stdout)

    pages = int(pages_m.group(1)) if pages_m else None
    fonts = [f.strip() for f in fonts_m.group(1).split(",") if f.strip()] if fonts_m else []
    return pages, fonts, (hash_m.group(1) if hash_m else None)


def _collect_warnings(output: str) -> list[str]:
    """The CLI's own `layout warning —` lines, so they can reach the HTTP client."""
    return [
        line.split("layout warning —", 1)[1].strip()
        for line in output.splitlines()
        if "layout warning —" in line
    ]


# ─────────────────────────────────────────────
# Killing the whole tree
# ─────────────────────────────────────────────


def _kill_tree_sync(proc: subprocess.Popen) -> None:
    """Kill the CLI *and everything it started*."""
    if proc.poll() is not None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                capture_output=True,
                check=False,
                timeout=15,
            )
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Could not kill the export process tree: {e!r}")
        try:
            proc.kill()
        except Exception:
            pass


def _run_subprocess_sync(argv: list[str], cwd: str, timeout_s: float) -> tuple[int, str]:
    proc = subprocess.Popen(
        argv,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    try:
        out, _ = proc.communicate(timeout=timeout_s)
        return proc.returncode or 0, out or ""
    except subprocess.TimeoutExpired:
        _kill_tree_sync(proc)
        raise ExportError(
            f"The render did not finish within {timeout_s}s. "
            "A cold export builds the Next app and boots Chrome first; set "
            "RENDERER_URL to an already-running renderer to skip that.",
            code="export_timeout",
            http_status=504,
        ) from None
    except Exception:
        _kill_tree_sync(proc)
        raise


def safe_filename(name: str | None, fallback: str = "notebook") -> str:
    """
    A filename safe to put in a Content-Disposition header and on any filesystem.

    Both halves matter: `..` and separators are a path-traversal vector when the
    caller controls the string, and a raw `"` or newline in a header value is
    header injection. Non-ASCII is folded rather than percent-encoded because the
    goal is a sane download name, not fidelity to the notebook's title.
    """
    stem = (name or "").strip()
    stem = re.sub(r"\.pdf$", "", stem, flags=re.IGNORECASE)
    stem = stem.encode("ascii", "ignore").decode("ascii")
    stem = re.sub(r"[^A-Za-z0-9 ._-]+", "-", stem).strip(" .-_")
    stem = re.sub(r"-{2,}", "-", stem)
    return f"{(stem or fallback)[:80]}.pdf"


async def export_pdf(document: dict, *, break_on_topic: bool = True) -> ExportResult:
    """
    Render `document` and return the PDF bytes.

    Args:
        document:       A NotebookDocument as a plain dict (model_dump(mode="json")).
        break_on_topic: Passed to the renderer as --no-topic-break when False.

    Raises:
        ExportError — the renderer is not installed, the render timed out, or the
                      CLI exited non-zero. Its stderr/stdout travels along.
    """
    settings = get_settings()
    status = renderer_status()
    if not status.ok or status.tsx_cli is None:
        raise ExportError(
            "The PDF renderer is not ready: " + "; ".join(status.notes),
            code="renderer_unavailable",
            http_status=503,
        )

    root = settings.renderer_dir

    # A temp DIRECTORY, not two NamedTemporaryFiles: on Windows a file kept open
    # here cannot be reopened by the child process for writing.
    workdir = Path(tempfile.mkdtemp(prefix="roughpage-export-"))
    doc_path = workdir / "notebook.json"
    pdf_path = workdir / "notebook.pdf"

    argv = [
        settings.node_bin,
        str(status.tsx_cli),
        str(root / "scripts" / "render-pdf.ts"),
        str(doc_path),
        str(pdf_path),
        "--timeout",
        str(settings.export_timeout_s * 1000),
    ]
    if not break_on_topic:
        argv.append("--no-topic-break")
    if settings.renderer_url:
        argv += ["--url", settings.renderer_url]

    started = time.monotonic()

    try:
        doc_path.write_text(json.dumps(document), encoding="utf-8")

        # Serialised: see Settings.export_concurrency. The wait happens INSIDE the
        # try so the temp dir is still cleaned up if the request is cancelled here.
        async with _gate():
            logger.info(
                "Export: rendering %s → PDF%s",
                doc_path.name,
                f" via {settings.renderer_url}" if settings.renderer_url else " (own server)",
            )

            returncode, output = await asyncio.to_thread(
                _run_subprocess_sync, argv, str(root), settings.export_timeout_s
            )

        if returncode != 0:
            hint = ""
            if settings.renderer_url:
                hint = (
                    f"\nRENDERER_URL is set to {settings.renderer_url} — if that server "
                    "is not running, this is why."
                )
            raise ExportError(
                f"The renderer exited with code {returncode}.{hint}",
                output=_tail(output),
                code="renderer_failed",
                http_status=502,
            )

        if not pdf_path.is_file():
            raise ExportError(
                "The renderer reported success but wrote no PDF.",
                output=_tail(output),
            )

        pdf = pdf_path.read_bytes()
        if not pdf.startswith(b"%PDF"):
            raise ExportError(
                f"The output file is not a PDF (starts with {pdf[:8]!r}).",
                output=_tail(output),
            )

        pages, fonts, content_hash = _parse_report(output)
        for line in output.splitlines():
            if "render-pdf:" in line:
                logger.info(line.strip())

        return ExportResult(
            pdf=pdf,
            pages=pages,
            fonts=fonts,
            content_hash=content_hash,
            warnings=_collect_warnings(output),
            duration_s=round(time.monotonic() - started, 2),
            stdout=output,
        )

    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _tail(output: str, lines: int = 40) -> str:
    """The end of the CLI's output — where the actual error is."""
    kept = output.strip().splitlines()[-lines:]
    return "\n".join(kept)
