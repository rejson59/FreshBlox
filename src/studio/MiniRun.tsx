import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Check, Flag, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import type { Lang } from '../data/locales'
import { layout, skyline, type Course } from './course'
import { step, spawn } from './physics'
import { paintRun } from './paintRun'
const time = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n) % 60).padStart(2, '0')}.${Math.floor(n * 10) % 10}`
export default function MiniRun({
  course,
  lang,
  onBack,
  onFinish,
  fromStudio,
}: {
  course: Course
  lang: Lang
  onBack: () => void
  onFinish: () => void
  fromStudio: boolean
}) {
  const pl = lang === 'pl',
    canvas = useRef<HTMLCanvasElement>(null),
    inputs = useRef({ left: false, right: false, jump: false }),
    paused = useRef(false),
    finished = useRef(onFinish)
  finished.current = onFinish
  const [isPaused, setPaused] = useState(false),
    [round, setRound] = useState(0),
    [hud, setHud] = useState({ time: 0, progress: 0, falls: 0, done: false }),
    [noCanvas, setNoCanvas] = useState(false)
  const track = useMemo(() => layout(course), [course])
  const pause = (p: boolean) => {
    paused.current = p
    setPaused(p)
    inputs.current = { left: false, right: false, jump: false }
  }
  const restart = () => {
    pause(false)
    setRound((n) => n + 1)
    setHud({ time: 0, progress: 0, falls: 0, done: false })
  }
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext('2d')
    if (!ctx) {
      setNoCanvas(true)
      return
    }
    const r = spawn()
    let id = 0,
      camera = 0,
      prev = performance.now(),
      tick = 0,
      acc = 0,
      width = 0,
      height = 0
    const resize = () => {
      const rect = el.getBoundingClientRect(),
        dpr = Math.min(2, window.devicePixelRatio || 1)
      width = rect.width
      height = rect.height
      el.width = Math.max(1, Math.round(width * dpr))
      el.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintRun(ctx, width, height, camera, r, track, course===skyline)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      if (!paused.current && !r.done) {
        acc += dt
        while (acc >= 1 / 120) {
          step(
            r,
            track,
            Number(inputs.current.right) - Number(inputs.current.left),
            inputs.current.jump,
            1 / 120,
          )
          if (inputs.current.jump && r.vy > 0) inputs.current.jump = false
          acc -= 1 / 120
        }
        camera += (r.x - camera) * Math.min(1, dt * 7)
        paintRun(ctx, width, height, camera, r, track, course===skyline)
        tick += dt
        if (tick > 0.09 || r.done) {
          tick = 0
          setHud({ time: r.elapsed, progress: r.furthest, falls: r.falls, done: r.done })
        }
        if (r.done) {
          finished.current()
          return
        }
      }
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,dialog,[contenteditable=true]')) return
      const down = e.type === 'keydown'
      if (e.code === 'Escape' && down && !e.repeat && !r.done) {
        pause(!paused.current)
        return
      }
      if (paused.current || r.done || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement)?.closest('button') && ['Space', 'Enter'].includes(e.code)) return
      if (!['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) return
      e.preventDefault()
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputs.current.left = down
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') inputs.current.right = down
      else if (down && !e.repeat) inputs.current.jump = true
      else if (!down) inputs.current.jump = false
    }
    const blur = () => {
        if (!r.done) pause(true)
      },
      hide = () => {
        if (document.hidden) blur()
      }
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', hide)
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', hide)
      inputs.current = { left: false, right: false, jump: false }
    }
  }, [track, round, course])
  const control = (kind: 'left' | 'right' | 'jump', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      className="run-key"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        inputs.current[kind] = true
      }}
      onPointerUp={() => (inputs.current[kind] = false)}
      onLostPointerCapture={() => (inputs.current[kind] = false)}
      onPointerCancel={() => (inputs.current[kind] = false)}
    >
      {icon}
    </button>
  )
  return (
    <section className="mini-run">
      <div className="fb-kicker">
        <span /> FRESHBLOX ARCADE <b>/</b> MINI-PARKOUR
      </div>
      <div className="run-heading">
        <h1>{course.title}</h1>
        <button className="fb-btn ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          {pl ? 'Wróć' : 'Back'}
        </button>
      </div>
      <div className="run-viewport">
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label={
            pl
              ? 'Tor Mini-Parkour. Strzałki: ruch. Spacja: skok.'
              : 'Mini-Parkour course. Arrow keys to move, space to jump.'
          }
        />
        <div className="run-score">
          <span>
            <Timer size={16} />
            {time(hud.time)}
          </span>
          <span>
            <Flag size={15} />
            {Math.min(course.pieces.length, hud.progress)} / {course.pieces.length}
          </span>
        </div>
        {!hud.time && !isPaused && !noCanvas && (
          <div className="run-hint">{pl ? 'Rusz w prawo, żeby wystartować →' : 'Move right to start →'}</div>
        )}
        {!hud.done && !isPaused && (
          <button className="run-pause" aria-label={pl ? 'Wstrzymaj' : 'Pause'} onClick={() => pause(true)}>
            <Pause size={18} />
          </button>
        )}
        {(isPaused || hud.done || noCanvas) && (
          <div className="run-overlay">
            <div className="fb-kicker">{hud.done ? <Check size={16} /> : <Pause size={16} />} MINI-PARKOUR</div>
            <h2>
              {noCanvas
                ? pl
                  ? 'Brak obsługi Canvas'
                  : 'Canvas unavailable'
                : hud.done
                  ? pl
                    ? 'Meta!'
                    : 'Finished!'
                  : pl
                    ? 'Pauza'
                    : 'Paused'}
            </h2>
            <p>
              {hud.done
                ? `${time(hud.time)} · ${pl ? 'Upadki' : 'Falls'}: ${hud.falls}`
                : noCanvas
                  ? pl
                    ? 'Otwórz tor w przeglądarce z obsługą Canvas 2D.'
                    : 'Open the course in a browser with Canvas 2D support.'
                  : pl
                    ? 'Tor poczeka na Ciebie.'
                    : 'The course can wait.'}
            </p>
            <div className="fb-row">
              {!noCanvas && (
                <button
                  className="fb-btn primary"
                  onClick={
                    hud.done
                      ? restart
                      : () => {
                          pause(false)
                          canvas.current?.focus()
                        }
                  }
                >
                  {hud.done ? <RotateCcw size={15} /> : <Play size={15} />}{' '}
                  {hud.done ? (pl ? 'Jeszcze raz' : 'Run again') : pl ? 'Wznów' : 'Resume'}
                </button>
              )}
              <button className="fb-btn ghost" onClick={onBack}>
                {fromStudio ? 'Studio' : pl ? 'Odkrywaj' : 'Discover'}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="run-bottom">
        <div>
          <strong>{pl ? 'Sterowanie' : 'Controls'}</strong>
          <p>
            {pl
              ? 'A / D lub strzałki: ruch. Spacja: skok. Fioletowa flaga zapisuje postęp w tej próbie.'
              : 'A / D or arrows: move. Space: jump. Purple flags save your checkpoint in this run.'}
          </p>
        </div>
        <div className="run-controls">
          {control('left', pl ? 'W lewo' : 'Left', <ArrowLeft />)}
          {control('right', pl ? 'W prawo' : 'Right', <ArrowRight />)}
          {control('jump', pl ? 'Skok' : 'Jump', <ArrowUp />)}
        </div>
      </div>
      <p className="fb-footnote">
        {pl
          ? 'Trening solo · Bez czatu, nagród i publicznego rankingu.'
          : 'Solo practice · No chat, rewards or public leaderboard.'}
      </p>
    </section>
  )
}
