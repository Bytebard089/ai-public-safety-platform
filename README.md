# ScamGraph

Detection and response system for digital-arrest and impersonation fraud — a category
of scam that cost Indian citizens over ₹1,776 crore in the first nine months of 2024
(MHA reporting). The system scores a call transcript or forwarded message for scam risk
in real time, explains which specific patterns triggered the score, and cross-references
multiple reports to surface organised fraud rings rather than treating each incident in
isolation.

## Overview

Two integrated components:

- **Detection engine** — hybrid rule-based and LLM-based scoring of individual
  transcripts, evaluated against a labeled dataset (see Evaluation below).
- **Fraud network graph intelligence** — entity extraction and graph clustering across
  multiple citizen reports, surfacing shared infrastructure (phone numbers, accounts,
  UPI IDs, case references) that indicates a single operation targeting many victims.

A Telegram bot provides a citizen-facing channel: a message forwarded to the bot returns
an automated risk verdict and next-step guidance.

Full write-up (architecture, methodology, and design rationale): `Scam_Shield_Detailed_Document.pdf`.

## Evaluation

The detection engine is evaluated against a 238-example labeled synthetic dataset (123
scam, 115 benign — including 38 adversarial hard negatives that use scam-adjacent
vocabulary without being scams, used to stress-test false positive rate).

| Metric | Value |
|---|---|
| Precision | 1.00 |
| Recall | 0.77 |
| F1 | 0.87 |
| False positive rate (overall) | 0.00 |
| False positive rate (hard negatives) | 0.00 |

These figures are for the rule layer in isolation. A held-out spot check outside the
generated set (including a code-switched Hindi-English scam script) confirmed the
expected limitation: the rule layer misses genuinely novel phrasing. This is the
motivation for the LLM layer, and is reported here rather than obscured by it. Full
methodology and reproduction steps: `backend/eval/README.md`.

## Design decisions

- **Local inference (Mistral 7B via Ollama) instead of a hosted LLM API.** The system
  processes citizen-submitted fraud reports, which can contain personal and financial
  details; keeping inference on-device avoids sending that data to a third party, and
  removes a network dependency from a tool that needs to work reliably in the moment
  a citizen is being targeted.
- **Rule layer as a first-class component, not a fallback.** Regex pattern matching
  across four documented scam mechanics (authority impersonation, forced isolation,
  urgency/fear, payment or OTP demand) is fast, fully explainable, and — per the
  evaluation above — already achieves zero false positives on its own. Risk is scored
  on co-occurrence of categories rather than any single phrase, since no individual
  line is proof of fraud but the combination is a documented pattern.
- **Graph analysis is a separate stage from per-message scoring.** A single flagged
  message tells you about one incident; correlating entities across many reports is
  what turns isolated complaints into an actionable signal for law enforcement
  prioritisation.

## Running locally

### 1. LLM layer (optional — the rule layer runs without it)
```bash
ollama pull mistral
ollama serve
```

### 2. Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

### 4. Telegram bot (optional, separate process)
```bash
cd backend
export TELEGRAM_BOT_TOKEN=your-bot-token   # issued via @BotFather
python3 telegram_bot.py
```
For outbound emergency-contact alerts, also set `TELEGRAM_ALERT_CHAT_ID` in `.env`;
without it, the alert endpoint returns a clearly labeled simulated response.

## Fraud network graph intelligence

```bash
curl http://localhost:8000/graph/demo
```
Also available in the frontend's "Fraud Network" tab. Demonstrated on a 14-report
synthetic dataset (`backend/data/fraud_reports.json`), correctly identifying two
distinct fraud rings and leaving five unrelated reports unclustered.

## Data & ethics

No real victim data, leaked scam scripts, or scraped call recordings are used anywhere
in this repository. All transcripts, evaluation examples, and fraud-report entities are
synthetic and developer-authored, reflecting only the publicly documented mechanics of
digital-arrest scams (MHA/RBI advisories) without reproducing real case material.

## Project structure
```
backend/
  main.py               FastAPI app — /analyze, /report, /alert, /graph/demo, /graph/analyze
  detector.py            Hybrid rule + LLM detection engine
  graph_intel.py         Entity extraction, graph construction, clustering
  telegram_bot.py        Inbound Telegram listener (separate process)
  data/                  Synthetic datasets for detection and graph demos
  eval/                  Evaluation harness, dataset generator, metrics, methodology
frontend/
  src/App.jsx            Scam Detection and Fraud Network views
  src/App.css             Design system
```

## Roadmap

- Larger local model (e.g. Llama 3.1 8B via Ollama) to close the recall gap on novel
  phrasing identified in evaluation
- Regional-language transcript support
- LLM-based entity extraction for the graph layer, to complement the current
  regex-based extraction on less structured report text
- Counterfeit-currency detection (computer vision) as an additional module
