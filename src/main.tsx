import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Dev convenience: if the user opens Vite directly (5173), bounce to Netlify
// Dev (8888) where the Functions are served. We BAIL before rendering so the
// splash screen doesn't briefly flash on 5173, then again on 8888 (which is
// what looked like a "double splash + auto reload" to the user).
if (import.meta.env.DEV && window.location.port === '5173') {
  const target = `${window.location.protocol}//${window.location.hostname}:8888${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
  // Hard stop — never render the React tree on the soon-to-be-abandoned page.
  throw new Error('[dev] bouncing to netlify-dev on port 8888');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
