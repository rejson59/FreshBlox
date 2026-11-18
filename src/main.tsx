import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div role="status" className="grid min-h-dvh place-items-center bg-[#131417] text-sm text-white">FreshBlox · Wczytywanie…</div>}><App /></Suspense>
  </StrictMode>,
)
