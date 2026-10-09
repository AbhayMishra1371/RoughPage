"""
test_phase2.py
==============
Verification script for Phase 2: Provider Abstraction Layer & Fallbacks.
"""

import os
import sys
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

from app.services.ai.providers.base import BaseLLMProvider
from app.services.ai.providers.openai_provider import OpenAICompatibleProvider, _clean_json_markdown
from app.services.ai.providers.factory import ResilientLLMProvider, get_llm_provider

load_dotenv()


class SampleOutput(BaseModel):
    summary: str
    key_points: list[str]


class MockSuccessProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "mock_success"

    @property
    def model_name(self) -> str:
        return "mock-model"

    def generate_structured(self, prompt, response_model, system_prompt=None, temperature=0.2):
        return response_model(summary="Mock summary", key_points=["point 1", "point 2"])

    def generate_text(self, prompt, system_prompt=None, temperature=0.2):
        return "Mock text response"


class MockTransientFailProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "mock_transient_fail"

    @property
    def model_name(self) -> str:
        return "mock-fail-model"

    def generate_structured(self, prompt, response_model, system_prompt=None, temperature=0.2):
        raise RuntimeError("Connection error: Gateway Timeout (504)")

    def generate_text(self, prompt, system_prompt=None, temperature=0.2):
        raise RuntimeError("Connection error: Gateway Timeout (504)")


class MockAuthFailProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "mock_auth_fail"

    @property
    def model_name(self) -> str:
        return "mock-auth-fail"

    def generate_structured(self, prompt, response_model, system_prompt=None, temperature=0.2):
        raise RuntimeError("401 Unauthorized: Invalid API key")

    def generate_text(self, prompt, system_prompt=None, temperature=0.2):
        raise RuntimeError("401 Unauthorized: Invalid API key")


def test_base_contract():
    print("--- 1. Testing Base Contract Enforcement ---")
    try:
        BaseLLMProvider()
        assert False, "Should not be able to instantiate abstract BaseLLMProvider"
    except TypeError:
        print("Abstract base class correctly prevents direct instantiation.")


def test_json_cleaner():
    print("\n--- 2. Testing JSON Markdown Stripper ---")
    raw = '```json\n{"summary": "Test", "key_points": ["a", "b"]}\n```'
    cleaned = _clean_json_markdown(raw)
    assert cleaned == '{"summary": "Test", "key_points": ["a", "b"]}'
    print("Markdown stripper works cleanly.")


def test_transient_fallback():
    print("\n--- 3. Testing Fallback on Transient Errors (504, 429) ---")
    failing_primary = MockTransientFailProvider()
    working_fallback = MockSuccessProvider()

    resilient = ResilientLLMProvider(primary=failing_primary, fallback=working_fallback)
    result = resilient.generate_structured(
        prompt="Tell me about AI",
        response_model=SampleOutput,
    )
    assert result.summary == "Mock summary"
    assert len(result.key_points) == 2
    print("Transient error correctly triggered failover to fallback provider.")


def test_no_fallback_on_auth_error():
    print("\n--- 4. Testing No Fallback on Permanent Auth Error (401) ---")
    auth_failing_primary = MockAuthFailProvider()
    fallback = MockSuccessProvider()

    resilient = ResilientLLMProvider(primary=auth_failing_primary, fallback=fallback)
    try:
        resilient.generate_structured(
            prompt="Tell me about AI",
            response_model=SampleOutput,
        )
        assert False, "Should not fallback on 401 Unauthorized!"
    except RuntimeError as e:
        assert "401" in str(e)
        print("Permanent auth error correctly raised immediately without masking.")


def test_provider_initialization():
    print("\n--- 5. Testing Provider Factory & Model Tiering ---")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    nvidia_key = os.getenv("NVIDIA_API_KEY")

    print(f"GEMINI_API_KEY detected: {'YES' if gemini_key else 'NO'}")
    print(f"NVIDIA_API_KEY detected: {'YES' if nvidia_key else 'NO'}")

    analyzer_provider = get_llm_provider(role="analyzer")
    text_provider = get_llm_provider(role="text")

    print(f"Analyzer provider (Smart): {analyzer_provider.provider_name} ({analyzer_provider.model_name})")
    print(f"Text provider (Fast): {text_provider.provider_name} ({text_provider.model_name})")


if __name__ == "__main__":
    test_base_contract()
    test_json_cleaner()
    test_transient_fallback()
    test_no_fallback_on_auth_error()
    test_provider_initialization()
    print("\n>>> ALL PHASE 2 CHECKS PASSED SUCCESSFULLY! <<<")
