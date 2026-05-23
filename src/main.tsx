import { StrictMode } from 'react'
import { seedTestData } from './db/seed'
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).seedTestData = seedTestData;
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Dev convenience: if the user opens Vite directly (5173), bounce to Netlify Dev (8888)
// where the Functions are served. Avoids the "Gmail OAuth requires the Netlify dev server" alert.
if (import.meta.env.DEV && window.location.port === '5173') {
  const target = `${window.location.protocol}//${window.location.hostname}:8888${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
