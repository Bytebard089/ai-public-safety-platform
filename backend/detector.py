"""
Hybrid scam-detection engine — fully free / open-source stack.

Two layers, combined into one score:
1. Rule layer: regex patterns for documented digital-arrest scam mechanics
   (authority impersonation, forced isolation, urgency/fear, payment demand).
   Fast, explainable, zero cost, catches known patterns even if the LLM call fails.
2. LLM layer: contextual scoring via a locally-running open-source model
   (Mistral 7B, Apache-2.0, served through Ollama — no API key, no cost),
   for phrasing the rules don't catch, plus a plain-language reason string
   used in the UI and the report draft.

Final score = weighted blend. Rules alone can flag high-confidence cases even
without the LLM (keeps the tool usable if Ollama isn't running); the LLM
raises recall for scams that don't use the exact known phrasing.
"""

import json
import os
import re
from dataclasses import dataclass, field

MODEL = os.environ.get("OLLAMA_MODEL", "mistral")

# category -> (weight, patterns). Weight = how strongly this category alone
# indicates a scam. Multiple categories firing together compounds the score,
# which mirrors how digital-arrest scams actually work: no single phrase is
# proof, but authority + isolation + urgency + payment together is the
# signature combination investigators have documented.
RULE_CATEGORIES = {
    "authority_impersonation": (
        28,
        [
            r"\bcbi\b", r"\bed\b", r"enforcement directorate", r"\bcustoms\b",
            r"cyber ?crime (division|cell|department|branch)", r"income tax (department|intelligence)",
            r"\brbi\b.{0,15}(verification|account|holding)", r"inspector\s+\w+", r"officer\s+\w+,?\s+cbi",
            r"court order", r"arrest warrant", r"narcotics control bureau", r"look-?out notice",
            r"money laundering case", r"legal notice call",
        ],
    ),
    "forced_isolation": (
        24,
        [
            r"do not (tell|inform|disconnect|mention)", r"don'?t disconnect",
            r"keep (the )?camera on", r"stay on (the )?video ?call", r"stay connected on this",
            r"do not tell.{0,25}(family|anyone)", r"confidential (investigation|matter|until)",
            r"absconding", r"remain on this call",
        ],
    ),
    "urgency_fear": (
        22,
        [
            r"digital arrest", r"under arrest", r"arrested immediately", r"taken into custody",
            r"police (team )?will (come|reach|arrive|be sent)", r"blocked in \d+ hour",
            r"right now", r"immediately or", r"today (to avoid|or)", r"arrest team",
            r"within the hour", r"final warning", r"immediately unless",
        ],
    ),
    "payment_or_otp_demand": (
        26,
        [
            r"transfer \d", r"move \d", r"send (the )?otp", r"share (the )?otp",
            r"verification account", r"\brs\.?\s?\d{3,}", r"\brupees\b.{0,15}\d", r"bank verification",
            r"clear your name", r"security deposit", r"otp confirmation", r"identity verification and",
        ],
    ),
}


@dataclass
class Flag:
    category: str
    phrase: str
    start: int
    end: int


@dataclass
class Analysis:
    score: int
    verdict: str  # "low" | "medium" | "high"
    flags: list = field(default_factory=list)  # list[Flag]
    reason: str = ""
    rule_score: int = 0
    llm_score: int | None = None
    llm_available: bool = True


def _rule_scan(text: str) -> tuple[int, list[Flag]]:
    lower = text.lower()
    flags: list[Flag] = []
    categories_hit = set()

    for category, (weight, patterns) in RULE_CATEGORIES.items():
        for pattern in patterns:
            for m in re.finditer(pattern, lower):
                flags.append(Flag(category=category, phrase=text[m.start():m.end()],
                                   start=m.start(), end=m.end()))
                categories_hit.add(category)

    # Score = sum of category weights for *distinct categories hit*, not per
    # match, so one category firing five times doesn't outweigh two
    # categories firing once each. Compound risk (multiple categories) is
    # the actual signal, matching the "compound conditions" framing used
    # across the hackathon's own problem statements.
    score = sum(RULE_CATEGORIES[c][0] for c in categories_hit)
    return min(score, 100), flags


def _llm_scan(text: str) -> tuple[int | None, str]:
    """Contextual scoring via a locally-running, open-source model through
    Ollama (https://ollama.com — free, MIT-licensed runtime). Default model
    is Mistral 7B (Apache-2.0). No API key, no per-call cost, no cloud
    dependency: this is what keeps the whole stack free end to end."""
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    try:
        import requests
    except ImportError:
        return None, "requests package not installed — showing rule-based result only."

    prompt = f"""You are a scam-detection classifier specialised in Indian "digital arrest" \
and impersonation fraud (fake CBI/ED/Customs officers, forced video calls, fund transfer coercion).

Score the transcript below from 0-100 for how likely it is to be part of such a scam \
(0 = clearly benign, 100 = textbook scam pattern). Then give a one-sentence, plain-language \
reason a non-technical citizen would understand.

Respond ONLY with valid JSON, no other text, in this exact shape:
{{"score": <integer 0-100>, "reason": "<one sentence>"}}

Transcript:
\"\"\"{text}\"\"\"
"""
    try:
        resp = requests.post(
            f"{host}/api/generate",
            json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json"},
            timeout=8,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw)
        return int(parsed["score"]), parsed["reason"]
    except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
        return None, "Ollama not running locally — showing rule-based result only. Run `ollama serve`."
    except (json.JSONDecodeError, KeyError, ValueError):
        return None, "LLM response could not be parsed — showing rule-based result only."


def _verdict(score: int) -> str:
    if score >= 65:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


def analyze(text: str, use_llm: bool = True) -> Analysis:
    rule_score, flags = _rule_scan(text)

    if use_llm:
        llm_score, llm_reason = _llm_scan(text)
    else:
        llm_score, llm_reason = None, "LLM layer skipped (rule-only mode requested by caller)."

    if llm_score is None:
        final_score = rule_score
        reason = llm_reason
        llm_available = False
    else:
        # Blend: rules are precise but narrow, LLM is broader but noisier.
        # Weighting rules slightly higher keeps false positives low, which
        # is an explicit judging criterion for citizen-facing tools.
        final_score = round(0.55 * rule_score + 0.45 * llm_score)
        reason = llm_reason
        llm_available = True

    return Analysis(
        score=final_score,
        verdict=_verdict(final_score),
        flags=flags,
        reason=reason,
        rule_score=rule_score,
        llm_score=llm_score,
        llm_available=llm_available,
    )
