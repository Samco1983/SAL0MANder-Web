import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@design/tokens.css'
import '@design/base.css'
import { applyTheme, readStoredTheme } from '@design/theme'
import { App } from '@app/App'

const restorePagesFallbackPath = () => {
  const fallbackPath = window.sessionStorage.getItem('sal0:spa-path')
  if (!fallbackPath) return

  window.sessionStorage.removeItem('sal0:spa-path')
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/'
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  window.history.replaceState(null, '', `${normalizedBase}${fallbackPath}`)
}

// Stamp the theme before first paint so there is no light/dark flash.
applyTheme(readStoredTheme())
restorePagesFallbackPath()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root was not found in index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
