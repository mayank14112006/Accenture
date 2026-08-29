import React, { useEffect, useRef, useState } from 'react'
import { useApi, postJson, fmtTime, DECISION_COLORS, CATEGORY_COLORS } from '../api'
import { Chip, DecisionChip, RiskChip, Dot, EmptyState } from './ui'

const USE_CASES = [
  ['internal_copilot', 'Internal copilot — 1.5 s budget, annotate-first'],
  ['customer_support', 'Customer support — 150 ms budget, fail-open'],
  ['decision_support', 'Decision support — gate mode, fail-closed'],
]

const DECISION_BLURB = {
  PASS: 'safe to use',
  ANNOTATE: 'usable with caveats',
  REPAIR: 'auto-repaired before delivery',
  ESCALATE: 'sent to human review',
  BLOCK: 'must not be delivered',
  HOLD_ACTION: 'actions held for review',
}

function VerdictCard({ verdict }) {
  const risk = Object.entries(verdict.risk || {})
  return (
    <div
      className="verdict-card"
      style={{ '--vc': DECISION_COLORS[verdict.decision] || '#8494a7' }}
    >
      <div className="verdict-head">
        <DecisionChip decision={verdict.decision} />
        <span className="verdict-blurb">{DECISION_BLURB[verdict.decision] || ''}</span>
        <span className="verdict-meta">
          {verdict.stage === 'ingress'
            ? 'stopped at ingress gate'
            : `checked in ${verdict.added_latency_ms != null ? verdict.added_latency_ms.toFixed(1) : '—'} ms`}
          {verdict.coverage != null ? ` · coverage ${verdict.coverage.toFixed(2)}` : ''}
        </span>
      </div>
      {risk.length > 0 && (
        <div className="verdict-risks">
          {risk.map(([cat, v]) => (
            <RiskChip key={cat} category={cat} prob={v.p} />
          ))}
        </div>
      )}
      {verdict.open_taints && verdict.open_taints.length > 0 && (
        <div className="verdict-risks">
          {verdict.open_taints.map((t, i) => (
            <Chip
              key={i}
              color="#ef4444"
              title={`unresolved ${t.status} value in this conversation (since check ${t.origin_turn})`}
            >
              tainted&nbsp;<span className="chip-num">{t.value}</span>
            </Chip>
          ))}
        </div>
      )}
      <ul className="verdict-explain">
        {(verdict.explanation || []).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {verdict.final_text && (
        <div className="verdict-repaired">
          <div className="repaired-label">repaired text (what would have been delivered)</div>
          <div className="repaired-text">{verdict.final_text}</div>
        </div>
      )}
      {verdict.decision_id && (
        <div className="verdict-foot">
          decision {verdict.decision_id.slice(0, 12)} · every verdict is hash-chained into the
          evidence ledger
        </div>
      )}
    </div>
  )
}

function Message({ m }) {
  return (
    <div className="chk-message">
      <div className="chk-bubble user">
        <div className="bubble-label">question asked to the AI</div>
        <div className="bubble-text">{m.question}</div>
      </div>
      <div className="chk-bubble ai">
        <div className="bubble-label">
          answer the AI gave
          {m.sources && m.sources.length > 0 && (
            <span className="bubble-srcs">
              · {m.sources.length} source{m.sources.length > 1 ? 's' : ''} attached (
              {m.sources.map((s) => s.trust).join(', ')})
            </span>
          )}
        </div>
        <div className="bubble-text">{m.ai_output}</div>
      </div>
      <VerdictCard verdict={m.verdict} />
      <div className="chk-ts">{fmtTime(m.ts)}</div>
    </div>
  )
}

export default function CheckerChat() {
  const sessionsApi = useApi('/v1/checker/sessions', 0)
  const sessions = Array.isArray(sessionsApi.data) ? sessionsApi.data : []
  // undefined = nothing chosen yet (auto-select newest) · null = user chose "+ New check"
  const [selected, setSelected] = useState(undefined)
  const [detail, setDetail] = useState(null)
  const [question, setQuestion] = useState('')
  const [aiOutput, setAiOutput] = useState('')
  const [srcText, setSrcText] = useState('')
  const [srcTrust, setSrcTrust] = useState('governed')
  const [useCase, setUseCase] = useState('internal_copilot')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const scroller = useRef(null)

  useEffect(() => {
    if (selected === undefined && sessions.length > 0) setSelected(sessions[0].id)
  }, [sessions, selected])

  useEffect(() => {
    let alive = true
    if (!selected) {
      setDetail(null)
      return
    }
    fetch(`/v1/checker/sessions/${selected}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setDetail(null))
    return () => {
      alive = false
    }
  }, [selected, sessionsApi.data])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [detail])

  async function submit() {
    if (!question.trim() || !aiOutput.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const body = {
        session_id: selected || undefined,
        question: question.trim(),
        ai_output: aiOutput.trim(),
        use_case: useCase,
        sources: srcText.trim()
          ? [{ id: 'user-source', trust: srcTrust, text: srcText.trim() }]
          : [],
      }
      const r = await postJson('/v1/checker/check', body)
      setQuestion('')
      setAiOutput('')
      setSrcText('')
      setSelected(r.session_id)
      await sessionsApi.refetch()
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function removeSession(id, ev) {
    ev.stopPropagation()
    await fetch(`/v1/checker/sessions/${id}`, { method: 'DELETE' })
    if (selected === id) setSelected(undefined) // fall back to newest remaining
    sessionsApi.refetch()
  }

  return (
    <div className="checker">
      <aside className="chk-sidebar">
        <button
          className="btn primary chk-new"
          onClick={() => {
            setSelected(null)
            setDetail(null)
          }}
        >
          + New check
        </button>
        <div className="chk-side-label">previous checks</div>
        <div className="chk-side-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`chk-side-item ${selected === s.id ? 'active' : ''}`}
              onClick={() => setSelected(s.id)}
            >
              <div className="chk-side-title">{s.title}</div>
              <div className="chk-side-meta">
                <Dot color={DECISION_COLORS[s.last_decision] || '#8494a7'} />
                {s.last_decision || '—'} · {s.checks} check{s.checks !== 1 ? 's' : ''} ·{' '}
                {s.use_case.replace('_', ' ')}
              </div>
              <button
                className="chk-side-del"
                title="delete session"
                onClick={(e) => removeSession(s.id, e)}
              >
                ×
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="chk-side-empty">no checks yet — run your first on the right</div>
          )}
        </div>
      </aside>

      <section className="chk-main">
        <div className="chk-scroll" ref={scroller}>
          {detail && detail.messages && detail.messages.length > 0 ? (
            <>
              <div className="chk-session-head">
                <span className="chk-session-title">{detail.title}</span>
                <Chip color="#8494a7">{detail.use_case.replace('_', ' ')} policy pack</Chip>
              </div>
              {detail.messages.map((m) => (
                <Message key={m.id} m={m} />
              ))}
            </>
          ) : (
            <EmptyState title="Check any AI's answer">
              <p className="chk-hint">
                Paste the question you asked an AI (ChatGPT, Copilot, an internal bot — any of
                them) and the answer it gave you. ControlPlane runs the pair through the same
                pipeline that governs live traffic — injection gate, PII / toxicity / grounding
                detectors, calibrated fusion, episode taint — and returns a verdict with the
                reasons. Attach the source document the answer should be based on to get a
                grounding verdict instead of an abstention.
              </p>
            </EmptyState>
          )}
        </div>

        <div className="chk-input">
          <div className="chk-input-row">
            <textarea
              rows={2}
              placeholder="The question you asked the AI…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <textarea
              rows={2}
              placeholder="The answer the AI gave you…"
              value={aiOutput}
              onChange={(e) => setAiOutput(e.target.value)}
            />
          </div>
          <div className="chk-input-row">
            <textarea
              rows={1}
              className="chk-src"
              placeholder="Optional: paste the source document the answer should be grounded in"
              value={srcText}
              onChange={(e) => setSrcText(e.target.value)}
            />
          </div>
          <div className="chk-input-bar">
            <select value={srcTrust} onChange={(e) => setSrcTrust(e.target.value)} title="source trust tier">
              <option value="governed">source: governed (official KB)</option>
              <option value="internal">source: internal</option>
              <option value="low_trust">source: low-trust (email / chat)</option>
            </select>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              disabled={Boolean(selected && detail)}
              title="policy pack — fixed per session"
            >
              {USE_CASES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <div className="chk-grow" />
            {error && <span className="chk-error">{error}</span>}
            <button className="btn primary" onClick={submit} disabled={busy || !question.trim() || !aiOutput.trim()}>
              {busy ? 'Checking…' : 'Check response'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
