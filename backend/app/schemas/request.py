"""
request.py
==========
What the API accepts.

The one rule worth stating up front: every request that produces a notebook
names EXACTLY ONE source. Accepting a `url` and a `text` together and quietly
preferring one is the kind of API that costs somebody an afternoon, so it is a
validation error instead.
"""

from typing import Literal, Self

from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.schemas.notebook import NotebookDocument, NoteStyle


class TranscriptRequest(BaseModel):
    """POST /transcript — fetch and clean a YouTube transcript, nothing more."""

    url: HttpUrl


# ─────────────────────────────────────────────
# Notebook generation
# ─────────────────────────────────────────────


class GenerateRequest(BaseModel):
    """
    POST /generate and /generate/stream — a lecture in, a NotebookDocument out.

    `text` exists so the endpoint is testable and usable without YouTube at all:
    paste a transcript, a lecture handout, or your own notes and the same
    pipeline runs. It is also the only way in when a video has captions
    disabled, which is common enough to be the first thing anyone hits.
    """

    url: HttpUrl | None = Field(
        default=None,
        description="A YouTube URL. Its transcript is fetched and cleaned.",
    )
    text: str | None = Field(
        default=None,
        description="Raw transcript text, used as-is. Mutually exclusive with `url`.",
    )

    style: NoteStyle = Field(
        default=NoteStyle.DETAILED,
        description="detailed | topper | last_minute — steers the AI, not the renderer.",
    )
    subject: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _exactly_one_source(self) -> Self:
        if (self.url is None) == (self.text is None):
            raise ValueError("provide exactly one of `url` or `text`")
        return self


# ─────────────────────────────────────────────
# PDF export
# ─────────────────────────────────────────────


class ExportRequest(BaseModel):
    """
    POST /export — one call, a PDF back.

    Three ways in, exactly one per request:

      url       generate from a YouTube lecture, then print.  The automated path.
      text      generate from text, then print.
      document  print a NotebookDocument you already have.  This is the one that
                makes the endpoint useful in a loop: generate once, then re-export
                with different options without paying for the AI again.

    It does NOT inherit from GenerateRequest. Inheritance would put `document`
    alongside two fields a document makes meaningless, and the validator below
    would have to special-case its own base class.
    """

    url: HttpUrl | None = None
    text: str | None = None
    document: NotebookDocument | None = Field(
        default=None,
        description="A NotebookDocument to print directly, skipping the AI entirely.",
    )

    style: NoteStyle = NoteStyle.DETAILED
    subject: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=200)

    break_on_topic: bool = Field(
        default=True,
        description=(
            "Start each topic group on a fresh page. Off packs pages tighter at "
            "the cost of topics running into each other mid-sheet."
        ),
    )
    filename: str | None = Field(
        default=None,
        max_length=120,
        description="Download filename. Sanitised; defaults to the notebook title.",
    )
    disposition: Literal["attachment", "inline"] = Field(
        default="attachment",
        description="`inline` renders in the browser's PDF viewer instead of downloading.",
    )

    @model_validator(mode="after")
    def _exactly_one_source(self) -> Self:
        given = [f for f in ("url", "text", "document") if getattr(self, f) is not None]
        if len(given) != 1:
            raise ValueError(
                "provide exactly one of `url`, `text` or `document` "
                f"(got {len(given)}: {', '.join(given) or 'none'})"
            )
        return self
