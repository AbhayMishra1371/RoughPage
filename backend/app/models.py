"""
models.py
=========
The one table this app owns: notebooks.

Deliberately NO users table. Identity comes from Supabase; the JWT's `sub`
claim is stored verbatim as owner_id, which makes authorization a single WHERE
clause and means account deletion on Supabase's side needs no cascade here.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Notebook(Base):
    __tablename__ = "notebooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    """UUID4 hex-free string; also the Storage object name."""

    owner_id: Mapped[str] = mapped_column(String(128), index=True)
    """Supabase auth `sub`. The entire authorization model."""

    title: Mapped[str] = mapped_column(String(300), default="Lecture Notes")
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    style: Mapped[str] = mapped_column(String(32), default="detailed")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    page_count: Mapped[int] = mapped_column(Integer, default=0)

    document_json: Mapped[str] = mapped_column(Text)
    """The full NotebookDocument. Kept so preview/re-render never re-calls the AI."""

    pdf_object_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    """<user_id>/<notebook_id>.pdf inside the storage bucket. Null until rendered."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
