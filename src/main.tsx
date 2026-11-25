import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status" className="grid min-h-dvh place-items-center bg-[#050C1B] text-sm text-white">FreshBlox · Wczytywanie…</div>}><App /></Suspense>
  </StrictMode>,
)
