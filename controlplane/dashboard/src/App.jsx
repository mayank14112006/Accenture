import React, { useEffect, useState } from 'react'
import { useApi } from './api'
import Header from './components/Header'
import KpiRow from './components/KpiRow'
import DecisionFeed from './components/DecisionFeed'
import EpisodeInspector from './components/EpisodeInspector'
import OperatingPoint from './components/OperatingPoint'
import EvalBoard from './components/EvalBoard'
import PolicyPacks from './components/PolicyPacks'
import Overrides from './components/Overrides'
import CheckerChat from './components/CheckerChat'

export default function App() {
  const [tab, setTab] = useState('ops')
  const { data: metrics } = useApi('/admin/metrics', 3000)
  const episodesApi = useApi(tab === 'ops' ? '/admin/episodes' : null, 5000)
  const policiesApi = useApi(tab === 'ops' ? '/admin/policies' : null, 5000)
  const [selectedEpisode, setSelectedEpisode] = useState(null)

  const episodes = Array.isArray(episodesApi.data) ? episodesApi.data : []

  // auto-select the most recent episode once traffic exists
  useEffect(() => {
    if (!selectedEpisode && episodes.length > 0) {
      setSelectedEpisode(episodes[0].episode_id)
    }
  }, [episodes, selectedEpisode])

  function selectEpisodeAndScroll(id) {
    setSelectedEpisode(id)
    const el = document.getElementById('episode-inspector')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <Header metrics={metrics} tab={tab} onTab={setTab} />
      {tab === 'ops' ? (
        <main className="container">
          <KpiRow metrics={metrics} />
          <DecisionFeed onSelectEpisode={selectEpisodeAndScroll} />
          <EpisodeInspector
            episodes={episodes}
            selectedId={selectedEpisode}
            onSelect={setSelectedEpisode}
          />
          <OperatingPoint onPoliciesChanged={policiesApi.refetch} />
          <EvalBoard />
          <PolicyPacks policies={policiesApi.data} refetch={policiesApi.refetch} />
          <Overrides />
        </main>
      ) : (
        <main className="container container-checker">
          <CheckerChat />
        </main>
      )}
      <footer className="footer">
        ControlPlane prototype — Accenture Innovation Challenge 2026 · all ₹ figures and
        severities are stated assumptions, calibrated in shadow phase on real traffic
      </footer>
    </>
  )
}
