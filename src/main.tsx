import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@design/tokens.css'
import '@design/base.css'
import { applyTheme, readStoredTheme } from '@design/theme'
import { App } from '@app/App'

// Stamp the theme before first paint so there is no light/dark flash.
applyTheme(readStoredTheme())

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root was not found in index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
