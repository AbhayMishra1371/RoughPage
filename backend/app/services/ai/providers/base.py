"""
base.py
=======
Abstract base class for all LLM providers in the RoughPage AI specialist pipeline.
Decouples LangGraph nodes from vendor-specific SDK details.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseLLMProvider(ABC):
    """
    Standard interface that every LLM provider (Gemini, OpenAI, Groq, NVIDIA) must implement.
    Guarantees structured Pydantic output support for specialists and planner.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider, e.g. 'gemini', 'openai', 'groq', 'nvidia'."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Specific model being used, e.g. 'gemini-2.5-flash'."""
        ...

    @abstractmethod
    def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> T:
        """
        Sends a prompt and returns an instance of the requested Pydantic response_model.
        Must enforce strict JSON schema validation.
        """
        ...

    @abstractmethod
    def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """
        Sends a prompt and returns raw string response.
        """
        ...
