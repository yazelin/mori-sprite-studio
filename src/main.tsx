import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAppStore } from '@/store'
import { loadStore, loadProviderSettings, saveProviderSettings, debouncedSave, flushPendingSave } from '@/store/persist'

async function bootstrap() {
  const persisted = await loadStore()
  const localProvider = loadProviderSettings()
  if (persisted || localProvider) {
    useAppStore.setState((s) => ({
      project: persisted?.project ?? s.project,
      prompts: persisted?.prompts ?? s.prompts,
      provider: localProvider ?? persisted?.provider ?? s.provider,
      chroma: persisted?.chroma ?? s.chroma,
    }))
  }

  if (!localProvider) {
    try {
      saveProviderSettings(persisted?.provider ?? useAppStore.getState().provider)
    } catch (e) {
      console.error('provider settings save failed', e)
    }
  }

  useAppStore.subscribe((s) => {
    debouncedSave({
      project: s.project,
      prompts: s.prompts,
      provider: s.provider,
      chroma: s.chroma,
    })
  })

  window.addEventListener('pagehide', flushPendingSave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave()
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
