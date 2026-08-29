import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------- palette
export const DECISION_COLORS = {
  PASS: '#22c55e',
  ANNOTATE: '#eab308',
  REPAIR: '#38bdf8',
  ESCALATE: '#f97316',
  BLOCK: '#ef4444',
  HOLD_ACTION: '#a855f7',
}

export const DECISION_ORDER = ['PASS', 'ANNOTATE', 'REPAIR', 'ESCALATE', 'BLOCK', 'HOLD_ACTION']

export const CATEGORY_COLORS = {
  grounding: '#38bdf8',
  privacy: '#ef4444',
  toxicity: '#f97316',
  injection: '#a855f7',
  cost: '#eab308',
}

// fixed series order — red and orange never adjacent (CVD-checked)
export const SERIES_ORDER = ['grounding', 'privacy', 'injection', 'toxicity', 'cost']

export const CLAIM_COLORS = {
  grounded: '#22c55e',
  derived: '#38bdf8',
  low_trust: '#eab308',
  tainted: '#ef4444',
}

export const VERDICT_COLORS = {
  SUPPORTED: '#22c55e',
  UNSUPPORTED: '#ef4444',
  CONTRADICTED: '#ef4444',
  ABSTAIN: '#8494a7',
  NO_SOURCES: '#8494a7',
}

// ---------------------------------------------------------------- formatters
export function fmtINR(v, digits = 0) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits })
}

export function fmtNum(v, digits = 0) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits })
}

export function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleTimeString('en-GB', { hour12: false })
}

export function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return (v * 100).toFixed(digits) + '%'
}

// ---------------------------------------------------------------- transport
export async function postJson(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`${path} -> HTTP ${r.status} ${text.slice(0, 200)}`)
  }
  return r.json()
}

/**
 * Polling fetch hook. Holds the last good payload across refetches
 * (no skeleton flash); `status` exposes HTTP status (e.g. 404 for evals).
 * Pass a falsy path to disable.
 */
export function useApi(path, intervalMs = 0) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(Boolean(path))
  const inflight = useRef(false)
  const alive = useRef(true)
  const pathRef = useRef(path)
  pathRef.current = path

  const refetch = useCallback(async () => {
    const p = pathRef.current
    if (!p || inflight.current) return
    inflight.current = true
    try {
      const r = await fetch(p)
      if (!alive.current || pathRef.current !== p) return
      setStatus(r.status)
      if (r.ok) {
        const j = await r.json()
        if (alive.current && pathRef.current === p) {
          setData(j)
          setError(null)
        }
      } else {
        setError(`HTTP ${r.status}`)
      }
    } catch (e) {
      if (alive.current) setError(String(e && e.message ? e.message : e))
    } finally {
      inflight.current = false
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    setData(null)
    setError(null)
    setStatus(null)
    setLoading(Boolean(path))
    if (!path) return undefined
    refetch()
    let t
    if (intervalMs > 0) t = setInterval(refetch, intervalMs)
    return () => {
      alive.current = false
      if (t) clearInterval(t)
    }
  }, [path, intervalMs, refetch])

  return { data, error, status, loading, refetch }
}
