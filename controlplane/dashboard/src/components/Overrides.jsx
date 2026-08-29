import React from 'react'
import { useApi, fmtTime, fmtPct } from '../api'
import { SectionLabel, Chip, Mono, EmptyState, RatioBar } from './ui'

const STATE_COLORS = {
  applied: '#22c55e',
  pending_second_approval: '#eab308',
  rejected: '#ef4444',
}

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#8494a7',
}

export default function Overrides() {
  const { data: overrides } = useApi('/admin/overrides', 5000)
  const { data: rates } = useApi('/admin/overrides/rates', 5000)

  const rows = Array.isArray(overrides)
    ? [...overrides].sort((a, b) => (b.ts || 0) - (a.ts || 0))
    : []
  const rateEntries = rates && typeof rates === 'object' ? Object.entries(rates) : []

  return (
    <section>
      <SectionLabel>Override queue</SectionLabel>
      <div className="override-grid">
        <div className="card table-card">
          {rows.length === 0 ? (
            <EmptyState title="No overrides submitted — reviewer decisions appear here with two-person integrity" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Override</th>
                    <th>Decision</th>
                    <th>Reviewer</th>
                    <th>Verdict</th>
                    <th>Severity</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} title={o.note || ''}>
                      <td className="num mono-sm">{fmtTime(o.ts)}</td>
                      <td>
                        <Mono>{o.id}</Mono>
                      </td>
                      <td>
                        <Mono className="muted">{o.decision_id}</Mono>
                      </td>
                      <td>{o.reviewer}</td>
                      <td className="muted">{o.verdict}</td>
                      <td>
                        <Chip color={SEVERITY_COLORS[o.severity] || '#8494a7'}>{o.severity}</Chip>
                      </td>
                      <td>
                        <Chip color={STATE_COLORS[o.state] || '#8494a7'}>{o.state}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="subhead first">Reviewer overturn rates</div>
          <div className="muted-faint small">rubber-stamp watch — confirms vs overturns</div>
          {rateEntries.length === 0 ? (
            <div className="muted-faint pad-sm">no reviewer activity yet</div>
          ) : (
            <div className="rate-list">
              {rateEntries.map(([reviewer, r]) => (
                <div className="rate-row" key={reviewer}>
                  <div className="rate-head">
                    <span>{reviewer}</span>
                    <span className="num">
                      {fmtPct(r.overturn_rate, 0)}{' '}
                      <span className="muted-faint">
                        · {r.overturn} overturn / {r.confirm} confirm
                      </span>
                    </span>
                  </div>
                  <RatioBar ratio={r.overturn_rate || 0} color="#eab308" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
