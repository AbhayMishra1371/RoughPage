"""
db.py
=====
SQLAlchemy engine, session factory, and the FastAPI dependency that hands out
sessions.

SQLite has one quirk that matters here: its drivers follow the thread that
opened a connection. FastAPI runs sync endpoints in a worker pool and the PDF
background task runs in yet another thread, so `check_same_thread=False` plus a
`StaticPool`-free default pool is required — each thread then checks out its own
connection from the pool rather than sharing one.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def _make_engine():
    url = get_settings().database_url
    kwargs: dict = {"future": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


engine = _make_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """One session per request; always closed, even when the route raises."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
