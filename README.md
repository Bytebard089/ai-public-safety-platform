# Scam Shield — Digital Public Safety Intelligence Platform

A local-first public safety platform designed for real-time digital arrest scam classification, graph-based fraud ring detection, geospatial crime mapping, and counterfeit currency verification.

---

## Live Demo

Access the live web application: [https://ai-public-safety-platform-nine.vercel.app/](https://ai-public-safety-platform-nine.vercel.app/)

---

## Problem Statement & Impact

India registered **1.14 million cybercrime complaints in 2023** (a 60% YoY increase). According to the Ministry of Home Affairs (MHA), "digital arrest" scams—where transnational fraud syndicates impersonate central agencies (CBI, ED, Customs) over video calls—defrauded citizens of over **₹1,776 crore** in the first nine months of 2024 alone. Concurrently, the RBI flagged record Fake Indian Currency Note (FICN) seizures where counterfeit ₹500 notes defeat routine manual bank verification.

**Scam Shield** addresses these challenges by providing law enforcement and citizens with an integrated digital intelligence platform.

---

## Features & Architecture

| Module | Technical Implementation | Practical Utility |
| :--- | :--- | :--- |
| **Scam Detection Engine** | Hybrid Regex Rule Matrix + Local Mistral 7B LLM | Real-time classification of call/chat transcripts with risk scoring (0–100), character-level evidence highlighting, and automated draft report generation for `cybercrime.gov.in`. |
| **Fraud Network Intelligence** | Bipartite Graph Clustering via NetworkX | Maps shared infrastructure (phone numbers, UPI IDs, bank accounts, case IDs) across citizen reports to reveal multi-victim fraud syndicates. |
| **Geospatial Heatmap** | Weighted Spatial Aggregation with Ring Boosting | City-level incident aggregation applying severity multipliers (3× high, 2× medium) and a 5× multiplier for organized ring membership to prioritize tactical response. |
| **Intel Package Exporter** | Schema-Versioned Deterministic JSON Exporter | Produces court-admissible, auditable evidence packages adhering to NCRB standards with explicit labeling of machine-learning reasoning. |
| **Counterfeit Currency Shield** | 5-Stage Computer Vision Pipeline | Microprint legibility, security thread HSV analysis, serial format validation, UV fluorescence frequency check, and bleed-line spacing evaluation. |

---

## System Architecture

```text
                               ┌──────────────────────────────────────────┐
                               │       Citizen & Law Enforcement UX       │
                               │  (React 18 + Vite + SVG Geo Intelligence)│
                               └────────────────────┬─────────────────────┘
                                                    │
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FastAPI Application Layer                                      │
│                                                                                                  │
│  ┌────────────────────────┐      ┌────────────────────────┐      ┌─────────────────────────────┐ │
│  │   Regex Rule Engine    │      │  Local Mistral 7B LLM  │      │  Geospatial Intelligence    │ │
│  │ (0ms Latency, F1: 0.87)│      │  (Ollama / Air-Gapped) │      │  (Severity + Ring Boosting) │ │
│  └───────────┬────────────┘      └───────────┬────────────┘      └──────────────┬──────────────┘ │
│              │                               │                                  │                │
│              └───────────────────────┬───────┘                                  │                │
│                                      ▼                                          │                │
│  ┌──────────────────────────────────────────────────────────────────────────────┴─────────────┐  │
│  │                         Graph Intelligence & Evidence Pipeline                             │  │
│  │   - Bipartite NetworkX Graph Clustering                                                    │  │
│  │   - Deterministic Intel Package Generator (Court-Admissible)                               │  │
│  │   - Computer Vision Currency Analysis Pipeline (PIL + NumPy)                              │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Benchmark & Evaluation Results

Evaluated against a curated, balanced dataset of **238 annotated transcripts** (scam vs. benign controls):

| Metric | Score | Target Standard |
| :--- | :--- | :--- |
| **Precision** | **1.00** | 1.00 (Zero False Positive Target) |
| **Recall** | **0.77** | ≥ 0.75 |
| **F1 Score** | **0.87** | ≥ 0.85 |
| **False Positive Rate (FPR)** | **0.00** | 0.00 (Critical for Public Safety Systems) |

> **Design Principle:** In public safety tools, false alarms destroy user trust. The classification matrix is strictly tuned to guarantee a **0.00 False Positive Rate**.

---

## Tech Stack

- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2, NetworkX, Matplotlib, NumPy, Pillow, Scikit-Learn
- **Frontend:** React 18, Vite, Vanilla CSS, Custom SVG Projections
- **AI / Model:** Local Ollama runner with Mistral 7B (privacy-preserving air-gapped deployment)
- **Deployment:** Render (Backend Docker Container), Vercel (Frontend Static Host)

---

## Local Setup

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Ollama** *(Optional: Required for local LLM layer)*

### 2. Backend Installation
```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch FastAPI server
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend Installation
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Reference

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `GET /health` | `GET` | Service status and version check |
| `POST /analyze` | `POST` | Execute hybrid classification on transcript |
| `POST /report` | `POST` | Generate official cybercrime incident draft |
| `GET /graph/demo` | `GET` | Retrieve network graph and detected fraud rings |
| `GET /geo/heatmap` | `GET` | Fetch spatial crime density & hotspot metrics |
| `POST /intel-package` | `POST` | Export court-ready structured JSON intelligence |
| `POST /currency/analyze` | `POST` | Execute CV pipeline verification on note image |
| `POST /alert` | `POST` | Trigger emergency contact dispatch (Telegram API) |

---

## License & Helplines

Distributed under the **MIT License**. All evaluation datasets and report examples are synthetic and contain no real citizen PII.

- **National Cybercrime Helpline:** 1930
- **Official Portal:** [https://cybercrime.gov.in](https://cybercrime.gov.in)
