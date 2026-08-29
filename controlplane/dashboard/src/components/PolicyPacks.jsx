import React, { useState } from 'react'
import { postJson, fmtINR, fmtNum, CATEGORY_COLORS, SERIES_ORDER } from '../api'
import { SectionLabel, Chip, Mono, Swatch, EmptyState } from './ui'

const JURISDICTIONS = ['IN', 'EU', 'US']

function PackCard({ name, pack, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)

  async function switchJurisdiction(code) {
    if (busy || code === pack.jurisdiction) return
    setBusy(code)
    setErr(null)
    try {
      await postJson(`/admin/policies/${encodeURIComponent(name)}/jurisdiction`, {
        jurisdiction: code,
      })
      if (onChanged) await onChanged()
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(null)
    }
  }

  const thresholds = pack.thresholds || {}
  const cats = SERIES_ORDER.filter((c) => thresholds[c]).concat(
    Object.keys(thresholds).filter((c) => !SERIES_ORDER.includes(c)),
  )

  return (
    <div className="card pack-card">
      <div className="pack-head">
        <span className="card-title">{name}</span>
        <span className="version-pill" key={`v${pack.version}`}>
          v{pack.version}
        </span>
        <Chip color="#38bdf8">{pack.jurisdiction || '—'}</Chip>
        {pack.signed ? (
          <Chip color="#22c55e">signed</Chip>
        ) : (
          <Chip color="#8494a7">unsigned</Chip>
        )}
      </div>

      <div className="pack-meta">
        <div className="pack-meta-row">
          <span className="meta-key">mode</span>
          <span className="meta-val">{pack.mode}</span>
        </div>
        <div className="pack-meta-row">
          <span className="meta-key">failure mode</span>
          <span className="meta-val">
            <Chip color={pack.failure_mode === 'fail_closed' ? '#ef4444' : '#22c55e'}>
              {pack.failure_mode}
            </Chip>
          </span>
        </div>
        <div className="pack-meta-row">
          <span className="meta-key">latency budget</span>
          <span className="meta-val num">{fmtNum(pack.latency_budget_ms)} ms</span>
        </div>
        <div className="pack-meta-row">
          <span className="meta-key">episode budget</span>
          <span className="meta-val num">
            {fmtINR(pack.episode_budget_inr)}{' '}
            <span className="muted-faint">@ p{pack.budget_percentile}</span>
          </span>
        </div>
        <div className="pack-meta-row">
          <span className="meta-key">pack hash</span>
          <span className="meta-val">
            <Mono title={pack.pack_hash}>{(pack.pack_hash || '').slice(0, 12)}</Mono>
          </span>
        </div>
      </div>

      <table className="thresholds-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Flag</th>
            <th className="num">Block</th>
            <th className="num">Severity</th>
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c}>
              <td>
                <Swatch color={CATEGORY_COLORS[c] || '#8494a7'} />
                {c}
              </td>
              <td className="num">{thresholds[c].flag != null ? thresholds[c].flag.toFixed(2) : '—'}</td>
              <td className="num">{thresholds[c].block != null ? thresholds[c].block.toFixed(2) : '—'}</td>
              <td className="num">
                {pack.severities_inr && pack.severities_inr[c] != null
                  ? fmtINR(pack.severities_inr[c])
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="jur-row">
        <span className="meta-key">jurisdiction</span>
        <div className="jur-buttons">
          {JURISDICTIONS.map((code) => (
            <button
              key={code}
              type="button"
              className={`btn jur ${pack.jurisdiction === code ? 'active' : ''}`}
              disabled={busy != null}
              onClick={() => switchJurisdiction(code)}
            >
              {busy === code ? '…' : code}
            </button>
          ))}
        </div>
      </div>
      {err && <div className="applied-err">{err}</div>}
    </div>
  )
}

export default function PolicyPacks({ policies, refetch }) {
  const packs = policies && policies.packs ? policies.packs : null
  return (
    <section>
      <SectionLabel
        right={
          policies && Array.isArray(policies.refusals) && policies.refusals.length > 0 ? (
            <span className="applied-err">
              {policies.refusals.length} pack refusal(s) — check server log
            </span>
          ) : null
        }
      >
        Policy packs
      </SectionLabel>
      {!packs ? (
        <div className="card">
          <EmptyState title="Loading policy packs…" />
        </div>
      ) : (
        <div className="pack-grid">
          {Object.entries(packs).map(([name, pack]) => (
            <PackCard key={name} name={name} pack={pack} onChanged={refetch} />
          ))}
        </div>
      )}
    </section>
  )
}
