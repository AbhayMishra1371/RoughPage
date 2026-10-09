"""
openai_provider.py
==================
OpenAI-compatible provider supporting NVIDIA NIM, Groq, and standard OpenAI endpoints.
Serves as the primary or secondary/fallback LLM provider.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional, Type, TypeVar
from openai import OpenAI
from pydantic import BaseModel

from app.services.ai.providers.base import BaseLLMProvider

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


def _clean_json_markdown(text: str) -> str:
    """Strips markdown code fences and extracts raw JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[-1].strip().startswith("```"):
            cleaned = "\n".join(lines[1:-1]).strip()
        else:
            cleaned = "\n".join(lines[1:]).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]

    # Remove trailing commas before } or ]
    cleaned = re.sub(r",\s*([\]}])", r"\1", cleaned)
    return cleaned


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Generic provider for any OpenAI-compatible HTTP API.
    Used for NVIDIA NIM, Groq, or OpenAI fallback.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        provider_name: str = "openai_compatible",
        timeout: float = 20.0,
    ):
        self._provider_name = provider_name
        self._api_key = api_key or os.getenv("OPENAI_API_KEY") or ""
        self._base_url = base_url
        self._model_name = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        if not self._api_key:
            raise ValueError(f"[{provider_name}] API key is required but was not provided or found in environment.")

        self._client = OpenAI(
            base_url=self._base_url,
            api_key=self._api_key,
            timeout=timeout,
            max_retries=0,
        )

    @property
    def provider_name(self) -> str:
        return self._provider_name

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
        Requests JSON response and parses into the given Pydantic model.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Append schema requirement to prompt to guide OpenAI-compatible models
        schema_hint = f"\n\nYou MUST respond with valid JSON matching this schema:\n{json.dumps(response_model.model_json_schema(), indent=2)}"
        messages.append({"role": "user", "content": prompt + schema_hint})

        try:
            response = self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            raw_content = response.choices[0].message.content or "{}"
            cleaned = _clean_json_markdown(raw_content)
            return response_model.model_validate_json(cleaned)

        except Exception as e:
            logger.error(f"[{self._provider_name}] Structured generation failed with model {self._model_name}: {e}")
            raise

    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Generates plain text."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=temperature,
            )
            return (response.choices[0].message.content or "").strip()

        except Exception as e:
            logger.error(f"[{self._provider_name}] Text generation failed with model {self._model_name}: {e}")
            raise
