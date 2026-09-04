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


import logging

logger = logging.getLogger(__name__)


def _make_engine():
    url = get_settings().database_url
    kwargs: dict = {"future": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    try:
        return create_engine(url, **kwargs)
    except Exception as e:
        logger.warning("Failed to initialize database engine for %s: %s", url, e)
        # Fallback to local SQLite if postgres driver is missing
        fallback_url = "sqlite:///roughpage.db"
        logger.info("Falling back to local SQLite: %s", fallback_url)
        return create_engine(fallback_url, connect_args={"check_same_thread": False}, future=True)


engine = _make_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Create tables if they do not exist."""
    settings = get_settings()
    if settings.supabase_url:
        # Supabase REST API is used for persistence; skip local table creation
        logger.info("Supabase configured; skipping local SQLAlchemy create_all.")
        return
    try:
        from app.models import Base
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning("Could not initialize local database tables: %s", e)


def get_db() -> Generator[Session, None, None]:
    """One session per request; always closed, even when the route raises."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

