"""
config.py
=========
Everything about this deployment that is not a hard-coded fact about RoughPage.

Why a settings object at all, for four values: two of them are FILESYSTEM PATHS
that differ between a dev checkout and a container, and one is a list of browser
origins. Reading those from os.getenv() at each use site is how you end up with
the export endpoint looking in the wrong directory on the one machine you cannot
attach a debugger to.

`.env` LIVES AT THE REPO ROOT, not in backend/. The project doc says otherwise;
the file on disk wins. ai_service.py's bare load_dotenv() only finds it because
uvicorn happens to be started from backend/ and python-dotenv walks upward — so
the path is resolved explicitly here instead of relying on the current directory.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py → backend/app → backend → <repo root>
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Read from the environment, or the repo-root .env, with these defaults."""

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── The renderer ──────────────────────────────────────────────────────────

    renderer_dir: Path = Field(default=REPO_ROOT / "renderer")
    """
    Where the Next.js renderer lives. The export endpoint runs its PDF CLI as a
    subprocess from here, so this must be the directory holding package.json and
    node_modules — not the repo root.
    """

    renderer_url: str | None = Field(default=None)
    """
    An ALREADY-RUNNING renderer to print from, e.g. http://localhost:3210.

    Left unset, every export spawns its own `next start` (and a production build
    the first time), which is correct and self-contained but costs tens of
    seconds. Point this at a running `next dev` during development and an export
    goes from ~40s to ~5s. Do not set it in production: a dev server's output is
    not what `next build` produces, and this whole renderer exists to make the
    preview and the PDF the same thing.
    """

    node_bin: str = Field(default="node")
    """Node executable. A bare name is resolved on PATH by the OS."""

    export_timeout_s: int = Field(default=300)
    """
    Wall-clock ceiling for one PDF export.

    Generous on purpose: a cold export builds the Next app, boots a server, and
    launches Chrome before it draws anything. The CLI has its own 60s ceiling on
    the browser handshake, so this is the outer backstop for the whole pipeline
    rather than the thing that normally fires.
    """

    export_concurrency: int = Field(default=1, ge=1)
    """
    How many exports may run at once. ONE, deliberately.

    Each export is a Next server plus a headless Chrome at deviceScaleFactor 2.
    Three concurrent requests is three Chromes, and the failure mode is not a
    slow response — it is the machine swapping and every request timing out
    together. Raise it only on a box you have measured.
    """

    # ── Persistence & auth ────────────────────────────────────────────────────

    database_url: str = Field(
        default=f"sqlite:///{(REPO_ROOT / 'backend' / 'roughpage.db').as_posix()}"
    )
    """Where notebook metadata lives when SQLite fallback is used."""

    supabase_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("supabase_url", "next_public_supabase_url"),
    )
    """
    e.g. https://abcdefgh.supabase.co. Used for Auth JWKS, Supabase Storage,
    and the Supabase PostgREST REST API.
    """

    supabase_anon_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("supabase_anon_key", "next_public_supabase_anon_key"),
    )
    """Supabase Anon/Public API key, required for calling Supabase REST API."""

    supabase_service_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("supabase_service_key", "supabase_service_role_key"),
    )
    """
    Service-role key — bypasses row-level security. SERVER-SIDE ONLY; it must
    never reach the frontend bundle. Needed to upload PDFs into the private
    bucket and to mint signed download URLs.
    """

    storage_bucket: str = Field(default="notebook-pdfs")
    """Private bucket holding generated PDFs, keyed <user_id>/<notebook_id>.pdf."""

    # ── Input limits ──────────────────────────────────────────────────────────

    min_transcript_chars: int = Field(default=200)
    """
    Below this, refuse rather than spend a Groq call.

    A transcript this short cannot produce a notebook worth paginating, and the
    common cause is not a short lecture — it is a video whose captions are
    disabled, which yields a handful of characters or nothing at all.
    """

    max_transcript_chars: int = Field(default=400_000)
    """
    Above this, refuse. The chunker will happily split a 400k-character
    transcript into ~100 chunks and then make ~100 sequential Groq calls, which
    is a request that cannot finish inside any sane timeout and burns the API
    quota on the way to failing.
    """

    # ── HTTP ──────────────────────────────────────────────────────────────────

    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3210",  # the renderer's configured preview port
            "http://127.0.0.1:3210",
            "http://localhost:3000",  # `next dev` default, for a bare checkout
            "http://127.0.0.1:3000",
        ]
    )
    """
    Browser origins allowed to call this API.

    An explicit list, never `["*"]`: the preview page sends a POST that spends
    real Groq quota, and a wildcard means any page the user happens to have open
    can spend it for them.
    """

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        """Accept `CORS_ORIGINS=http://a,http://b` from a .env file."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("renderer_dir")
    @classmethod
    def _absolute(cls, v: Path) -> Path:
        """A relative RENDERER_DIR would resolve against the launch directory."""
        return v if v.is_absolute() else (REPO_ROOT / v).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached, so the .env is read once per process rather than per request."""
    return Settings()
