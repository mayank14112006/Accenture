import React from 'react'
import { DECISION_COLORS, CATEGORY_COLORS, fmtINR } from '../api'

export function SectionLabel({ children, right }) {
  return (
    <div className="section-head">
      <div className="section-label">{children}</div>
      {right ? <div className="section-right">{right}</div> : null}
    </div>
  )
}

export function Chip({ color = '#8494a7', children, title, className = '' }) {
  return (
    <span className={`chip ${className}`} title={title} style={{ '--chip': color }}>
      {children}
    </span>
  )
}

export function DecisionChip({ decision }) {
  const c = DECISION_COLORS[decision] || '#8494a7'
  return <Chip color={c}>{decision}</Chip>
}

export function RiskChip({ category, prob }) {
  const c = CATEGORY_COLORS[category] || '#8494a7'
  return (
    <Chip color={c} title={`${category} fused probability`}>
      {category}&nbsp;<span className="chip-num">{Number(prob).toFixed(2)}</span>
    </Chip>
  )
}

export function Dot({ color }) {
  return <span className="dot" style={{ background: color }} />
}

export function Swatch({ color }) {
  return <span className="swatch" style={{ background: color }} />
}

export function Mono({ children, title, className = '' }) {
  return (
    <span className={`mono ${className}`} title={title}>
      {children}
    </span>
  )
}

export function StatTile({ label, value, sub, children, valueColor }) {
  return (
    <div className="card stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
      {children}
    </div>
  )
}

/**
 * Horizontal usage bar: `value` against `max`. When value exceeds max the
 * fill turns red and a budget marker shows where the limit sits.
 */
export function HBar({ value = 0, max = 1, color = '#38bdf8', leftLabel, rightLabel }) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  const over = m > 0 && v > m
  const span = Math.max(v, m, 1e-9)
  const fillPct = Math.min(100, (v / span) * 100)
  const markerPct = m > 0 ? Math.min(100, (m / span) * 100) : 100
  const pctOfMax = m > 0 ? (v / m) * 100 : 0
  return (
    <div className="hbar">
      {(leftLabel || rightLabel) && (
        <div className="hbar-labels">
          <span>{leftLabel}</span>
          <span className="hbar-right">{rightLabel}</span>
        </div>
      )}
      <div className="hbar-track" title={`${fmtINR(v)} of ${fmtINR(m)} (${pctOfMax.toFixed(1)}%)`}>
        <div
          className="hbar-fill"
          style={{ width: `${fillPct}%`, background: over ? '#ef4444' : color }}
        />
        {over && (
          <div
            className="hbar-overzone"
            style={{ left: `${markerPct}%`, width: `${100 - markerPct}%` }}
          />
        )}
        {m > 0 && markerPct < 100 && (
          <div className="hbar-marker" style={{ left: `${markerPct}%` }} />
        )}
      </div>
    </div>
  )
}

/** Simple proportion bar (0..1) for non-currency values. */
export function RatioBar({ ratio = 0, color = '#38bdf8' }) {
  const pct = Math.max(0, Math.min(100, ratio * 100))
  return (
    <div className="hbar-track slim">
      <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ title, command, children }) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {command ? <code className="empty-cmd">{command}</code> : null}
      {children}
    </div>
  )
}

/** Dark tooltip container used by all Recharts custom tooltips. */
export function TipBox({ title, rows }) {
  return (
    <div className="chart-tip">
      {title ? <div className="tip-title">{title}</div> : null}
      {rows.map((r, i) => (
        <div className="tip-row" key={i}>
          {r.color ? <span className="tip-key" style={{ background: r.color }} /> : null}
          <span className="tip-value">{r.value}</span>
          <span className="tip-label">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export const AXIS_TICK = { fill: '#8494a7', fontSize: 11 }
export const GRID_STROKE = 'rgba(132, 148, 167, 0.25)'
