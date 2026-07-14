import json
import os

from dataclasses import asdict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from detector import analyze
from graph_intel import analyze_reports

app = FastAPI(title="Scam Shield API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str


class ReportRequest(BaseModel):
    text: str
    verdict: str
    reason: str


class AlertRequest(BaseModel):
    contact_name: str
    verdict: str
    reason: str = ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze_transcript(req: AnalyzeRequest):
    if not req.text or not req.text.strip():
        return {"error": "text is required"}
    result = analyze(req.text)
    payload = asdict(result)
    payload["flags"] = [asdict(f) if not isinstance(f, dict) else f for f in result.flags]
    return payload


@app.post("/report")
def generate_report(req: ReportRequest):
    # Template-based draft, not LLM-generated, so we never fabricate legal
    # claims or facts the citizen didn't state themselves. The LLM's role
    # stays confined to risk scoring, not to writing anything that resembles
    # an official document.
    draft = (
        "CYBERCRIME INCIDENT REPORT — DRAFT\n"
        "(Prepared for submission to cybercrime.gov.in or nearest police station. "
        "Review and edit before submitting — this is a draft only.)\n\n"
        f"Reported risk level: {req.verdict.upper()}\n"
        f"System assessment: {req.reason}\n\n"
        "Description of incident (as provided by citizen):\n"
        f"{req.text}\n\n"
        "Recommended next steps:\n"
        "1. Do not make any payment or share OTP/bank details.\n"
        "2. Block the number and do not rejoin any video call.\n"
        "3. Report at https://cybercrime.gov.in or call 1930 (national cybercrime helpline).\n"
        "4. Inform a trusted family member or local police station.\n"
    )
    return {"draft": draft}


class GraphReport(BaseModel):
    id: str
    city: str = ""
    text: str


class GraphAnalyzeRequest(BaseModel):
    reports: list[GraphReport]


@app.get("/graph/demo")
def graph_demo():
    with open("data/fraud_reports.json") as f:
        reports = json.load(f)["reports"]
    result = analyze_reports(reports)
    return {
        "n_reports": result.n_reports,
        "n_entities": result.n_entities,
        "clusters": result.clusters,
        "image_base64": result.image_base64,
    }


@app.post("/graph/analyze")
def graph_analyze(req: GraphAnalyzeRequest):
    reports = [r.model_dump() for r in req.reports]
    result = analyze_reports(reports)
    return {
        "n_reports": result.n_reports,
        "n_entities": result.n_entities,
        "clusters": result.clusters,
        "image_base64": result.image_base64,
    }


@app.post("/alert")
def send_alert(req: AlertRequest):
    # Sends a real, free alert via the Telegram Bot API (no cost, no
    # business verification — create a bot for free via @BotFather). Falls
    # back to a simulated response if no bot token is configured, so the
    # rest of the demo still works without setup.
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_ALERT_CHAT_ID")

    if not bot_token or not chat_id:
        return {
            "status": "simulated",
            "message": f"Alert simulated: {req.contact_name} would be notified of a "
                       f"{req.verdict} risk call. Set TELEGRAM_BOT_TOKEN and "
                       f"TELEGRAM_ALERT_CHAT_ID to send a real alert.",
        }

    import requests
    text = (
        f"⚠️ Scam Shield alert\n"
        f"Risk level: {req.verdict.upper()}\n"
        f"{req.reason}\n"
        f"Notifying: {req.contact_name}"
    )
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        r.raise_for_status()
        return {"status": "sent", "message": f"Real Telegram alert sent to {req.contact_name}."}
    except requests.exceptions.RequestException:
        return {"status": "error", "message": "Telegram alert failed to send — check bot token and chat ID."}
