import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Copy, Check, LogIn, Swords, Users, WifiOff } from 'lucide-react'
import type { Lang } from '../../data/locales'
import {
  COUNTDOWN,
  WIN_SCORE,
  botInput,
  contactImpulse,
  createMatch,
  shove,
  stepMatch,
  type BotLevel,
  type BrawlClass,
  type InputFrame,
  type Match,
  type Side,
} from './sim'
import { paintBrawl, type Palette } from './paint'
import { DuelNet, makeRoomCode, normalizeRoom, type DuelPacket } from './net'
import './brawl.css'

type Stage = 'pick' | 'fight'
type Mode = 'bot' | 'online'

const ZERO: InputFrame = { dx: 0, dy: 0, dash: false }
const LIGHT: Palette = {
  paper: '#eef6fd',
  card: '#ffffff',
  ink: '#0a1b2e',
  line: '#c9dfef',
  hot: '#0284c7',
  hotDeep: '#0369a1',
  muted: '#6e8ba6',
  p1: '#38bdf8',
  p2: '#8ed8b0',
}
const DARK: Palette = {
  ...LIGHT,
  paper: '#071524',
  card: '#0e2033',
  ink: '#eaf4fd',
  line: '#22384c',
  hot: '#38bdf8',
  hotDeep: '#0284c7',
  muted: '#7e9bb4',
}

interface Hud {
  score: [number, number]
  round: number
  phase: Match['phase']
  t: number
  dash: number
  ring: number
}

export default function BlokBrawl({
  lang,
  name,
  onBack,
  theme = 'dark',
}: {
  lang: Lang
  name: string | null
  onBack: () => void
  /** FreshBlox theme mode; the arena carries its own dark/light palette for each. */
  theme?: 'dark' | 'light'
}) {
  const pl = lang === 'pl'
  const [stage, setStage] = useState<Stage>('pick')
  const [mode, setMode] = useState<Mode>('bot')
  const [botLevel, setBotLevel] = useState<BotLevel>(1)
  const [playerClass, setPlayerClass] = useState<BrawlClass>('brawler')
  const [room, setRoom] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [oppName, setOppName] = useState<string | null>(null)
  const [hud, setHud] = useState<Hud>({
    score: [0, 0],
    round: 1,
    phase: 'countdown',
    t: COUNTDOWN,
    dash: 0,
    ring: 1,
  })

  const canvas = useRef<HTMLCanvasElement>(null),
    match = useRef<Match>(createMatch()),
    keys = useRef({ left: false, right: false, up: false, down: false, dash: false }),
    stick = useRef({ x: 0, y: 0, active: false }),
    net = useRef<DuelNet | null>(null),
    remote = useRef<{ x: number; y: number; vx: number; vy: number; face: number; dashCd: number } | null>(
      null,
    ),
    opp = useRef<{ name: string; tie: number } | null>(null),
    selfTie = useRef(Math.random()),
    pal = useRef<Palette>(LIGHT),
    level = useRef<BotLevel>(1),
    stageRef = useRef<Stage>('pick'),
    modeRef = useRef<Mode>('bot')

  level.current = botLevel
  stageRef.current = stage
  modeRef.current = mode

  const myName = name?.trim() || (pl ? 'Ty' : 'You')
  const rivalName = mode === 'bot' ? (pl ? 'Bot' : 'Bot') : (oppName ?? (pl ? '…' : '…'))
  const names = useMemo<[string, string]>(() => [myName, rivalName], [myName, rivalName])

  const refreshPalette = useCallback(() => {
    pal.current = theme === 'light' ? LIGHT : DARK
  }, [theme])

  /* ------------------------------------------------------------------ input */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.code
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault()
      if (k === 'ArrowLeft' || k === 'KeyA') keys.current.left = true
      if (k === 'ArrowRight' || k === 'KeyD') keys.current.right = true
      if (k === 'ArrowUp' || k === 'KeyW') keys.current.up = true
      if (k === 'ArrowDown' || k === 'KeyS') keys.current.down = true
      if (k === 'Space' || k === 'ShiftLeft' || k === 'KeyJ') keys.current.dash = true
    }
    const up = (e: KeyboardEvent) => {
      const k = e.code
      if (k === 'ArrowLeft' || k === 'KeyA') keys.current.left = false
      if (k === 'ArrowRight' || k === 'KeyD') keys.current.right = false
      if (k === 'ArrowUp' || k === 'KeyW') keys.current.up = false
      if (k === 'ArrowDown' || k === 'KeyS') keys.current.down = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const readInput = (): InputFrame => {
    let dx = Number(keys.current.right) - Number(keys.current.left)
    let dy = Number(keys.current.down) - Number(keys.current.up)
    if (stick.current.active) {
      dx = stick.current.x
      dy = stick.current.y
    }
    const dash = keys.current.dash
    keys.current.dash = false
    return { dx, dy, dash }
  }

  /* ------------------------------------------------------------------- loop */
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    refreshPalette()
    const palTimer = window.setInterval(refreshPalette, 500)

    let width = 0,
      height = 0,
      raf = 0,
      last = performance.now(),
      sendAcc = 0,
      hudAcc = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      const rect = el.getBoundingClientRect()
      width = rect.width
      height = rect.height
      el.width = Math.max(1, Math.round(width * dpr))
      el.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const m = match.current
      const online = modeRef.current === 'online'
      const playing = stageRef.current === 'fight'

      if (playing) {
        const mine = readInput()
        const rival: InputFrame =
          online ? ZERO : botInput(m, 1, level.current)

        // The remote fighter is owned by its own client — pull it towards the
        // latest received pose instead of simulating it.
        if (online && remote.current) {
          const r = remote.current,
            f = m.f[1],
            k = Math.min(1, dt * 20)
          f.x += (r.x - f.x) * k
          f.y += (r.y - f.y) * k
          f.vx = r.vx
          f.vy = r.vy
          f.face = r.face
          f.dashCd = r.dashCd
          // Their own client reports their fall; we only score it when the packet arrives.
        }

        const wasLive = m.phase === 'live'
        stepMatch(m, dt, [mine, rival], { skipCollide: online })
        if (online && wasLive && m.phase === 'ko' && m.koSide === 0) {
          net.current?.send({ t: 'fall' })
        }
        if (online && wasLive && m.phase === 'live') {
          // Host resolves contact so both clients apply exactly one shove.
          const host = !opp.current || selfTie.current < opp.current.tie
          if (host) {
            const hit = contactImpulse(m.f[0], m.f[1])
            if (hit) {
              shove(m.f[0], hit.nx, hit.ny, hit.j, hit.heavy, -1)
              net.current?.send({
                t: 'hit',
                jx: hit.nx * hit.j * hit.heavy,
                jy: hit.ny * hit.j * hit.heavy,
              })
            }
          }
        }
        m.ghosts = m.ghosts.filter((g) => g.life > 0)

        if (online && net.current) {
          sendAcc += dt
          if (sendAcc > 1 / 15) {
            sendAcc = 0
            const f = m.f[0]
            net.current.send({
              t: 'state',
              x: f.x,
              y: f.y,
              vx: f.vx,
              vy: f.vy,
              face: f.face,
              dashCd: f.dashCd,
              score: m.score[0],
              round: m.round,
            })
          }
        }
      } else {
        stepMatch(m, dt, [ZERO, ZERO], { skipCollide: false })
      }

      paintBrawl(ctx, width, height, m, pal.current, names)

      hudAcc += dt
      if (hudAcc > 0.09) {
        hudAcc = 0
        setHud({
          score: [m.score[0], m.score[1]],
          round: m.round,
          phase: m.phase,
          t: m.t,
          dash: Math.max(0, m.f[0].dashCd),
          ring: m.ring,
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.clearInterval(palTimer)
    }
  }, [names, refreshPalette])

  /* -------------------------------------------------------------------- net */
  const startOnline = (existing?: string) => {
    const code = existing || makeRoomCode()
    setRoom(code)
    setMode('online')
    setOppName(null)
    opp.current = null
    remote.current = null
    match.current = createMatch()
    setStage('fight')

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const client = new DuelNet(code, id, (packet: DuelPacket) => {
      const m = match.current
      if (packet.t === 'hello') {
        if (!opp.current) {
          opp.current = { name: packet.name, tie: packet.tie }
          setOppName(packet.name)
          m.remoteSide = 1
          m.score = [0, 0]
          m.round = 1
          m.f = [m.f[0], m.f[1]]
          m.f[0].x = -0.45
          m.f[0].y = 0
          m.f[0].vx = 0
          m.f[0].vy = 0
          m.ring = 1
          m.roundT = 0
          m.phase = 'countdown'
          m.t = COUNTDOWN
        }
        client.send({ t: 'hello', name: myName, tie: selfTie.current })
      } else if (packet.t === 'state') {
        remote.current = {
          x: packet.x,
          y: packet.y,
          vx: packet.vx,
          vy: packet.vy,
          face: packet.face,
          dashCd: packet.dashCd,
        }
      } else if (packet.t === 'hit') {
        m.f[0].vx += packet.jx
        m.f[0].vy += packet.jy
        m.f[0].stun = Math.max(m.f[0].stun, 0.16)
        m.f[0].flash = 0.18
      } else if (packet.t === 'fall') {
        if (m.phase === 'live') {
          m.phase = 'ko'
          m.t = 1.9
          m.koSide = 1
          m.score[0] += 1
        }
      } else if (packet.t === 'rematch') {
        match.current = createMatch()
        match.current.remoteSide = 1
      } else if (packet.t === 'bye') {
        opp.current = null
        remote.current = null
        setOppName(null)
      }
    })
    client.connect()
    net.current?.close()
    net.current = client
    const hello = window.setInterval(() => {
      if (!opp.current) client.send({ t: 'hello', name: myName, tie: selfTie.current })
    }, 600)
    ;(client as unknown as { _hello?: number })._hello = hello
  }

  useEffect(
    () => () => {
      const c = net.current as unknown as { _hello?: number } | null
      if (c?._hello) window.clearInterval(c._hello)
      net.current?.close()
      net.current = null
    },
    [],
  )

  const startBot = () => {
    setMode('bot')
    setStage('fight')
    const m = createMatch()
    m.f[0].klass = playerClass
    m.f[1].klass = (['brawler', 'ninja', 'mage'] as BrawlClass[])[(botLevel + 1) % 3]
    m.remoteSide = null
    match.current = m
  }

  const restart = () => {
    const m = createMatch()
    m.f[0].klass = playerClass
    m.f[1].klass = (['brawler', 'ninja', 'mage'] as BrawlClass[])[(botLevel + 1) % 3]
    match.current = m
    if (mode === 'online') {
      match.current.remoteSide = 1
      net.current?.send({ t: 'rematch' })
    }
  }

  const leave = () => {
    const c = net.current as unknown as { _hello?: number } | null
    if (c?._hello) window.clearInterval(c._hello)
    net.current?.close()
    net.current = null
    opp.current = null
    remote.current = null
    setOppName(null)
    setStage('pick')
  }

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(room)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable — the code is still visible */
    }
  }

  /* ------------------------------------------------------------------- hud */
  const pips = (n: number, side: 0 | 1) => (
    <span className={`brawl-pips ${side === 1 ? 'is-right' : ''}`} aria-hidden="true">
      {Array.from({ length: WIN_SCORE }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  )

  const phaseLabel =
    hud.phase === 'countdown'
      ? String(Math.max(1, Math.ceil(hud.t)))
      : hud.phase === 'ko'
        ? pl
          ? 'KNOCKOUT!'
          : 'KNOCKOUT!'
        : hud.phase === 'over'
          ? hud.score[0] > hud.score[1]
            ? pl
              ? 'Wygrana!'
              : 'Victory!'
            : pl
              ? 'Porażka'
              : 'Defeat'
          : ''

  return (
    <div className="brawl" data-mode={theme}>
      <header className="brawl-top">
        <button className="brawl-back" onClick={stage === 'fight' ? leave : onBack}>
          <ArrowLeft size={15} />
          {stage === 'fight' ? (pl ? 'Zakończ' : 'Quit') : (pl ? 'Odkrywaj' : 'Discover')}
        </button>
        <div className="brawl-title">
          <Swords size={17} />
          <b>Blok Brawl</b>
          <small>{pl ? 'sumo na krawędzi' : 'sumo on the edge'}</small>
        </div>
        <div className={`brawl-room ${mode === 'online' && room ? 'is-live' : ''}`}>
          {mode === 'online' && room ? (
            <>
              <span className="brawl-dot" />
              {room}
            </>
          ) : (
            <span className="brawl-offline">SOLO / BOT</span>
          )}
        </div>
      </header>

      <div className="brawl-stage">
        <canvas
          ref={canvas}
          className="brawl-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            stick.current = { x: 0, y: 0, active: true }
            ;(e.currentTarget as HTMLCanvasElement).dataset.ox = String(e.clientX)
            ;(e.currentTarget as HTMLCanvasElement).dataset.oy = String(e.clientY)
          }}
          onPointerMove={(e) => {
            if (!stick.current.active) return
            const ox = Number(e.currentTarget.dataset.ox || e.clientX),
              oy = Number(e.currentTarget.dataset.oy || e.clientY)
            const dx = e.clientX - ox,
              dy = e.clientY - oy,
              len = Math.hypot(dx, dy),
              max = 46
            const k = len > max ? max / len : 1
            stick.current.x = (dx * k) / max
            stick.current.y = (dy * k) / max
          }}
          onPointerUp={() => {
            stick.current = { x: 0, y: 0, active: false }
          }}
          onPointerCancel={() => {
            stick.current = { x: 0, y: 0, active: false }
          }}
        />

        {stage === 'pick' && (
          <div className="brawl-pick">
            <div className="brawl-pick-card">
              <h2>{pl ? 'Zepchnij rywala z platformy' : 'Shove your rival off the platform'}</h2>
              <p>
                {pl
                  ? 'Pierwszy do trzech knockoutów wygrywa. Platforma kurczy się z każdą sekundą — dash to Twój jedyny atut.'
                  : 'First to three knockouts wins. The platform shrinks every second — the dash is your only weapon.'}
              </p>

              <div className="brawl-modes">
                <div className="brawl-mode">
                  <div className="brawl-mode-head">
                    <Bot size={15} />
                    <b>{pl ? 'Trening z botem' : 'Practice vs bot'}</b>
                  </div>
                  <div className="brawl-levels" role="group" aria-label={pl ? 'Poziom bota' : 'Bot level'}>
                    {([0, 1, 2] as BotLevel[]).map((l) => (
                      <button
                        key={l}
                        className={botLevel === l ? 'on' : ''}
                        aria-pressed={botLevel === l}
                        onClick={() => setBotLevel(l)}
                      >
                        {pl ? ['Łatwy', 'Normalny', 'Trudny'][l] : ['Easy', 'Normal', 'Hard'][l]}
                      </button>
                    ))}
                  </div>
                  <div className="brawl-levels" role="group" aria-label={pl ? 'Klasa postaci' : 'Fighter class'}>
                    {(['brawler', 'ninja', 'mage'] as BrawlClass[]).map((c) => (
                      <button
                        key={c}
                        className={playerClass === c ? 'on' : ''}
                        aria-pressed={playerClass === c}
                        onClick={() => setPlayerClass(c)}
                        title={
                          pl
                            ? c === 'brawler'
                              ? 'Mocniejszy cios i większa odporność na odrzut'
                              : c === 'ninja'
                                ? 'Szybszy bieg i krótszy czas odnowienia dasha'
                                : 'Fala uderzeniowa przy dashu'
                            : c === 'brawler'
                              ? 'Heavier hits and knockback resistance'
                              : c === 'ninja'
                                ? 'Faster movement and shorter dash cooldown'
                                : 'Shockwave pulse on dash'
                        }
                      >
                        {pl
                          ? c === 'brawler'
                            ? 'Wojownik'
                            : c === 'ninja'
                              ? 'Ninja'
                              : 'Mag'
                          : c === 'brawler'
                            ? 'Brawler'
                            : c === 'ninja'
                              ? 'Ninja'
                              : 'Mage'}
                      </button>
                    ))}
                  </div>
                  <button className="fb-btn primary brawl-go" onClick={startBot}>
                    {pl ? 'Zagraj z botem' : 'Fight the bot'}
                  </button>
                </div>

                <div className="brawl-or">
                  <span>{pl ? 'albo' : 'or'}</span>
                </div>

                <div className="brawl-mode">
                  <div className="brawl-mode-head">
                    <Users size={15} />
                    <b>{pl ? 'Pojedynek online' : 'Online duel'}</b>
                  </div>
                  <p className="brawl-hint">
                    {pl
                      ? 'Utwórz pokój i wyślij kod znajomemu — albo dołącz do jego pokoju.'
                      : 'Create a room and send the code to a friend — or join theirs.'}
                  </p>
                  <button className="fb-btn primary brawl-go" onClick={() => startOnline()}>
                    {pl ? 'Utwórz pokój' : 'Create room'}
                  </button>
                  <div className="brawl-join">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder={pl ? 'Kod pokoju, np. BRAWL-X7K2' : 'Room code, e.g. BRAWL-X7K2'}
                      aria-label={pl ? 'Kod pokoju' : 'Room code'}
                      spellCheck={false}
                    />
                    <button
                      className="brawl-join-btn"
                      disabled={!normalizeRoom(joinCode)}
                      onClick={() => startOnline(normalizeRoom(joinCode))}
                    >
                      <LogIn size={14} />
                      {pl ? 'Dołącz' : 'Join'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'fight' && (
          <>
            <div className="brawl-hud">
              <div className="brawl-side">
                <span className="brawl-name">{names[0]}</span>
                {pips(hud.score[0], 0)}
              </div>
              <div className="brawl-center">
                <span className="brawl-round">
                  {(pl ? 'RUNDA' : 'ROUND') + ' ' + hud.round}
                </span>
                {phaseLabel && <b className={`brawl-callout ${hud.phase}`}>{phaseLabel}</b>}
              </div>
              <div className="brawl-side is-right">
                <span className="brawl-name">{names[1]}</span>
                {pips(hud.score[1], 1)}
              </div>
            </div>

            <div className="brawl-dash">
              <span>{pl ? 'DASH' : 'DASH'}</span>
              <i>
                <b style={{ width: `${Math.round((1 - hud.dash / 1.5) * 100)}%` }} />
              </i>
              <em>{hud.dash <= 0 ? (pl ? 'GOTOWY' : 'READY') : hud.dash.toFixed(1) + 's'}</em>
            </div>

            {mode === 'online' && !oppName && (
              <div className="brawl-wait">
                <WifiOff size={16} />
                <div>
                  <b>{pl ? 'Czekam na rywala…' : 'Waiting for a rival…'}</b>
                  <span>
                    {pl ? 'Wyślij kod pokoju' : 'Share the room code'} <code>{room}</code>
                  </span>
                </div>
                <button className="brawl-copy" onClick={copyRoom}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? (pl ? 'Skopiowano' : 'Copied') : (pl ? 'Kopiuj kod' : 'Copy code')}
                </button>
              </div>
            )}

            {hud.phase === 'over' && (
              <div className="brawl-over">
                <b>{hud.score[0] > hud.score[1] ? (pl ? 'Wygrana!' : 'Victory!') : pl ? 'Porażka' : 'Defeat'}</b>
                <span>
                  {hud.score[0]} : {hud.score[1]}
                </span>
                <div className="brawl-over-actions">
                  <button className="fb-btn primary" onClick={restart}>
                    {pl ? 'Jeszcze raz' : 'Rematch'}
                  </button>
                  <button className="fb-btn ghost" onClick={leave}>
                    {pl ? 'Zmień tryb' : 'Change mode'}
                  </button>
                </div>
              </div>
            )}

            <button
              className="brawl-dash-btn"
              onPointerDown={(e) => {
                e.preventDefault()
                keys.current.dash = true
              }}
              aria-label={pl ? 'Dash' : 'Dash'}
            >
              <Swords size={18} />
            </button>
          </>
        )}
      </div>

      <footer className="brawl-foot">
        <span>
          {pl
            ? 'Ruch: WASD / strzałki · Dash: Spacja · na dotyku: przeciągnij po arenie'
            : 'Move: WASD / arrows · Dash: Space · on touch: drag across the arena'}
        </span>
        <span>{pl ? 'Pierwszy do 3 knockoutów' : 'First to 3 knockouts'}</span>
      </footer>
    </div>
  )
}
