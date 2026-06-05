"""
LiteLLM pre-call hook: routes requests to local Qwen vs Claude Haiku based on
Presidio Analyzer PII detection.

Rules:
  - PII found with score >= HIGH    -> ROUTE_PII_MODEL (local Qwen)
  - No PII spans returned           -> ROUTE_CLEAN_MODEL (Claude Haiku)
  - Ambiguous (low-score spans)     -> ROUTE_DEFAULT_MODEL (local Qwen)
  - Analyzer error/unreachable      -> ROUTE_DEFAULT_MODEL (fail-safe to local)

Activated only when client sends `model: smart-router`. Other model names
pass through untouched.
"""
import os
import httpx
from typing import Optional, Literal
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy.proxy_server import UserAPIKeyAuth, DualCache

ANALYZER_URL = os.getenv("PRESIDIO_ANALYZER_URL", "http://presidio-analyzer:3000")
SCORE_HIGH = float(os.getenv("PII_SCORE_THRESHOLD_HIGH", "0.6"))
MODEL_PII = os.getenv("ROUTE_PII_MODEL", "qwen-local")
MODEL_CLEAN = os.getenv("ROUTE_CLEAN_MODEL", "claude-haiku")
MODEL_DEFAULT = os.getenv("ROUTE_DEFAULT_MODEL", "qwen-local")
ROUTER_ALIAS = "smart-router"

SENSITIVE_ENTITIES = {
    "CREDIT_CARD", "CRYPTO", "EMAIL_ADDRESS", "IBAN_CODE",
    "IP_ADDRESS", "PERSON", "PHONE_NUMBER", "MEDICAL_LICENSE",
    "US_SSN", "US_BANK_NUMBER", "US_DRIVER_LICENSE", "US_PASSPORT",
    "US_ITIN", "UK_NHS", "UK_NINO", "AU_ABN", "AU_ACN",
    "AU_TFN", "AU_MEDICARE", "IN_PAN", "IN_AADHAAR",
    "IN_VEHICLE_REGISTRATION", "IN_VOTER", "IN_PASSPORT",
    "SG_NRIC_FIN", "ES_NIF", "IT_FISCAL_CODE",
    "IT_DRIVER_LICENSE", "IT_VAT_CODE", "IT_PASSPORT",
    "IT_IDENTITY_CARD", "PL_PESEL",
}


def _extract_text(messages) -> str:
    parts = []
    for m in messages or []:
        c = m.get("content")
        if isinstance(c, str):
            parts.append(c)
        elif isinstance(c, list):
            for chunk in c:
                if isinstance(chunk, dict) and chunk.get("type") == "text":
                    parts.append(chunk.get("text", ""))
    return "\n".join(parts).strip()


async def _analyze(text: str) -> list:
    payload = {"text": text, "language": "en", "score_threshold": 0.3}
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.post(f"{ANALYZER_URL}/analyze", json=payload)
        r.raise_for_status()
        return r.json()


def _decide(spans: list) -> str:
    sensitive = [s for s in spans if s.get("entity_type") in SENSITIVE_ENTITIES]
    if not sensitive:
        return MODEL_CLEAN
    if any(s.get("score", 0) >= SCORE_HIGH for s in sensitive):
        return MODEL_PII
    return MODEL_DEFAULT


class PIIRouter(CustomLogger):
    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: DualCache,
        data: dict,
        call_type: Literal[
            "completion", "text_completion", "embeddings",
            "image_generation", "moderation", "audio_transcription",
        ],
    ) -> Optional[dict]:
        if data.get("model") != ROUTER_ALIAS:
            return data
        text = _extract_text(data.get("messages"))
        if not text:
            data["model"] = MODEL_DEFAULT
            return data
        try:
            spans = await _analyze(text)
            chosen = _decide(spans)
        except Exception as e:
            print(f"[pii_router] analyzer error: {e}; falling back to {MODEL_DEFAULT}")
            chosen = MODEL_DEFAULT
        data["model"] = chosen
        data.setdefault("metadata", {})["pii_routed_to"] = chosen
        return data


pii_router_instance = PIIRouter()
