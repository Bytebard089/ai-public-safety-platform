import { useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const CATEGORY_LABELS = {
  authority_impersonation: 'Authority impersonation',
  forced_isolation: 'Forced isolation',
  urgency_fear: 'Urgency / fear',
  payment_or_otp_demand: 'Payment or OTP demand',
}

const VERDICT_WORD = {
  low: 'Cleared',
  medium: 'Caution',
  high: 'Flagged',
}

const SAMPLES = [
  'This is Inspector Sharma from CBI cybercrime division. Your Aadhaar number has been linked to a money laundering case. Do not disconnect this call or you will be arrested immediately. Stay on video call while we verify your identity.',
  'Hi, this is Rohit from the electricity board. Your bill for this month is ready, you can pay it online or at the nearest office anytime this week.',
]

function HighlightedText({ text, flags }) {
  if (!flags || flags.length === 0) return <p className="transcript-plain">{text}</p>

  const sorted = [...flags].sort((a, b) => a.start - b.start)
  const nodes = []
  let cursor = 0

  sorted.forEach((f, i) => {
    if (f.start < cursor) return // skip overlaps, keep it simple
    if (f.start > cursor) nodes.push(text.slice(cursor, f.start))
    nodes.push(
      <mark key={i} className={`flag flag-${f.category}`} title={CATEGORY_LABELS[f.category]}>
        {text.slice(f.start, f.end)}
      </mark>
    )
    cursor = f.end
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))

  return <p className="transcript-plain">{nodes}</p>
}

function VerdictStamp({ score, verdict }) {
  return (
    <div className="stamp-row">
      <div className="stamp" data-verdict={verdict}>
        <div className="stamp-text">
          <span className="stamp-verdict">{verdict}</span>
          <span className="stamp-word">{VERDICT_WORD[verdict] || 'Assessed'}</span>
        </div>
      </div>
      <div className="stamp-score">
        <div className="score-value">{score}<span>/100 risk score</span></div>
        <div className="score-bar">
          <div className="score-fill" data-verdict={verdict} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('detect')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [report, setReport] = useState(null)
  const [alertStatus, setAlertStatus] = useState(null)

  const [graphLoading, setGraphLoading] = useState(false)
  const [graphData, setGraphData] = useState(null)
  const [graphError, setGraphError] = useState(null)

  const categoriesHit = useMemo(() => {
    if (!result) return []
    return [...new Set(result.flags.map((f) => f.category))]
  }, [result])

  const caseId = useMemo(
    () => `SS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    []
  )

  async function handleAnalyze() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setReport(null)
    setAlertStatus(null)
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e) {
      setError('Could not reach the detection service. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  async function handleReport() {
    if (!result) return
    const res = await fetch(`${API_BASE}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, verdict: result.verdict, reason: result.reason }),
    })
    const data = await res.json()
    setReport(data.draft)
  }

  async function handleAlert() {
    if (!result) return
    const res = await fetch(`${API_BASE}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_name: 'Emergency contact', verdict: result.verdict, reason: result.reason }),
    })
    const data = await res.json()
    setAlertStatus(data.message)
  }

  async function loadGraphDemo() {
    setGraphLoading(true)
    setGraphError(null)
    try {
      const res = await fetch(`${API_BASE}/graph/demo`)
      const data = await res.json()
      setGraphData(data)
    } catch (e) {
      setGraphError('Could not reach the graph service. Is the backend running?')
    } finally {
      setGraphLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-mark">SS</div>
        <div className="header-titles">
          <h1>Scam Shield</h1>
          <p className="header-sub">Paste a suspicious call or message. Get a risk read before you act.</p>
        </div>
        <div className="header-meta">
          Case {caseId}<br />
          Digital Public Safety
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'detect' ? 'tab active' : 'tab'} onClick={() => setTab('detect')}>
          Scam Detection
        </button>
        <button
          className={tab === 'graph' ? 'tab active' : 'tab'}
          onClick={() => { setTab('graph'); if (!graphData) loadGraphDemo() }}
        >
          Fraud Network
        </button>
      </nav>

      {tab === 'detect' && (
      <main className="layout">
        <section className="panel input-panel">
          <label htmlFor="transcript">Statement — call or message text</label>
          <textarea
            id="transcript"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste what was said or written here..."
            rows={9}
          />
          <div className="sample-row">
            <span>Try a sample:</span>
            <button className="link-btn" onClick={() => setText(SAMPLES[0])}>suspicious</button>
            <button className="link-btn" onClick={() => setText(SAMPLES[1])}>ordinary</button>
          </div>
          <button className="primary-btn" onClick={handleAnalyze} disabled={loading || !text.trim()}>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </section>

        {result && (
          <section className="panel result-panel">
            <label>Assessment</label>
            <VerdictStamp score={result.score} verdict={result.verdict} />
            <p className="reason">{result.reason}</p>

            {categoriesHit.length > 0 && (
              <div className="legend">
                {categoriesHit.map((c) => (
                  <span key={c} className={`legend-item flag-${c}`}>{CATEGORY_LABELS[c]}</span>
                ))}
              </div>
            )}

            <HighlightedText text={text} flags={result.flags} />

            <div className="action-row">
              <button className="secondary-btn" onClick={handleReport}>Draft a report</button>
              <button className="secondary-btn" onClick={handleAlert}>Notify emergency contact (Telegram)</button>
            </div>

            {report && <pre className="report-box">{report}</pre>}
            {alertStatus && <p className="alert-status">{alertStatus}</p>}
          </section>
        )}
      </main>
      )}

      {tab === 'graph' && (
      <main className="layout">
        <section className="panel">
          <label>Fraud network — shared infrastructure across citizen reports</label>
          <p className="reason">
            Multiple flagged reports are cross-referenced for shared phone numbers, bank
            accounts, UPI IDs, and case references. Reports connected through the same
            entity indicate a single organised operation contacting multiple victims,
            not isolated incidents.
          </p>

          {graphLoading && <p>Loading…</p>}
          {graphError && <p className="error-text">{graphError}</p>}

          {graphData && (
            <>
              <div className="graph-stats">
                <span><strong>{graphData.n_reports}</strong>reports analyzed</span>
                <span><strong>{graphData.n_entities}</strong>distinct entities</span>
                <span><strong>{graphData.clusters.length}</strong>fraud rings detected</span>
              </div>

              <div className="exhibit-frame">
                <div className="exhibit-label">Exhibit A — network graph</div>
                <img
                  className="graph-image"
                  src={`data:image/png;base64,${graphData.image_base64}`}
                  alt="Fraud network graph"
                />
              </div>

              {graphData.clusters.map((c, i) => (
                <div key={i} className="cluster-card">
                  <strong>Ring {i + 1}</strong> — {c.cluster_size} linked reports across {c.cities.join(', ')}
                  <div className="cluster-entities">
                    Shared: {c.shared_entities.join(', ')}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </main>
      )}

      <footer className="footer">
        Built for ET AI Hackathon 2026 — PS6: AI for Digital Public Safety.
        All sample transcripts are synthetic and used for demonstration only.
      </footer>
    </div>
  )
}
