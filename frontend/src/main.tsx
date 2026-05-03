import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Keep Railway container warm — ping every 10 minutes
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
if (API_URL) {
  setInterval(() => fetch(`${API_URL}/health`).catch(() => {}), 10 * 60 * 1000)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
