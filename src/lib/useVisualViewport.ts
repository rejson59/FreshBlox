import { useEffect, useState } from 'react'

export interface ViewportMetrics {
  width: number
  height: number
  offsetTop: number
  isCompactHeight: boolean
  isNarrowWidth: boolean
}

function readViewport(): ViewportMetrics {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, offsetTop: 0, isCompactHeight: false, isNarrowWidth: false }
  }
  const vv = window.visualViewport
  const width = Math.round(vv ? vv.width : window.innerWidth)
  const height = Math.round(vv ? vv.height : window.innerHeight)
  const offsetTop = Math.round(vv ? vv.offsetTop : 0)
  return {
    width,
    height,
    offsetTop,
    isCompactHeight: height < 500,
    isNarrowWidth: width < 520,
  }
}

/**
 * Tracks the exact live visual viewport (crucial on mobile landscape/portrait browsers
 * where address bars or gesture bars can cause `100vh`/`100dvh` to clip bottom controls).
 */
export function useVisualViewport(): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => readViewport())

  useEffect(() => {
    const sync = () => {
      const next = readViewport()
      setMetrics((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop
          ? prev
          : next,
      )
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)

    // Delayed re-check after mobile orientation transitions finish animating
    const onOrient = () => {
      window.setTimeout(sync, 120)
      window.setTimeout(sync, 360)
    }
    window.addEventListener('orientationchange', onOrient)

    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('orientationchange', onOrient)
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
    }
  }, [])

  return metrics
}
