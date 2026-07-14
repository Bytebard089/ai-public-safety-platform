# Scam Shield

AI-powered detection and citizen response for digital-arrest scams and impersonation fraud.

Built for **ET AI Hackathon 2026 — PS6: AI for Digital Public Safety**.

## What it does

Paste a suspicious call transcript or forwarded message. Scam Shield scores it 0–100 for
digital-arrest scam risk, highlights the exact phrases that triggered the score, and gives
the citizen a one-tap report draft and a simulated emergency-contact alert.

Every component in this stack is free and open-source — no paid API keys required to run it.

Detection is a hybrid of:
- **Rule layer** — regex patterns across four documented scam categories (authority
  impersonation, forced isolation, urgency/fear, payment or OTP demand). Fast, explainable,
  works even if the LLM call fails.
- **LLM layer** — contextual scoring via **Mistral 7B (Apache-2.0)** running locally through
  **Ollama** (free, open-source runtime, no API key, no per-call cost), plus a plain-language
  reason shown to the user.

See `Scam_Shield_Detailed_Document.pdf` for the full write-up (architecture, methodology,
ethics note, and judging-criteria alignment).

## Data & ethics

No real victim data or scraped scam scripts are used anywhere in this repo. All example
transcripts in `backend/data/transcripts.json` are synthetic, written for testing/demo
purposes, based only on the publicly documented *mechanics* of digital-arrest scams (MHA/RBI
public advisories) — never copied case material.

## Running locally

### 1. Ollama (free, local LLM layer — optional but recommended)
```bash
# Install from https://ollama.com (free, open-source)
ollama pull mistral      # Apache-2.0 licensed, ~4GB download, one-time
ollama serve              # runs on http://localhost:11434 by default
```

### 2. Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # defaults already point at local Ollama
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The rule layer works immediately with zero setup; the LLM layer
activates automatically once `ollama serve` is running. Everything works with no paid keys.

### Optional: real Telegram alerts (free)
1. Message **@BotFather** on Telegram, send `/newbot`, get a free bot token.
2. Message your new bot once, then visit
   `https://api.telegram.org/bot<token>/getUpdates` to find your `chat_id`.
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALERT_CHAT_ID` to `backend/.env`.

Without this, the alert button still works and returns a clearly-labeled simulated response.

## Evaluation

Rule-layer precision 1.00, recall 0.77, F1 0.87, false positive rate 0.00 (including
against adversarial hard negatives) on a 238-example labeled synthetic set. Full
methodology, honest caveats, and reproduction steps: `backend/eval/README.md`.

## Fraud network graph intelligence

A second pillar: cross-references multiple citizen reports for shared phone numbers,
bank accounts, UPI IDs, and case references to detect organised fraud rings, not just
score one message at a time. Try it in the frontend's "Fraud Network" tab, or directly:
```bash
curl http://localhost:8000/graph/demo
```

## Real inbound Telegram bot

`backend/telegram_bot.py` is a real listener, not a stub — forward it a message, get a
live risk verdict back. Runs as a separate process:
```bash
cd backend
export TELEGRAM_BOT_TOKEN=your-free-bot-token   # from @BotFather
python3 telegram_bot.py
```

## Project structure
```
backend/
  main.py               FastAPI app: /analyze, /report, /alert, /graph/demo, /graph/analyze
  detector.py             Hybrid rule + LLM detection engine
  graph_intel.py           Fraud network entity extraction, graph, clustering
  telegram_bot.py          Real inbound Telegram listener (separate process)
  data/transcripts.json    Synthetic labeled dataset for testing/demo
  data/fraud_reports.json  Synthetic multi-report dataset for graph demo
  eval/                    Evaluation harness, dataset generator, metrics, README
frontend/
  src/App.jsx       Scam Detection tab + Fraud Network tab
  src/App.css        Design system
```

## Roadmap (post-hackathon)

- Live Telegram bot channel for citizens to forward suspicious messages directly
- Larger open-source model (e.g. Llama 3.1 8B via Ollama) for higher LLM-layer accuracy
- Regional-language transcript support
- Counterfeit-currency detection (computer vision) as a second module
