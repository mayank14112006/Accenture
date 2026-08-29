import React from 'react'
import { useApi, fmtTime, VERDICT_COLORS } from '../api'
import { SectionLabel, DecisionChip, RiskChip, Dot, Mono, EmptyState } from './ui'

export default function DecisionFeed({ onSelectEpisode }) {
  const { data, loading } = useApi('/admin/decisions?limit=30', 2500)

  const rows = Array.isArray(data) ? [...data].sort((a, b) => (b.ts || 0) - (a.ts || 0)) : []

  return (
    <section>
      <SectionLabel right={<span className="live-dot">live · 2.5s</span>}>
        Live decision feed
      </SectionLabel>
      <div className="card table-card">
        {rows.length === 0 ? (
          <EmptyState title={loading ? 'Connecting…' : 'No decisions yet — send traffic through /v1/chat/completions'} />
        ) : (
          <div className="table-scroll">
            <table className="feed-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Use case</th>
                  <th className="num">Turn</th>
                  <th>Decision</th>
                  <th>Risk</th>
                  <th>Grounding</th>
                  <th className="num">Coverage</th>
                  <th>Policy</th>
                  <th>Episode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const risks = Array.isArray(d.risk) ? d.risk.filter((r) => (r.prob || 0) > 0) : []
                  return (
                    <tr key={d.id}>
                      <td className="num mono-sm">{fmtTime(d.ts)}</td>
                      <td className="muted">{d.use_case}</td>
                      <td className="num">{d.turn ?? '—'}</td>
                      <td>
                        <DecisionChip decision={d.decision} />
                      </td>
                      <td>
                        <div className="risk-cell">
                          {risks.length === 0 ? (
                            <span className="muted-faint">clean</span>
                          ) : (
                            risks.map((r) => (
                              <RiskChip key={r.category} category={r.category} prob={r.prob} />
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        {d.grounding_verdict ? (
                          <span className="verdict">
                            <Dot color={VERDICT_COLORS[d.grounding_verdict] || '#8494a7'} />
                            {d.grounding_verdict}
                          </span>
                        ) : (
                          <span className="muted-faint">—</span>
                        )}
                      </td>
                      <td className="num">{d.coverage != null ? d.coverage.toFixed(2) : '—'}</td>
                      <td>
                        <Mono
                          className="policy-ref"
                          title={`${d.policy_name} · ${(d.pack_hash || '').slice(0, 12)} · mode ${d.mode}`}
                        >
                          {d.policy_name}@v{d.policy_version}
                        </Mono>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="episode-link mono"
                          onClick={() => onSelectEpisode && onSelectEpisode(d.episode_id)}
                          title="open in episode inspector"
                        >
                          {d.episode_id}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
