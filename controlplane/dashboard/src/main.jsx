import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// apply the saved theme before first paint (no flash of wrong theme)
try {
  const saved = localStorage.getItem('cp-theme')
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved
  }
} catch {
  /* storage unavailable — default dark */
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
