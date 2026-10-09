"""
gemini_provider.py
==================
Google Gemini implementation using the official `google-genai` SDK.
Supports native Pydantic structured output validation.
"""

from __future__ import annotations

import logging
import os
from typing import Optional, Type, TypeVar
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.services.ai.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class GeminiProvider(BaseLLMProvider):
    """
    LLM provider backed by Google Gemini via google-genai SDK.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self._api_key = (
            api_key
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or ""
        ).strip()

        if not self._api_key:
            raise ValueError(
                "Gemini API key not found. Please set GEMINI_API_KEY or GOOGLE_API_KEY in your environment/.env."
            )

        self._model_name = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self._client = genai.Client(api_key=self._api_key)

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> T:
        """
        Uses Gemini's native structured outputs with response_schema=response_model.
        """
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_model,
            temperature=temperature,
            system_instruction=system_prompt if system_prompt else None,
        )

        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=config,
            )

            # In google-genai, response.text holds the JSON string
            raw_text = response.text or ""
            return response_model.model_validate_json(raw_text)

        except Exception as e:
            logger.error(f"[GeminiProvider] Structured generation failed with model {self._model_name}: {e}")
            raise

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Generates plain text response."""
        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_prompt if system_prompt else None,
        )

        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=config,
            )
            return (response.text or "").strip()

        except Exception as e:
            logger.error(f"[GeminiProvider] Text generation failed with model {self._model_name}: {e}")
            raise
