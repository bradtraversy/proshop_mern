"""
LiteLLM pre-call hook: routes requests to local Qwen vs Claude Haiku based on
Presidio Analyzer PII detection.

Rules:
  - PII found with score >= HIGH    -> ROUTE_PII_MODEL (local Qwen)
  - No PII spans returned           -> ROUTE_CLEAN_MODEL (Claude Haiku)
  - Ambiguous (low-score spans)     -> ROUTE_DEFAULT_MODEL (local Qwen)
  - Empty text / analyzer error     -> ROUTE_DEFAULT_MODEL (fail-safe to local)

Analyzer always runs for non-empty input; no length-based fast path (a short
string like "ssn 123-45-6789" must not bypass detection).

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

PERSON_NON_LATIN_MIN_SCORE = float(os.getenv("PII_PERSON_NON_LATIN_MIN_SCORE", "0.95"))
LOG_CONTENT = os.getenv("PII_LOG_CONTENT", "0") == "1"


def _has_non_latin(text: str) -> bool:
    for ch in text:
        if ch.isalpha() and not ("a" <= ch.lower() <= "z"):
            return True
    return False

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


def _decide(spans: list, non_latin: bool) -> str:
    # PERSON on en-NLP false-fires on non-Latin scripts (e.g. Cyrillic). Apply
    # an elevated score floor ONLY when the input is non-Latin; for Latin text
    # we trust the analyzer at the normal threshold.
    sensitive = []
    for s in spans:
        etype = s.get("entity_type")
        if etype not in SENSITIVE_ENTITIES:
            continue
        score = s.get("score", 0)
        if etype == "PERSON" and non_latin and score < PERSON_NON_LATIN_MIN_SCORE:
            continue
        sensitive.append(s)
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
            data.setdefault("metadata", {})["pii_routed_to"] = MODEL_DEFAULT
            data["metadata"]["pii_reason"] = "empty_text"
            print(f"[pii_router] empty text -> {MODEL_DEFAULT}")
            return data
        non_latin = _has_non_latin(text)
        try:
            spans = await _analyze(text)
            chosen = _decide(spans, non_latin)
            reason = (
                "no_spans" if not spans
                else f"high_score:{','.join(sorted({s.get('entity_type','?') for s in spans if s.get('score',0)>=SCORE_HIGH}))}"
                if chosen == MODEL_PII
                else f"low_score:{','.join(sorted({s.get('entity_type','?') for s in spans}))}"
            )
        except Exception as e:
            print(f"[pii_router] analyzer error: {e}; fallback to {MODEL_DEFAULT}")
            chosen = MODEL_DEFAULT
            reason = f"analyzer_error:{type(e).__name__}"
        data["model"] = chosen
        meta = data.setdefault("metadata", {})
        meta["pii_routed_to"] = chosen
        meta["pii_reason"] = reason
        log_line = f"[pii_router] routed_to={chosen} reason={reason} len={len(text)}"
        if LOG_CONTENT:
            # Opt-in debug only. Never enable in prod — leaks PII to stdout/log aggregator.
            preview = text[:60].replace("\n", " ")
            log_line += f" text='{preview}'"
        print(log_line)
        return data

    async def async_post_call_success_hook(
        self,
        data: dict,
        user_api_key_dict: UserAPIKeyAuth,
        response,
    ):
        chosen = (data or {}).get("metadata", {}).get("pii_routed_to")
        if chosen:
            try:
                response.model = chosen
            except Exception as e:
                print(f"[pii_router] failed to stamp response.model: {e}")
        return response


pii_router_instance = PIIRouter()
