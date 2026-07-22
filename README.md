# 🛡 Scam Shield — AI-Powered Digital Public Safety Intelligence Platform

> **Hackathon Track:** Smart Cities / Public Safety / Digital Trust / Geospatial Law Enforcement

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com/)
[![React + Vite](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## The Problem

India registered **1.14 million cybercrime complaints in 2023** — a 60% rise from 2022. The Ministry of Home Affairs reported that "digital arrest" scams defrauded citizens of over **₹1,776 crore** in just the first nine months of 2024. These are industrialised operations — spoofed numbers, AI-generated voices, fake government portals — and law enforcement lacks the tooling to detect and disrupt them in real time.

Separately, the RBI's Annual Report 2025 flagged record FICN (Fake Indian Currency Notes) seizures, with high-denomination ₹500 fakes defeating manual detection in routine banking.

**Scam Shield** closes both gaps.

---

## What We Built

A **5-module AI command centre** for citizens and law enforcement:

| Module | What it does |
|--------|-------------|
| 🔍 **Scam Detection** | Hybrid rule-engine + local Mistral 7B LLM classifies call/message transcripts in real time. Outputs risk score (0–100), verdict stamp, highlighted evidence, and a draft cybercrime report for cybercrime.gov.in |
| 🕸 **Fraud Network Graph** | Builds a NetworkX graph of shared phone numbers, UPI IDs, and case references across citizen reports. Clusters connected components as "fraud rings" — surfaces organised operations before mass victimisation |
| 🗺 **Geo Intelligence** | Aggregates reports by city with severity weighting and ring-membership boost (5×). Renders an SVG India heatmap — identifies patrol priority hotspots |
| 📋 **Intel Package** | Generates a court-admissible structured JSON export (schema-versioned, deterministic, AI fields explicitly labelled) for submission to NCRB / cybercrime.gov.in |
| 💵 **Counterfeit Shield** | 5-stage CV pipeline demonstration: microprint band, security thread, serial number format, UV response pattern, bleed-line spacing. Architecture is production-ready; deployed model requires RBI denomination specification dataset |

---

## Architecture

```
Citizen / Officer Input
        │
        ▼
┌──────────────────────────────────────────────────┐
│              FastAPI Backend (Python 3.11)        │
│                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ Rule Engine │  │  Mistral 7B  │  │ Geo     │ │
│  │ (0ms, prec  │  │  via Ollama  │  │ Intel   │ │
│  │ 1.00, F1    │  │  (local,     │  │ (city   │ │
│  │ 0.87)       │  │  no data     │  │ density │ │
│  └──────┬──────┘  │  leaves      │  │ + ring  │ │
│         │         │  device)     │  │ boost)  │ │
│         └────┬────┘              └─────────────┘ │
│              ▼                                   │
│  ┌──────────────────────────────────────────┐    │
│  │   Graph Intel (NetworkX clustering)      │    │
│  │   Counterfeit CV Pipeline (PIL + NumPy)  │    │
│  │   Intel Package Builder (deterministic)  │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────┐
│  React + Vite UI     │
│  5-tab command centre│
│  SVG India heatmap   │
│  Animated stats bar  │
│  Court-ready export  │
└──────────────────────┘
```

---

## Key Technical Decisions

- **Local-first LLM:** Mistral 7B runs via Ollama — no data leaves the device. Critical for law enforcement tools that must work in air-gapped or restricted-network environments.
- **Hybrid scoring:** Rule engine (precision 1.00, recall 0.77, F1 0.87, false positive rate 0.00) provides a deterministic baseline. LLM layer adds contextual reasoning. Final score is a weighted blend.
- **Zero false positives:** Explicit design constraint — a citizen-facing safety tool must never incorrectly alarm a benign caller.
- **Court-admissible output:** Intel Package is schema-versioned, deterministic, and labels all AI-generated fields. Designed for NCRB submission without overclaiming AI certainty.
- **Severity-weighted geospatial scoring:** High-severity reports count 3×; medium 2×; low 1×. Fraud ring membership adds a 5× multiplier — surfaces organised operations over isolated incidents.

---

## Detection Performance

Evaluated on a synthetic dataset of 238 examples (balanced benign/scam):

| Metric | Score |
|--------|-------|
| Precision | **1.00** |
| Recall | **0.77** |
| F1 | **0.87** |
| False Positive Rate | **0.00** |

---

## Quick Start

### Prerequisites
- Python 3.11
- Node.js 18+
- [Ollama](https://ollama.ai) with `mistral` pulled (optional — falls back to rule-only mode)

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### (Optional) Enable LLM layer
```bash
ollama serve
ollama pull mistral
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/analyze` | POST | Hybrid scam detection on transcript text |
| `/report` | POST | Generate cybercrime report draft |
| `/graph/demo` | GET | Fraud ring network from demo dataset |
| `/geo/heatmap` | GET | City-level fraud density heatmap |
| `/intel-package` | POST | Court-admissible intelligence package |
| `/currency/analyze` | POST | Counterfeit currency CV pipeline |
| `/alert` | POST | Telegram alert to emergency contact |

Full interactive docs: **http://localhost:8000/docs**

---

## Judging Criteria Coverage

| Criterion | How we address it |
|-----------|------------------|
| **Innovation** | Hybrid rule+LLM detection, geospatial ring-boost scoring, court-admissible deterministic export |
| **Impact** | Directly targets India's #1 and #2 financial crime vectors (digital-arrest scams + FICN); aligned with MHA, NCRB, RBI priorities |
| **Technical Excellence** | Zero-dependency local LLM; precision 1.00 classifier; NetworkX graph clustering; schema-versioned API |
| **Scalability** | REST API with stateless endpoints; Ollama can be replaced with a GPU-hosted model endpoint; geospatial layer is city-agnostic |
| **UX** | 5-tab command centre; animated stats bar; SVG India heatmap with hover tooltips; one-click court report export; 1930 helpline surfaced prominently |

---

## Team

Built for the Smart Cities / Public Safety hackathon track.

> All sample data is synthetic — no real victim information was used in development or testing.

**National Cybercrime Helpline: 1930**  
**Report at: https://cybercrime.gov.in**
