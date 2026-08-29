import React, { useState } from 'react'
import { useApi, fmtNum } from '../api'
import { Dot } from './ui'

function fmtUptime(s) {
  if (s == null) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `up ${h}h ${m}m` : `up ${m}m ${Math.floor(s % 60)}s`
}

export default function Header({ metrics, tab, onTab }) {
  const { data: ledger } = useApi('/admin/ledger/verify', 3000)
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark',
  )

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('cp-theme', next)
    } catch {
      /* storage unavailable */
    }
    setTheme(next)
  }

  const intact = ledger ? ledger.chain_intact : null

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">ControlPlane</span>
          <span className="brand-tag">episode-level AI assurance</span>
        </div>
        {onTab && (
          <nav className="topnav">
            <button
              className={`topnav-tab ${tab === 'ops' ? 'active' : ''}`}
              onClick={() => onTab('ops')}
            >
              Operations dashboard
            </button>
            <button
              className={`topnav-tab ${tab === 'checker' ? 'active' : ''}`}
              onClick={() => onTab('checker')}
            >
              Response checker
            </button>
          </nav>
        )}
        <div className="topbar-right">
          {metrics && (
            <>
              <span className="badge" title="detector profile">
                profile&nbsp;<b>{metrics.detector_profile || '—'}</b>
              </span>
              <span className="badge" title="model provider">
                provider&nbsp;<b>{metrics.provider || '—'}</b>
              </span>
              <span className="badge" title="probability calibration source">
                calibration&nbsp;<b>{metrics.calibration_source || '—'}</b>
              </span>
            </>
          )}
          {ledger &&
            (intact ? (
              <span className="ledger-chip ok" title="hash-chained decision ledger">
                <Dot color="#22c55e" />
                chain intact · {fmtNum(ledger.entries)} entries
              </span>
            ) : (
              <span className="ledger-chip bad" title="hash-chained decision ledger">
                <Dot color="#ef4444" />
                CHAIN BROKEN
              </span>
            ))}
          {metrics && metrics.uptime_s != null && (
            <span className="uptime-chip" title="gateway process uptime">
              {fmtUptime(metrics.uptime_s)}
            </span>
          )}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title="switch colour theme"
          >
            {theme === 'light' ? '◑ dark' : '◐ light'}
          </button>
        </div>
      </div>
    </header>
  )
}
