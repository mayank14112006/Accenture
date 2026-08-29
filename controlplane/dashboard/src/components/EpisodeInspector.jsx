import React from 'react'
import { useApi, fmtINR, fmtPct, CATEGORY_COLORS, CLAIM_COLORS, SERIES_ORDER } from '../api'
import { SectionLabel, Chip, DecisionChip, HBar, Mono, EmptyState, Swatch } from './ui'

function ClaimStatus({ status }) {
  const c = CLAIM_COLORS[status] || '#8494a7'
  return <Chip color={c}>{status}</Chip>
}

export default function EpisodeInspector({ episodes, selectedId, onSelect }) {
  const detail = useApi(selectedId ? `/admin/episodes/${encodeURIComponent(selectedId)}` : null, 5000)
  const ep = detail.data

  const list = Array.isArray(episodes) ? episodes : []
  const hazard = ep && ep.hazard && typeof ep.hazard === 'object' ? ep.hazard : {}
  const hazardCats = SERIES_ORDER.filter((c) => hazard[c] != null).concat(
    Object.keys(hazard).filter((c) => !SERIES_ORDER.includes(c)),
  )
  const hazardMax = Math.max(1e-9, ...hazardCats.map((c) => Number(hazard[c]) || 0))

  const lossPct =
    ep && ep.budget_inr > 0 ? ((ep.expected_loss_inr || 0) / ep.budget_inr) * 100 : 0

  return (
    <section id="episode-inspector">
      <SectionLabel
        right={
          <select
            className="select"
            value={selectedId || ''}
            onChange={(e) => onSelect(e.target.value || null)}
            aria-label="select episode"
          >
            <option value="">select an episode…</option>
            {list.map((e) => (
              <option key={e.episode_id} value={e.episode_id}>
                {e.episode_id} · {e.use_case} · {e.turns} turn{e.turns === 1 ? '' : 's'}
                {e.escalated ? ' · ESCALATED' : ''}
              </option>
            ))}
          </select>
        }
      >
        Episode inspector
      </SectionLabel>

      {!selectedId || !ep ? (
        <div className="card">
          {selectedId && detail.loading ? (
            <div className="muted-faint pad-sm">loading episode…</div>
          ) : (
            <EmptyState
              title={
                list.length === 0
                  ? 'No episodes yet — episodes appear as multi-turn traffic arrives'
                  : 'Select an episode above, or click an episode id in the live feed'
              }
            />
          )}
        </div>
      ) : (
        <div className="inspector-grid">
          <div className="card">
            <div className="card-title-row">
              <div>
                <span className="card-title">{ep.episode_id}</span>
                <span className="muted sep">·</span>
                <span className="muted">{ep.use_case}</span>
                <span className="muted sep">·</span>
                <span className="muted">
                  identity <Mono>{ep.identity || '—'}</Mono>
                </span>
                <span className="muted sep">·</span>
                <span className="muted">
                  {ep.turns} turn{ep.turns === 1 ? '' : 's'}
                </span>
              </div>
              {ep.escalated && <Chip color="#f97316">ESCALATED</Chip>}
            </div>

            <div className="subhead">Expected-loss budget</div>
            <HBar
              value={ep.expected_loss_inr || 0}
              max={ep.budget_inr || 0}
              color="#38bdf8"
              leftLabel={
                <>
                  {fmtINR(ep.expected_loss_inr)} <span className="muted">expected loss</span>
                </>
              }
              rightLabel={
                <>
                  <b>{lossPct.toFixed(1)}%</b> <span className="muted">of {fmtINR(ep.budget_inr)}</span>
                </>
              }
            />

            <div className="subhead">Identity window ({ep.identity || '—'})</div>
            <HBar
              value={ep.identity_window_total_inr || 0}
              max={ep.identity_window_limit_inr || 0}
              color="#a855f7"
              leftLabel={
                <>
                  {fmtINR(ep.identity_window_total_inr)}{' '}
                  <span className="muted">windowed exposure</span>
                </>
              }
              rightLabel={
                <span className="muted">limit {fmtINR(ep.identity_window_limit_inr)}</span>
              }
            />

            <div className="subhead">Hazard by category</div>
            {hazardCats.length === 0 ? (
              <div className="muted-faint pad-sm">no hazard accrued this episode</div>
            ) : (
              <div className="hazard-list">
                {hazardCats.map((c) => (
                  <div className="hazard-row" key={c}>
                    <span className="hazard-name">
                      <Swatch color={CATEGORY_COLORS[c] || '#8494a7'} />
                      {c}
                    </span>
                    <div className="hazard-bar">
                      <div className="hbar-track slim">
                        <div
                          className="hbar-fill"
                          style={{
                            width: `${Math.min(100, ((Number(hazard[c]) || 0) / hazardMax) * 100)}%`,
                            background: CATEGORY_COLORS[c] || '#8494a7',
                          }}
                        />
                      </div>
                    </div>
                    <span className="hazard-val num">
                      {Number(hazard[c]) <= 1 ? fmtPct(Number(hazard[c]), 1) : Number(hazard[c]).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="subhead first">Claims ledger</div>
            {!Array.isArray(ep.claims) || ep.claims.length === 0 ? (
              <div className="muted-faint pad-sm">no claims extracted yet</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Kind</th>
                      <th>Status</th>
                      <th className="num">Origin turn</th>
                      <th>Grounded in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.claims.map((c, i) => (
                      <tr key={c.canonical || i}>
                        <td>
                          <Mono title={c.canonical}>{c.display || c.canonical}</Mono>
                        </td>
                        <td className="muted">{c.kind || '—'}</td>
                        <td>
                          <ClaimStatus status={c.status} />
                        </td>
                        <td className="num">{c.origin_turn ?? '—'}</td>
                        <td className="muted">{c.grounded_in || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="subhead">Gate events</div>
            {!Array.isArray(ep.gate_events) || ep.gate_events.length === 0 ? (
              <div className="muted-faint pad-sm">no tool calls gated this episode</div>
            ) : (
              <div className="gate-list">
                {ep.gate_events.map((g, i) => (
                  <div className="gate-event" key={i}>
                    <div className="gate-head">
                      <Mono className="gate-tool">{g.tool}</Mono>
                      <DecisionChip decision={g.decision} />
                      <span className="muted-faint">turn {g.turn}</span>
                    </div>
                    <div className="gate-reason">{g.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
