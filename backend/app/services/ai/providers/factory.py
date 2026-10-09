"""
factory.py
==========
Provider factory and resilient execution wrapper.
Configures role-based model specialization:
- Smart roles (Analyzer, Visual, Page Planner): NVIDIA DeepSeek V4.1 Flash
- Fast roles (Text, Formula, Comparison): Configurable fast model (e.g. Gemini Flash-Lite)
- Automatic bi-directional fallback (NVIDIA -> Gemini and Gemini -> NVIDIA)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional, Type, TypeVar
from dotenv import load_dotenv
from pydantic import BaseModel

from app.config import REPO_ROOT
from app.services.ai.providers.base import BaseLLMProvider
from app.services.ai.providers.gemini_provider import GeminiProvider
from app.services.ai.providers.openai_provider import OpenAICompatibleProvider

# Ensure repo-root .env is loaded
load_dotenv(REPO_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

# Default models per tier
DEFAULT_SMART_PROVIDER = "nvidia"
DEFAULT_SMART_MODEL = "deepseek-ai/deepseek-v4.1-flash"

DEFAULT_FAST_PROVIDER = "gemini"
DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite"

DEFAULT_GEMINI_SMART = "gemini-3.5-flash"
DEFAULT_GEMINI_FAST = "gemini-3.5-flash-lite"


def _is_transient_error(err: Exception) -> bool:
    """
    Checks if an exception is transient (timeout, rate limit, server 5xx, network drops)
    and should trigger fallback, as opposed to permanent errors (401 Bad API Key, 400 Bad Request).
    """
    msg = str(err).lower()

    # Never fallback on authentication or bad request errors
    if any(code in msg for code in ("401", "unauthorized", "invalid_api_key", "forbidden", "403")):
        return False

    transient_indicators = (
        "timeout",
        "timed out",
        "429",
        "rate limit",
        "quota",
        "resource exhausted",
        "500",
        "502",
        "503",
        "504",
        "gateway",
        "connection error",
        "connection reset",
        "server error",
    )
    return any(ind in msg for ind in transient_indicators)


class ResilientLLMProvider(BaseLLMProvider):
    """
    Wraps a primary provider with an optional secondary fallback provider.
    Fails over ONLY on transient errors (timeouts, rate limits, 5xx),
    preventing blind retries on authentication or client validation errors.
    """

    def __init__(
        self,
        primary: BaseLLMProvider,
        fallback: Optional[BaseLLMProvider] = None,
    ):
        self._primary = primary
        self._fallback = fallback

    @property
    def provider_name(self) -> str:
        return f"{self._primary.provider_name}_resilient"

    @property
    def model_name(self) -> str:
        return self._primary.model_name

    def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> T:
        try:
            return self._primary.generate_structured(
                prompt=prompt,
                response_model=response_model,
                system_prompt=system_prompt,
                temperature=temperature,
            )
        except Exception as e:
            if not self._fallback or not _is_transient_error(e):
                raise

            logger.warning(
                f"[ResilientLLMProvider] Primary ({self._primary.provider_name}/{self._primary.model_name}) "
                f"hit transient error: {e}. Switching to fallback ({self._fallback.provider_name}/{self._fallback.model_name})..."
            )
            return self._fallback.generate_structured(
                prompt=prompt,
                response_model=response_model,
                system_prompt=system_prompt,
                temperature=temperature,
            )

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        try:
            return self._primary.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
            )
        except Exception as e:
            if not self._fallback or not _is_transient_error(e):
                raise

            logger.warning(
                f"[ResilientLLMProvider] Primary ({self._primary.provider_name}) hit transient error: {e}. "
                f"Switching to fallback ({self._fallback.provider_name})..."
            )
            return self._fallback.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
            )


def _build_single_provider(
    provider_type: str,
    model: Optional[str] = None,
) -> BaseLLMProvider:
    """Instantiates a single raw provider based on type name."""
    p_type = provider_type.strip().lower()

    if p_type == "gemini":
        return GeminiProvider(model=model)

    elif p_type in ("nvidia", "nim"):
        base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        api_key = os.getenv("NVIDIA_API_KEY", "")
        model_name = model or os.getenv("NVIDIA_MODEL", DEFAULT_SMART_MODEL)
        return OpenAICompatibleProvider(
            base_url=base_url,
            api_key=api_key,
            model=model_name,
            provider_name="nvidia",
        )

    elif p_type == "groq":
        base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        api_key = os.getenv("GROQ_API_KEY", "")
        model_name = model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        return OpenAICompatibleProvider(
            base_url=base_url,
            api_key=api_key,
            model=model_name,
            provider_name="groq",
        )

    elif p_type == "openai":
        return OpenAICompatibleProvider(
            model=model or "gpt-4o-mini",
            provider_name="openai",
        )

    else:
        raise ValueError(f"Unknown provider type '{provider_type}'. Supported: nvidia, gemini, groq, openai")


def get_llm_provider(role: str = "general") -> BaseLLMProvider:
    """
    Factory function allocating model tiers to pipeline roles:

    SMART ROLES (NVIDIA DeepSeek V4.1 Flash):
      - 'analyzer': Topic identification & specialist routing
      - 'visual': Diagram/structure layout
      - 'planner': Final NotebookDocument synthesis

    FAST ROLES (Separately configured fast model, e.g. Gemini Flash-Lite):
      - 'text': Chunk-level concept & definition summarization
      - 'formula': Equation & variable extraction
      - 'comparison': Tabular relationships & timelines
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    nvidia_key = os.getenv("NVIDIA_API_KEY")

    is_smart_role = role in ("analyzer", "visual", "planner")

    if is_smart_role:
        # Smart Tier: Default to NVIDIA DeepSeek V4.1 Flash
        provider_name = os.getenv("SMART_PROVIDER", DEFAULT_SMART_PROVIDER)
        model_name = os.getenv("SMART_MODEL", DEFAULT_SMART_MODEL)
        # Fallback to Gemini if configured
        fallback_name = "gemini" if gemini_key and provider_name != "gemini" else None
        fallback_model = os.getenv("GEMINI_MODEL_SMART", DEFAULT_GEMINI_SMART)
    else:
        # Fast Tier: Default to Gemini Flash-Lite (or NVIDIA if Gemini key is missing)
        default_fast_p = "gemini" if gemini_key else "nvidia"
        provider_name = os.getenv("FAST_PROVIDER", default_fast_p)
        model_name = os.getenv("FAST_MODEL", DEFAULT_FAST_MODEL if provider_name == "gemini" else DEFAULT_SMART_MODEL)
        # Fallback to the other provider
        if provider_name == "gemini" and nvidia_key:
            fallback_name = "nvidia"
            fallback_model = DEFAULT_SMART_MODEL
        elif provider_name == "nvidia" and gemini_key:
            fallback_name = "gemini"
            fallback_model = DEFAULT_FAST_MODEL
        else:
            fallback_name = None
            fallback_model = None

    primary = _build_single_provider(provider_name, model=model_name)

    fallback: Optional[BaseLLMProvider] = None
    if fallback_name:
        try:
            fallback = _build_single_provider(fallback_name, model=fallback_model)
        except Exception as e:
            logger.debug(f"Fallback provider '{fallback_name}' could not be initialized: {e}")

    return ResilientLLMProvider(primary=primary, fallback=fallback)
