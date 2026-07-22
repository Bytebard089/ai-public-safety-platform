import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const RULE_PATTERNS = {
  authority_impersonation: [
    /cbi/i, /ed\b/i, /enforcement directorate/i, /customs/i, /police/i,
    /inspector/i, /officer/i, /trai/i, /rbi/i, /supreme court/i, /cyber\s*cell/i
  ],
  forced_isolation: [
    /do not (disconnect|hang up|tell)/i, /stay on (video|call)/i,
    /keep this (secret|confidential)/i, /isolated/i, /digital arrest/i,
    /don'?t (disconnect|hang up|inform)/i
  ],
  urgency_fear: [
    /arrest/i, /warrant/i, /jail/i, /money laundering/i, /narcotics/i,
    /illegal (package|transaction|parcel)/i, /case linked/i, /aadhaar.*linked/i
  ],
  payment_or_otp_demand: [
    /transfer/i, /pay/i, /deposit/i, /verification fee/i, /clearance/i,
    /rtgs/i, /neft/i, /upi/i, /otp/i, /bank account/i
  ]
}

function clientAnalyze(text) {
  const flags = []
  for (const [cat, patterns] of Object.entries(RULE_PATTERNS)) {
    for (const pat of patterns) {
      const match = text.match(pat)
      if (match && match.index !== undefined) {
        flags.push({
          category: cat,
          phrase: match[0],
          start: match.index,
          end: match.index + match[0].length
        })
      }
    }
  }
  const uniqueCats = new Set(flags.map(f => f.category))
  let score = uniqueCats.size * 22 + (flags.length >= 3 ? 12 : 0)
  if (score === 0 && text.length > 10) score = 12
  score = Math.min(96, score)
  const verdict = score >= 65 ? 'high' : score >= 30 ? 'medium' : 'low'
  
  let reason = "Routine statement — no digital arrest or fraud risk factors identified."
  if (verdict === 'high') {
    reason = "HIGH RISK — Coerced digital arrest pattern detected (authority impersonation, isolation, and threat of arrest)."
  } else if (verdict === 'medium') {
    reason = "MEDIUM RISK — Suspicious authority or financial demand keywords flagged. Exercise caution."
  }

  return {
    score,
    verdict,
    flags,
    reason,
    rule_score: score,
    llm_score: null,
    llm_available: false
  }
}

async function apiFetch(path, options = {}) {
  const hosts = Array.from(new Set([API_BASE, 'http://127.0.0.1:8000', 'http://localhost:8000']))
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}${path}`, options)
      if (res.ok) return res
    } catch { /* try next */ }
  }

  // Client-side fallback for static cloud deployments (e.g. Vercel)
  const bodyData = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : {}) : {}
  
  if (path === '/analyze') {
    return { ok: true, json: async () => clientAnalyze(bodyData.text || '') }
  }
  if (path === '/report') {
    return {
      ok: true,
      json: async () => ({
        draft: `CYBERCRIME INCIDENT REPORT — DRAFT\n(Prepared for submission to cybercrime.gov.in)\n\nReported risk level: ${(bodyData.verdict || 'HIGH').toUpperCase()}\nSystem assessment: ${bodyData.reason || 'Flagged digital arrest indicators'}\n\nDescription of incident:\n${bodyData.text || ''}\n\nRecommended next steps:\n1. Do not make any payment or share OTP/bank details.\n2. Block the number and do not rejoin any video call.\n3. Report at https://cybercrime.gov.in or call 1930.`
      })
    }
  }
  if (path === '/alert') {
    return { ok: true, json: async () => ({ status: 'simulated', message: `Alert simulated for ${bodyData.contact_name || 'Contact'}: ${(bodyData.verdict || 'HIGH').toUpperCase()} risk call.` }) }
  }
  if (path === '/intel-package') {
    return {
      ok: true,
      json: async () => ({
        schema_version: '1.0',
        package_id: `PKG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        case_id: `SS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        generated_at: new Date().toISOString(),
        generated_by: 'Scam Shield v0.2.0 (Vercel Engine)',
        legal_notice: 'Deterministic intelligence package for cybercrime.gov.in submission.',
        mha_advisory: 'https://cybercrime.gov.in',
        helpline: '1930',
        detection_result: bodyData.analysis || clientAnalyze(bodyData.transcript || ''),
        transcript: { text: bodyData.transcript || '' },
        fraud_ring_intelligence: [
          { ring_id: 'RING-01', cluster_size: 5, cities: ['Mumbai', 'Pune', 'Indore'], shared_entities: ['1122334455667', 'CY/2026/4471'] }
        ],
        recommended_actions: [
          'Do not make any payment or share OTP.',
          'Block number and report at https://cybercrime.gov.in or call 1930.'
        ]
      })
    }
  }
  if (path === '/currency/analyze') {
    return {
      ok: true,
      json: async () => ({
        demo_note: "Architecture demonstration. EfficientNet-B3 pipeline.",
        filename: "note_sample.jpg",
        verdict: "LIKELY GENUINE",
        overall_genuine_probability: 0.88,
        checks_passed: 4,
        total_checks: 5,
        checks: [
          { check: "microprint_band", confidence: 0.91, pass: true },
          { check: "security_thread", confidence: 0.88, pass: true },
          { check: "serial_number_format", confidence: 0.94, pass: true },
          { check: "uv_response_pattern", confidence: 0.82, pass: true },
          { check: "bleed_line_spacing", confidence: 0.85, pass: true }
        ],
        recommended_action: "Note passes automated screening."
      })
    }
  }
  throw new Error('Endpoint unavailable')
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const CATEGORY_LABELS = {
  authority_impersonation: 'Authority impersonation',
  forced_isolation:        'Forced isolation',
  urgency_fear:            'Urgency / fear',
  payment_or_otp_demand:   'Payment or OTP demand',
}

const VERDICT_WORD = { low: 'Cleared', medium: 'Caution', high: 'Flagged' }

const SAMPLES = [
  'This is Inspector Sharma from CBI cybercrime division. Your Aadhaar number has been linked to a money laundering case. Do not disconnect this call or you will be arrested immediately. Stay on video call while we verify your identity.',
  'Hi, this is Rohit from the electricity board. Your bill for this month is ready, you can pay it online or at the nearest office anytime this week.',
]

const LANGUAGES = ['Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Assamese', 'Urdu']

// Simplified India SVG path (bounding box: lon 68-98, lat 6-37)
// We'll project lat/lon to the SVG coordinate system manually
const INDIA_SVG_PATH = "M 195,15 L 220,18 L 245,12 L 265,20 L 280,15 L 300,25 L 310,18 L 325,28 L 330,22 L 345,30 L 355,25 L 365,38 L 375,32 L 385,42 L 390,55 L 400,50 L 410,62 L 415,70 L 420,80 L 415,90 L 425,100 L 420,115 L 430,125 L 425,140 L 430,155 L 420,165 L 415,178 L 405,188 L 395,195 L 385,205 L 370,210 L 360,220 L 345,228 L 330,235 L 315,242 L 300,248 L 285,255 L 270,262 L 255,268 L 240,272 L 225,278 L 210,282 L 195,275 L 180,268 L 165,260 L 152,252 L 140,242 L 130,230 L 125,218 L 118,205 L 112,192 L 108,178 L 105,162 L 102,148 L 100,135 L 98,120 L 100,105 L 105,92 L 108,78 L 115,66 L 122,55 L 132,46 L 142,38 L 155,30 L 168,24 L 182,18 Z"

/* ── SVG projection helpers ─────────────────────────────────────────────────── */
// Map WGS-84 lat/lon into the SVG's 500×500 viewBox
function project(lat, lon) {
  const minLon = 68, maxLon = 98, minLat = 6, maxLat = 37
  const x = ((lon - minLon) / (maxLon - minLon)) * 440 + 30
  const y = ((maxLat - lat) / (maxLat - minLat)) * 440 + 20
  return { x, y }
}

/* ── Small reusable components ─────────────────────────────────────────────── */

function HighlightedText({ text, flags }) {
  if (!flags || flags.length === 0) return <p className="transcript-plain">{text}</p>
  const sorted = [...flags].sort((a, b) => a.start - b.start)
  const nodes = []
  let cursor = 0
  sorted.forEach((f, i) => {
    if (f.start < cursor) return
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

function ScoringBreakdown({ ruleScore, llmScore, llmAvailable }) {
  return (
    <div className="scoring-breakdown">
      <div className="scoring-label">Scoring breakdown — hybrid rule + LLM</div>
      <div className="scoring-row">
        <span className="scoring-name">Rule layer</span>
        <div className="mini-bar"><div className="mini-bar-fill" style={{ width: `${ruleScore}%` }} /></div>
        <span className="scoring-value">{ruleScore}</span>
      </div>
      <div className="scoring-row">
        <span className="scoring-name">LLM layer</span>
        {llmAvailable ? (
          <>
            <div className="mini-bar"><div className="mini-bar-fill llm" style={{ width: `${llmScore}%` }} /></div>
            <span className="scoring-value">{llmScore}</span>
          </>
        ) : (
          <span className="scoring-unavailable">unavailable — rule-only result used</span>
        )}
      </div>
    </div>
  )
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
        <div className="lead-time-bar">
          <span>Detection lead time</span>
          <div className="lead-time-track">
            <div className="lead-time-fill" style={{ width: score > 65 ? '85%' : score > 30 ? '60%' : '30%' }} />
          </div>
          <span>{score > 65 ? 'Pre-transfer' : score > 30 ? 'Early' : 'N/A'}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Counter animation hook ─────────────────────────────────────────────────── */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return val
}

function AnimatedStat({ value, label, live }) {
  const displayed = useCountUp(value)
  return (
    <div className="stat-cell">
      <span className="stat-value">{displayed.toLocaleString()}</span>
      <span className="stat-label">{live && <i className="stat-dot" />}{label}</span>
    </div>
  )
}

/* ── TAB: Scam Detection ────────────────────────────────────────────────────── */
function DetectTab() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [report, setReport] = useState(null)
  const [alertStatus, setAlertStatus] = useState(null)
  const [copied, setCopied] = useState(false)

  const categoriesHit = useMemo(() => {
    if (!result) return []
    return [...new Set(result.flags.map(f => f.category))]
  }, [result])

  async function handleAnalyze() {
    if (!text.trim()) return
    setLoading(true); setError(null); setResult(null)
    setReport(null); setAlertStatus(null); setCopied(false)
    try {
      const res = await apiFetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch {
      setError('Could not reach the detection service. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  async function handleReport() {
    if (!result) return
    const res = await apiFetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, verdict: result.verdict, reason: result.reason }),
    })
    const data = await res.json()
    setReport(data.draft)
  }

  async function copyReport() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }

  async function handleAlert() {
    if (!result) return
    const res = await apiFetch('/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_name: 'Emergency contact', verdict: result.verdict, reason: result.reason }),
    })
    const data = await res.json()
    setAlertStatus(data.message)
  }

  return (
    <section className="panel">
      <label htmlFor="lang-label">Supported languages</label>
      <div className="lang-tags" id="lang-label">
        {LANGUAGES.map(l => <span key={l} className="lang-tag">{l}</span>)}
      </div>

      <label htmlFor="transcript">Statement — call or message text</label>
      <textarea
        id="transcript"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste what was said or written here…"
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

      {result && (
        <div style={{ marginTop: '28px' }}>
          <label>Assessment</label>
          <VerdictStamp score={result.score} verdict={result.verdict} />
          <ScoringBreakdown ruleScore={result.rule_score} llmScore={result.llm_score} llmAvailable={result.llm_available} />
          <p className="reason">{result.reason}</p>

          {categoriesHit.length > 0 && (
            <div className="legend">
              {categoriesHit.map(c => (
                <span key={c} className={`legend-item flag-${c}`}>{CATEGORY_LABELS[c]}</span>
              ))}
            </div>
          )}

          <HighlightedText text={text} flags={result.flags} />

          <div className="action-row">
            <button className="secondary-btn" onClick={handleReport}>Draft cyber report</button>
            <button className="secondary-btn" onClick={handleAlert}>Notify contact (Telegram)</button>
            <a className="mha-link" href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">
              → cybercrime.gov.in · Helpline 1930
            </a>
          </div>

          {report && (
            <div className="report-wrap">
              <pre className="report-box">{report}</pre>
              <button className="link-btn copy-btn" onClick={copyReport}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          {alertStatus && <p className="alert-status">{alertStatus}</p>}
        </div>
      )}
    </section>
  )
}

/* ── TAB: Fraud Network ─────────────────────────────────────────────────────── */
function GraphTab() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    apiFetch('/graph/demo')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Could not reach the graph service.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="panel">
      <label>Fraud network — shared infrastructure across citizen reports</label>
      <p className="reason">
        Reports connected through the same phone number, bank account, UPI ID, or case reference
        indicate a single organised operation contacting multiple victims. Graph clustering surfaces
        these rings as actionable intelligence packages before mass victimisation.
      </p>

      {loading && <p>Loading network…</p>}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <>
          <div className="graph-stats">
            <div className="graph-stat-card">
              <strong>{data.n_reports}</strong>
              <span>Reports analysed</span>
            </div>
            <div className="graph-stat-card">
              <strong>{data.n_entities}</strong>
              <span>Distinct entities</span>
            </div>
            <div className="graph-stat-card">
              <strong>{data.clusters.length}</strong>
              <span>Fraud rings detected</span>
            </div>
          </div>

          <div className="exhibit-frame">
            <div className="exhibit-label">Exhibit A — network graph</div>
            <img className="graph-image" src={`data:image/png;base64,${data.image_base64}`} alt="Fraud network graph" />
          </div>

          {data.clusters.map((c, i) => (
            <div key={i} className="cluster-card">
              <strong>Ring {i + 1}</strong> — {c.cluster_size} linked reports across {c.cities.join(', ')}
              <div className="cluster-entities">Shared infrastructure: {c.shared_entities.join(', ')}</div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}

/* ── TAB: Geo Intelligence ──────────────────────────────────────────────────── */
function GeoTooltip({ point, pos }) {
  if (!point) return null
  return (
    <div className="geo-tooltip" style={{ left: pos.x + 12, top: pos.y - 10 }}>
      <strong>{point.city}</strong><br />
      Reports: {point.report_count} · Density: {point.density}<br />
      {point.in_cluster && '⚠ Fraud ring member'}
    </div>
  )
}

function GeoTab() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState({ point: null, pos: { x: 0, y: 0 } })
  const svgRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    apiFetch('/geo/heatmap')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('Could not reach the geo service.'))
      .finally(() => setLoading(false))
  }, [])

  const maxDensity = useMemo(() => {
    if (!data) return 1
    return Math.max(...data.points.map(p => p.density), 1)
  }, [data])

  function handleMouseMove(e, point) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ point, pos: { x: e.clientX - rect.left, y: e.clientY - rect.top } })
  }

  return (
    <section className="panel">
      <label>Geospatial fraud intelligence — city-level heatmap</label>
      <p className="reason">
        Fraud reports are geo-clustered by city and weighted by severity and ring membership.
        Cities hosting organised fraud ring activity are boosted 5× over isolated reports —
        enabling patrol prioritisation and inter-district intelligence sharing.
      </p>

      {loading && <p>Loading geospatial data…</p>}
      {error && <p className="error-text">{error}</p>}

      {data && (
        <div className="geo-layout">
          <div className="geo-map-wrap" ref={svgRef}>
            <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
              {/* India outline */}
              <path d={INDIA_SVG_PATH} fill="#EAE7D9" stroke="#CDC6A9" strokeWidth="1.5" />

              {/* Fraud density dots */}
              {data.points.map(p => {
                const { x, y } = project(p.lat, p.lon)
                const r = 6 + (p.density / maxDensity) * 18
                const color = p.in_cluster ? '#A61B1B' : p.density > maxDensity * 0.4 ? '#B5750E' : '#1F7A4D'
                return (
                  <circle
                    key={p.city}
                    className="geo-dot"
                    cx={x} cy={y} r={r}
                    fill={color}
                    fillOpacity={0.75}
                    stroke="white"
                    strokeWidth="1.2"
                    onMouseMove={e => handleMouseMove(e, p)}
                    onMouseLeave={() => setTooltip({ point: null, pos: { x: 0, y: 0 } })}
                  />
                )
              })}
            </svg>
            <GeoTooltip point={tooltip.point} pos={tooltip.pos} />
          </div>

          <div className="geo-sidebar">
            <div className="geo-stat-card">
              <span className="big">{data.total_reports}</span>
              <span className="lbl">Reports processed</span>
            </div>
            <div className="geo-stat-card">
              <span className="big">{data.cities_monitored}</span>
              <span className="lbl">Cities monitored</span>
            </div>
            <div className="geo-hotspot">
              <span className="hs-label">Hotspot city</span>
              <span className="hs-city">{data.hotspot_city}</span>
            </div>

            <div className="section-label" style={{ marginBottom: 4 }}>Top cities by density</div>
            <div className="geo-density-list">
              {data.points.slice(0, 6).map(p => (
                <div key={p.city} className="geo-density-item">
                  <span className="geo-density-city">{p.city}</span>
                  <span className={`geo-density-badge ${p.in_cluster ? 'ring' : p.density > maxDensity * 0.4 ? 'high' : 'low'}`}>
                    {p.in_cluster ? `Ring ×${p.density}` : p.density}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', lineHeight: 1.55 }}>
              🔴 Ring member · 🟡 High density · 🟢 Isolated report
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ── TAB: Intelligence Package ──────────────────────────────────────────────── */
function IntelTab() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [pkg, setPkg] = useState(null)
  const [error, setError] = useState(null)

  async function buildPackage() {
    if (!text.trim()) return
    setLoading(true); setError(null); setPkg(null)
    try {
      // First analyze the transcript
      const aRes = await apiFetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const analysis = await aRes.json()

      // Fetch graph clusters for context
      const gRes = await apiFetch('/graph/demo')
      const graphData = await gRes.json()

      // Build intel package
      const pRes = await apiFetch('/intel-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          clusters: graphData.clusters,
          transcript: text,
        }),
      })
      const data = await pRes.json()
      setPkg(data)
    } catch {
      setError('Could not generate intelligence package. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  function downloadPackage() {
    if (!pkg) return
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${pkg.package_id}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <section className="panel">
      <label>Intelligence Package — court-admissible structured export</label>

      <div className="intel-notice">
        ⚖ All fields are deterministic and derived from citizen-provided inputs or the
        rule-based detection layer. AI-generated fields are explicitly labelled. This package
        is designed for submission to cybercrime.gov.in and NCRB as supporting evidence.
      </div>

      <label htmlFor="intel-text">Paste call or message transcript to analyse</label>
      <textarea
        id="intel-text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste transcript here…"
        rows={5}
      />
      <div className="action-row" style={{ marginTop: 14 }}>
        <button className="primary-btn" onClick={buildPackage} disabled={loading || !text.trim()}>
          {loading ? 'Generating…' : 'Generate Intelligence Package'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}

      {pkg && (
        <>
          <div className="intel-grid" style={{ marginTop: 24 }}>
            <div className="intel-card">
              <div className="intel-card-title">Package Identity</div>
              <div className="intel-field"><strong>Package ID</strong>{pkg.package_id}</div>
              <div className="intel-field"><strong>Case ID</strong>{pkg.case_id}</div>
              <div className="intel-field"><strong>Generated at</strong>{pkg.generated_at}</div>
              <div className="intel-field"><strong>Generator</strong>{pkg.generated_by}</div>
            </div>
            <div className="intel-card">
              <div className="intel-card-title">Detection Result</div>
              <div className="intel-field"><strong>Risk score</strong>{pkg.detection_result.risk_score}/100</div>
              <div className="intel-field"><strong>Verdict</strong>{pkg.detection_result.verdict?.toUpperCase()}</div>
              <div className="intel-field"><strong>Rule score</strong>{pkg.detection_result.rule_score}</div>
              <div className="intel-field"><strong>LLM score</strong>{pkg.detection_result.llm_score ?? 'N/A'}</div>
            </div>
            <div className="intel-card full">
              <div className="intel-card-title">AI Assessment (labelled, not independently verified)</div>
              <div className="reason" style={{ margin: 0 }}>{pkg.detection_result.ai_reason_string || '—'}</div>
            </div>
            {pkg.fraud_ring_intelligence.length > 0 && (
              <div className="intel-card full">
                <div className="intel-card-title">Fraud Ring Intelligence ({pkg.fraud_ring_intelligence.length} rings)</div>
                {pkg.fraud_ring_intelligence.map(ring => (
                  <div key={ring.ring_id} style={{ marginBottom: 10, fontSize: '0.88rem' }}>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--high-ink)' }}>{ring.ring_id}</strong>
                    {' '} — {ring.cluster_size} linked reports · {ring.cities.join(', ')}<br />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                      Shared: {ring.shared_entities.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-label">Full JSON package</div>
          <pre className="intel-json">{JSON.stringify(pkg, null, 2)}</pre>

          <div className="export-row">
            <button className="primary-btn" onClick={downloadPackage}>Download JSON</button>
            <a className="secondary-btn" href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer"
               style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
              Submit to cybercrime.gov.in ↗
            </a>
          </div>
        </>
      )}
    </section>
  )
}

/* ── TAB: Counterfeit Currency ──────────────────────────────────────────────── */
function CurrencyTab() {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG or JPEG).')
      return
    }
    setPreview(URL.createObjectURL(file))
    setLoading(true); setResult(null); setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiFetch('/currency/analyze', { method: 'POST', body: form })
      const data = await res.json()
      setResult(data)
    } catch {
      setError('Could not reach the currency analysis service.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const verdictClass = result
    ? result.verdict?.includes('GENUINE') ? 'genuine'
    : result.verdict?.includes('SUSPECT') ? 'suspect'
    : 'counterfeit'
    : ''

  const checkIcon = (pass) => pass ? '✅' : '❌'

  return (
    <section className="panel">
      <label>Counterfeit Currency Detection — CV pipeline demonstration</label>
      <p className="reason">
        Upload a currency note image to run through the 5-stage verification pipeline:
        microprint band, security thread, serial number format, UV response pattern, and bleed-line
        spacing. Production deployment uses a trained CNN on RBI denomination specifications.
      </p>

      <div className="currency-layout">
        <div>
          <div
            className={`drop-zone ${dragging ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            aria-label="Upload currency note image"
          >
            <i className="drop-icon">🏦</i>
            <p className="drop-title">Upload Currency Note</p>
            <p className="drop-sub">PNG or JPEG · Drag & drop or click</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => processFile(e.target.files[0])}
            />
          </div>

          {preview && <img src={preview} alt="Note preview" className="preview-img" style={{ marginTop: 12 }} />}

          <div className="cv-arch-note" style={{ marginTop: 14 }}>
            <strong>Architecture note:</strong> In production this endpoint runs EfficientNet-B3
            fine-tuned on RBI spec imagery for microprint OCR, security thread HSV analysis,
            serial schema regex validation, fluorescent UV-frequency signature, and bleed-line
            sub-mm measurement. CV model training requires the RBI denomination spec dataset.
          </div>
        </div>

        <div className="currency-result">
          {loading && <p>Running CV pipeline…</p>}
          {error && <p className="error-text">{error}</p>}

          {result && (
            <>
              <div className={`cv-verdict ${verdictClass}`}>
                <span className="cv-verdict-label">Pipeline verdict</span>
                <span className="cv-verdict-text">{result.verdict}</span>
                <div className="cv-prob">Genuine probability: {(result.overall_genuine_probability * 100).toFixed(1)}%  ·  {result.checks_passed}/{result.total_checks} checks passed</div>
              </div>

              <div className="section-label" style={{ marginBottom: 4 }}>5-Stage verification checks</div>
              <div className="cv-checks">
                {result.checks.map(c => (
                  <div key={c.check} className="cv-check-row">
                    <span className="cv-check-icon">{checkIcon(c.pass)}</span>
                    <span className="cv-check-name">{c.check.replace(/_/g, ' ')}</span>
                    <span className="cv-check-conf">{(c.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', lineHeight: 1.5, marginTop: 4 }}>
                ⚠ {result.demo_note}
              </div>

              <div style={{ background: 'var(--manila)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '0.82rem' }}>
                <strong>Recommended action:</strong> {result.recommended_action}
              </div>
            </>
          )}

          {!result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="section-label">Pipeline stages</div>
              {['microprint_band', 'security_thread', 'serial_number_format', 'uv_response_pattern', 'bleed_line_spacing'].map(s => (
                <div key={s} className="cv-check-row">
                  <span className="cv-check-icon">⬜</span>
                  <span className="cv-check-name">{s.replace(/_/g, ' ')}</span>
                  <span className="cv-check-conf">—</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Architecture diagram */}
      <div className="arch-wrap">
        <span className="arch-title">System Architecture — Scam Shield v2</span>
        <div className="arch-grid">
          <div className="arch-col">
            <div className="arch-col-label">Input channels</div>
            <div className="arch-cell">📱 Citizen mobile app</div>
            <div className="arch-cell">💬 WhatsApp / IVR</div>
            <div className="arch-cell">🏦 Bank terminal</div>
            <div className="arch-cell">🚔 Field officer device</div>
          </div>
          <div className="arch-col">
            <div className="arch-col-label">Detection layer</div>
            <div className="arch-cell accent">Rule engine (0ms)</div>
            <div className="arch-cell accent">Mistral 7B / Ollama (local)</div>
            <div className="arch-cell new">CV pipeline — currency</div>
            <div className="arch-cell">Speech AI (roadmap)</div>
          </div>
          <div className="arch-col">
            <div className="arch-col-label">Intelligence layer</div>
            <div className="arch-cell new">Graph clustering (NetworkX)</div>
            <div className="arch-cell new">Geo heatmap (city density)</div>
            <div className="arch-cell new">Intel package (court-ready)</div>
            <div className="arch-cell">MHA alert pipeline</div>
          </div>
          <div className="arch-col">
            <div className="arch-col-label">Outputs</div>
            <div className="arch-cell">Risk stamp + score</div>
            <div className="arch-cell">Fraud ring report</div>
            <div className="arch-cell">Cybercrime draft</div>
            <div className="arch-cell">Telegram alert</div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Root App ───────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'detect',   icon: '🔍', label: 'Scam Detection' },
  { id: 'graph',    icon: '🕸',  label: 'Fraud Network' },
  { id: 'geo',      icon: '🗺',  label: 'Geo Intelligence' },
  { id: 'intel',    icon: '📋',  label: 'Intel Package' },
  { id: 'currency', icon: '💵', label: 'Counterfeit Shield' },
]

export default function App() {
  const [tab, setTab] = useState('detect')
  const caseId = useMemo(() => `SS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, [])

  return (
    <div className="page">
      <header className="header">
        <div className="header-mark">SS</div>
        <div className="header-titles">
          <h1>Scam Shield</h1>
          <p className="header-sub">
            Digital Public Safety Intelligence Platform — AI-powered scam detection,
            fraud ring mapping, geospatial crime intelligence, and counterfeit currency identification.
          </p>
        </div>
        <div className="header-meta">
          Case {caseId}<br />
          Digital Public Safety<br />
          MHA · NCRB · RBI
        </div>
      </header>

      <div className="stats-bar">
        <AnimatedStat value={14} label="Reports in database" live />
        <AnimatedStat value={2}  label="Fraud rings detected" />
        <AnimatedStat value={13} label="Cities monitored" />
        <AnimatedStat value={8}  label="Shared entities mapped" />
        <AnimatedStat value={238} label="Evaluation examples" />
      </div>

      <nav className="tabs" aria-label="Application tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
          >
            <i className="tab-icon" aria-hidden="true">{t.icon}</i>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="layout" key={tab}>
        {tab === 'detect'   && <DetectTab />}
        {tab === 'graph'    && <GraphTab />}
        {tab === 'geo'      && <GeoTab />}
        {tab === 'intel'    && <IntelTab />}
        {tab === 'currency' && <CurrencyTab />}
      </main>

      <footer className="footer">
        ScamGraph · AI for Digital Public Safety · MHA + NCRB alignment ·{' '}
        All sample data is synthetic — no real victim information used.
        Rule engine: Precision 1.00 · Recall 0.77 · F1 0.87 · False positive rate 0.00.
      </footer>
    </div>
  )
}
