import React, { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApi, CATEGORY_COLORS, SERIES_ORDER, fmtNum, fmtPct } from '../api'
import { SectionLabel, StatTile, EmptyState, TipBox, Swatch, AXIS_TICK, GRID_STROKE } from './ui'

const FP_GRAY = '#64748b'

function ci(pair) {
  if (!Array.isArray(pair) || pair.length < 2 || pair[0] == null) return null
  return `[${Number(pair[0]).toFixed(3)}, ${Number(pair[1]).toFixed(3)}]`
}

function RecallTip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  const rows = [
    {
      color: CATEGORY_COLORS[d.cat],
      value: fmtPct(d.recall, 1),
      label: `recall — caught ${fmtNum(d.caught)}/${fmtNum(d.injected)}${
        ci(d.recall_ci) ? ` · 95% CI ${ci(d.recall_ci)}` : ''
      }`,
    },
    {
      color: FP_GRAY,
      value: fmtPct(d.fp_rate, 2),
      label: `benign FP — ${fmtNum(d.false_flags)}/${fmtNum(d.benign)}${
        ci(d.fp_ci) ? ` · 95% CI ${ci(d.fp_ci)}` : ''
      }`,
    },
  ]
  return <TipBox title={d.cat} rows={rows} />
}

function ReliabilityTip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <TipBox
      title={`bin ${d.bin} · n=${fmtNum(d.n)}`}
      rows={[
        { color: '#38bdf8', value: d.empirical.toFixed(3), label: 'empirical failure rate' },
        { color: '#8494a7', value: d.mean_pred.toFixed(3), label: 'mean predicted' },
      ]}
    />
  )
}

export default function EvalBoard() {
  const { data, status, error, loading } = useApi('/admin/evals', 0)
  const t = data && data.test ? data.test : null

  const perCat = useMemo(() => {
    if (!t || !t.per_category) return []
    return SERIES_ORDER.filter((c) => t.per_category[c]).map((c) => {
      const p = t.per_category[c]
      return {
        cat: c,
        recall: p.recall,
        fp_rate: p.fp_rate,
        caught: p.caught,
        injected: p.injected,
        recall_ci: p.recall_ci95,
        false_flags: p.false_flags,
        benign: p.benign,
        fp_ci: p.fp_rate_ci95,
      }
    })
  }, [t])

  const bins = useMemo(() => {
    if (!t || !Array.isArray(t.reliability_bins)) return []
    return t.reliability_bins
      .filter(
        (b) =>
          b &&
          typeof b === 'object' &&
          (b.n || 0) > 0 &&
          b.mean_pred != null &&
          b.empirical != null,
      )
      .map((b) => ({ ...b, mean_pred: Number(b.mean_pred), empirical: Number(b.empirical) }))
      .sort((a, b) => a.mean_pred - b.mean_pred)
  }, [t])

  if (loading) {
    return (
      <section>
        <SectionLabel>Eval scoreboard</SectionLabel>
        <div className="card">
          <div className="muted-faint pad-sm">loading eval results…</div>
        </div>
      </section>
    )
  }

  if (!t) {
    return (
      <section>
        <SectionLabel>Eval scoreboard</SectionLabel>
        <div className="card">
          <EmptyState
            title={
              status === 404 || error
                ? 'No eval results yet — run the offline eval harness, then reload'
                : 'Eval payload missing test split'
            }
            command="python -m evals.run"
          />
        </div>
      </section>
    )
  }

  const ag = t.action_gate || {}
  const ab = t.abstention || {}

  return (
    <section>
      <SectionLabel
        right={
          <span className="muted-faint">
            {fmtNum(t.records)} records · {data.detector_profile || ''} profile
          </span>
        }
      >
        Eval scoreboard
      </SectionLabel>

      <div className="eval-grid">
        <div className="card">
          <div className="chart-title-row">
            <span className="card-title">Recall and benign FP rate per category</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={perCat} margin={{ top: 18, right: 8, bottom: 0, left: 0 }} barGap={2}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="cat"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip content={<RecallTip />} cursor={{ fill: 'rgba(138,148,167,0.06)' }} />
                <Bar dataKey="recall" maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {perCat.map((d) => (
                    <Cell key={d.cat} fill={CATEGORY_COLORS[d.cat]} />
                  ))}
                  <LabelList
                    dataKey="recall"
                    position="top"
                    formatter={(v) => Number(v).toFixed(2)}
                    style={{ fill: '#d7dee8', fontSize: 11 }}
                  />
                </Bar>
                <Bar
                  dataKey="fp_rate"
                  fill={FP_GRAY}
                  maxBarSize={22}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-swatch-multi">
                {perCat.map((d) => (
                  <span key={d.cat} style={{ background: CATEGORY_COLORS[d.cat] }} />
                ))}
              </span>
              recall <span className="muted-faint">(category color)</span>
            </span>
            <span className="legend-item">
              <Swatch color={FP_GRAY} />
              benign FP rate
            </span>
          </div>
          {t.per_category && t.per_category.bias ? (
            <div className="muted-faint pad-sm">bias recall: {t.per_category.bias.recall}</div>
          ) : null}
        </div>

        <div className="card">
          <div className="chart-title-row">
            <span className="card-title">Reliability diagram</span>
            <span className="chart-note">fused probability vs empirical failure rate</span>
          </div>
          {bins.length === 0 ? (
            <div className="muted-faint pad-sm">no populated reliability bins</div>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={bins} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="mean_pred"
                    type="number"
                    domain={[0, 1]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID_STROKE }}
                    label={{
                      value: 'mean predicted probability',
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
                  <Tooltip content={<ReliabilityTip />} cursor={{ stroke: '#2a3644' }} />
                  <ReferenceLine
                    segment={[
                      { x: 0, y: 0 },
                      { x: 1, y: 1 },
                    ]}
                    stroke="#41506380"
                    strokeDasharray="5 4"
                    ifOverflow="hidden"
                  />
                  <Line
                    dataKey="empirical"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={{ r: 4, fill: '#38bdf8', stroke: '#11161d', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#38bdf8', stroke: '#11161d', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="eval-tiles">
          <StatTile
            label="Action gate"
            value={
              ag.tainted_total != null ? `${fmtNum(ag.held_tainted)}/${fmtNum(ag.tainted_total)}` : '—'
            }
            sub={
              ag.tainted_total != null
                ? `tainted actions held · ${fmtNum(ag.held_clean)}/${fmtNum(ag.clean_total)} false holds${
                    ci(ag.tainted_hold_ci95) ? ` · 95% CI ${ci(ag.tainted_hold_ci95)}` : ''
                  }`
                : 'no gate cases in eval set'
            }
            valueColor="#a855f7"
          />
          <StatTile
            label="Abstention"
            value={ab.rate != null ? fmtPct(ab.rate, 1) : '—'}
            sub={
              ab.total != null
                ? `${fmtNum(ab.correct)}/${fmtNum(ab.total)} correct abstentions on unanswerable cases`
                : ''
            }
          />
          <StatTile
            label="ECE"
            value={t.ece != null ? t.ece.toFixed(3) : '—'}
            sub="expected calibration error over fused probabilities"
          />
          <StatTile
            label="Eval latency added"
            value={
              t.latency_ms && t.latency_ms.added_p50 != null ? (
                <>
                  {t.latency_ms.added_p50.toFixed(1)}
                  <span className="stat-unit"> / {t.latency_ms.added_p95.toFixed(1)} ms</span>
                </>
              ) : (
                '—'
              )
            }
            sub={`p50 / p95 over ${fmtNum(t.records)} records · ${t.wall_seconds != null ? t.wall_seconds + 's wall' : ''}`}
          />
        </div>
      </div>
    </section>
  )
}
