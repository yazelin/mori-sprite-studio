import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAppStore } from '@/store'
import { loadStore, debouncedSave } from '@/store/persist'

async function bootstrap() {
  const persisted = await loadStore()
  if (persisted) {
    useAppStore.setState((s) => ({
      project: persisted.project ?? s.project,
      prompts: persisted.prompts ?? s.prompts,
      provider: persisted.provider ?? s.provider,
      chroma: persisted.chroma ?? s.chroma,
    }))
  }

  useAppStore.subscribe((s) => {
    debouncedSave({
      project: s.project,
      prompts: s.prompts,
      provider: s.provider,
      chroma: s.chroma,
    })
  })

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
