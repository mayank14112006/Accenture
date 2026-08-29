import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApi, postJson, CATEGORY_COLORS, SERIES_ORDER, fmtPct } from '../api'
import { SectionLabel, Swatch, EmptyState, TipBox, AXIS_TICK, GRID_STROKE } from './ui'

function SweepTip({ active, label, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const byCat = {}
  for (const p of payload) {
    const [cat, kind] = String(p.dataKey).split('__')
    if (!byCat[cat]) byCat[cat] = {}
    byCat[cat][kind] = p.value
  }
  const rows = SERIES_ORDER.filter((c) => byCat[c]).map((c) => ({
    color: CATEGORY_COLORS[c],
    value: `${byCat[c].recall != null ? byCat[c].recall.toFixed(3) : '—'} · fp ${
      byCat[c].fp != null ? byCat[c].fp.toFixed(3) : '—'
    }`,
    label: c,
  }))
  return <TipBox title={`flag threshold ${Number(label).toFixed(2)}`} rows={rows} />
}

export default function OperatingPoint({ onPoliciesChanged }) {
  const sweep = useApi('/admin/evals/sweep', 0)
  const [targetPct, setTargetPct] = useState(5)
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [pack, setPack] = useState('customer_support')
  const [applyState, setApplyState] = useState(null) // {pack, ts} | {error}
  const [applying, setApplying] = useState(false)
  const timer = useRef(null)

  // debounced suggestion fetch
  useEffect(() => {
    setPending(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const r = await postJson('/admin/operating-point', { target_fp_rate: targetPct / 100 })
        setResult(r)
      } catch (e) {
        setResult({ error: String(e.message || e) })
      } finally {
        setPending(false)
      }
    }, 350)
    return () => timer.current && clearTimeout(timer.current)
  }, [targetPct])

  async function applyToPack() {
    setApplying(true)
    setApplyState(null)
    try {
      const r = await postJson('/admin/operating-point', {
        target_fp_rate: targetPct / 100,
        pack,
        apply: true,
      })
      setApplyState(r.applied ? { pack, ts: Date.now() } : { error: 'not applied' })
      if (r.applied && onPoliciesChanged) onPoliciesChanged()
    } catch (e) {
      setApplyState({ error: String(e.message || e) })
    } finally {
      setApplying(false)
    }
  }

  // merge per-category sweep arrays into rows keyed by threshold
  const sweepRows = useMemo(() => {
    const cats = sweep.data && sweep.data.categories ? sweep.data.categories : {}
    const byThr = new Map()
    for (const cat of Object.keys(cats)) {
      if (!Array.isArray(cats[cat])) continue
      for (const pt of cats[cat]) {
        if (!pt || pt.threshold == null) continue
        const row = byThr.get(pt.threshold) || { threshold: pt.threshold }
        row[`${cat}__recall`] = pt.recall
        row[`${cat}__fp`] = pt.fp_rate
        byThr.set(pt.threshold, row)
      }
    }
    return [...byThr.values()].sort((a, b) => a.threshold - b.threshold)
  }, [sweep.data])

  const sweepCats = useMemo(() => {
    const cats = sweep.data && sweep.data.categories ? sweep.data.categories : {}
    return SERIES_ORDER.filter((c) => Array.isArray(cats[c]))
  }, [sweep.data])

  const suggested = result && result.suggested_flag_thresholds ? result.suggested_flag_thresholds : null
  const suggestedCats = suggested
    ? SERIES_ORDER.filter((c) => suggested[c] && typeof suggested[c] === 'object')
    : []

  return (
    <section>
      <SectionLabel>Operating-point console</SectionLabel>
      <div className="op-grid">
        <div className="card">
          <div className="op-slider-row">
            <label className="op-label" htmlFor="fp-slider">
              Target benign flag rate
            </label>
            <span className="op-value">{targetPct.toFixed(1)}%</span>
          </div>
          <input
            id="fp-slider"
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={targetPct}
            onChange={(e) => setTargetPct(Number(e.target.value))}
          />
          <div className="op-scale">
            <span>0%</span>
            <span>10%</span>
            <span>20%</span>
          </div>

          <div className={`op-table ${pending ? 'dimmed' : ''}`}>
            {result && result.error ? (
              <EmptyState title="Operating-point sweep unavailable" command="python -m evals.run" />
            ) : !suggested ? (
              <div className="muted-faint pad-sm">computing suggested thresholds…</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Flag threshold</th>
                    <th className="num">Expected FP rate</th>
                    <th className="num">Expected recall</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestedCats.map((c) => (
                    <tr key={c}>
                      <td>
                        <Swatch color={CATEGORY_COLORS[c]} />
                        {c}
                      </td>
                      <td className="num">{Number(suggested[c].flag).toFixed(2)}</td>
                      <td className="num">{fmtPct(suggested[c].expected_fp_rate, 2)}</td>
                      <td className="num">{fmtPct(suggested[c].expected_recall, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="apply-row">
            <select
              className="select"
              value={pack}
              onChange={(e) => setPack(e.target.value)}
              aria-label="policy pack to apply thresholds to"
            >
              <option value="customer_support">customer_support</option>
              <option value="internal_copilot">internal_copilot</option>
              <option value="decision_support">decision_support</option>
            </select>
            <button type="button" className="btn primary" onClick={applyToPack} disabled={applying}>
              {applying ? 'Applying…' : 'Apply to pack'}
            </button>
            {applyState && applyState.pack && (
              <span className="applied-ok">applied ✓ {applyState.pack} thresholds updated</span>
            )}
            {applyState && applyState.error && (
              <span className="applied-err">{applyState.error}</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="chart-title-row">
            <span className="card-title">Recall vs benign FP rate by flag threshold</span>
            <span className="chart-note">solid recall · dashed benign FP rate</span>
          </div>
          {sweep.status === 404 || (sweep.error && !sweep.data) ? (
            <EmptyState
              title="No eval sweep yet — run the offline eval harness first"
              command="python -m evals.run"
            />
          ) : sweepRows.length === 0 ? (
            <div className="muted-faint pad-sm">loading sweep…</div>
          ) : (
            <>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={sweepRows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="threshold"
                      type="number"
                      domain={[0, 1]}
                      ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: GRID_STROKE }}
                      label={{
                        value: 'fused-probability flag threshold',
                        position: 'insideBottom',
                        offset: -2,
                        fill: '#8494a7',
                        fontSize: 11,
                      }}
                      height={36}
                    />
                    <YAxis
                      domain={[0, 1.04]}
                      ticks={[0, 0.25, 0.5, 0.75, 1]}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                    />
                    <Tooltip content={<SweepTip />} cursor={{ stroke: '#2a3644' }} />
                    {suggestedCats.map((c) => (
                      <ReferenceLine
                        key={`ref-${c}`}
                        x={suggested[c].flag}
                        stroke={CATEGORY_COLORS[c]}
                        strokeOpacity={0.35}
                        strokeWidth={1}
                      />
                    ))}
                    {sweepCats.map((c) => (
                      <Line
                        key={`${c}-fp`}
                        dataKey={`${c}__fp`}
                        stroke={CATEGORY_COLORS[c]}
                        strokeWidth={1.25}
                        strokeOpacity={0.5}
                        strokeDasharray="4 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                    {sweepCats.map((c) => (
                      <Line
                        key={`${c}-recall`}
                        dataKey={`${c}__recall`}
                        stroke={CATEGORY_COLORS[c]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                {sweepCats.map((c) => (
                  <span className="legend-item" key={c}>
                    <span className="legend-line" style={{ background: CATEGORY_COLORS[c] }} />
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
