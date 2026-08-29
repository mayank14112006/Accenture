import React from 'react'
import { DECISION_COLORS, DECISION_ORDER, fmtNum, fmtPct } from '../api'
import { StatTile, Dot } from './ui'

export default function KpiRow({ metrics }) {
  const m = metrics || {}
  const decisions = m.decisions || {}
  const total = Object.values(decisions).reduce((a, b) => a + (b || 0), 0)
  const lat = m.latency_ms || {}
  const cost = m.cost_inr || {}
  const parts = DECISION_ORDER.filter((d) => (decisions[d] || 0) > 0)

  return (
    <div className="kpi-row">
      <StatTile label="Decisions" value={fmtNum(total)}>
        {total > 0 && (
          <>
            <div className="mini-seg" aria-hidden="true">
              {parts.map((d) => (
                <div
                  key={d}
                  className="mini-seg-part"
                  style={{
                    flexGrow: decisions[d],
                    background: DECISION_COLORS[d],
                  }}
                  title={`${d} ${decisions[d]}`}
                />
              ))}
            </div>
            <div className="mini-legend">
              {parts.map((d) => (
                <span key={d} className="mini-legend-item" title={d}>
                  <Dot color={DECISION_COLORS[d]} />
                  {d.replace('_', ' ').toLowerCase()} {fmtNum(decisions[d])}
                </span>
              ))}
            </div>
          </>
        )}
      </StatTile>

      <StatTile
        label="Added latency"
        value={
          lat.added_p50 != null ? (
            <>
              {lat.added_p50.toFixed(1)}
              <span className="stat-unit"> / {Number(lat.added_p95 ?? 0).toFixed(1)} ms</span>
            </>
          ) : (
            '—'
          )
        }
        sub="p50 / p95 per checked response"
      />

      <StatTile
        label="Coverage p50"
        value={m.coverage_p50 != null ? fmtPct(m.coverage_p50, 0) : '—'}
        sub="risk-weighted detector recall retained"
      />

      <StatTile
        label="Gate holds"
        value={fmtNum(m.gate_holds ?? 0)}
        sub="irreversible actions held pre-execution"
        valueColor={(m.gate_holds ?? 0) > 0 ? '#a855f7' : undefined}
      />

      <StatTile
        label="Escalations"
        value={fmtNum(m.escalations ?? 0)}
        sub="episodes sent to human review"
        valueColor={(m.escalations ?? 0) > 0 ? '#f97316' : undefined}
      />

      <StatTile
        label="Assurance cost"
        value={
          cost.assurance_spend != null ? (
            <span
              title={`assurance ₹${cost.assurance_spend} vs model ₹${cost.model_spend} — ${cost.assurance_pct_of_model_spend}% (this process, metered)`}
            >
              ₹{cost.assurance_spend}
              <span className="stat-unit"> vs ₹{cost.model_spend} model</span>
            </span>
          ) : (
            '—'
          )
        }
        sub={
          m.provider === 'sim'
            ? 'sim traffic is toy-length — production-shape ratio: 0.04% (load test)'
            : 'metered detector CPU + judge calls vs token spend'
        }
      />
    </div>
  )
}
