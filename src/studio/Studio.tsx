import { useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  CheckCheck,
  Flag,
  Layers3,
  Link2,
  Play,
  Plus,
  Redo2,
  Snowflake,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react'
import type { Lang } from '../data/locales'
import { encodeCourse, kinds, LIMIT, pieceInfo, type Course, type PieceKind } from './course'
const icons = { solid: Box, ice: Snowflake, bounce: Zap, checkpoint: Flag }
function Block({ x, y, color, flag }: { x: number; y: number; color: string; flag: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="m0 0 24 -12 24 12 -24 12z" fill={color} />
      <path d="m0 0 24 12v15L0 15z" fill={color} />
      <path d="m0 0 24 12v15L0 15z" fill="#000" opacity=".23" />
      <path d="m24 12 24 -12v15L24 27z" fill={color} />
      <path d="m24 12 24 -12v15L24 27z" fill="#000" opacity=".42" />
      {flag && (
        <g transform="translate(24 -2)">
          <path d="M0 0v-25" stroke="#f6eadb" strokeWidth="2.1" />
          <path d="m1 -25 14 4 -14 4z" fill="#38bdf8" />
        </g>
      )}
    </g>
  )
}
export default function Studio({
  lang,
  course,
  onChange,
  onTest,
  tested,
  saved,
}: {
  lang: Lang
  course: Course
  onChange: (c: Course) => void
  onTest: () => void
  tested: boolean
  saved: boolean
}) {
  const pl = lang === 'pl',
    [sel, select] = useState(0),
    idx = Math.min(sel, course.pieces.length - 1),
    selected = course.pieces[idx]
  const [history, setHistory] = useState<Course[]>([]),
    [future, setFuture] = useState<Course[]>([]),
    [link, setLink] = useState(''),
    [copied, setCopied] = useState(false)
  const update = (c: Course) => {
    setHistory((v) => [...v.slice(-29), course])
    setFuture([])
    setLink('')
    onChange(c)
  }
  const changePiece = (kind: PieceKind, level: number) =>
    update({ ...course, pieces: course.pieces.map((p, i) => (i === idx ? { kind, level } : p)) })
  const move = (dir: number) => {
    const next = [...course.pieces]
    ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
    update({ ...course, pieces: next })
    select(idx + dir)
  }
  const share = async () => {
    if (!tested) return
    const url = new URL(location.pathname, location.origin)
    url.hash = `course=${encodeCourse(course)}`
    setLink(url.href)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(url.href)
      setCopied(true)
    } catch {
      /* The selectable link is also shown when clipboard access is denied. */
    }
  }
  const full = [
    { kind: 'solid' as const, level: 0 },
    ...course.pieces,
    { kind: 'checkpoint' as const, level: 0 },
  ]
  return (
    <section className="studio">
      <div className="fb-kicker">
        <span /> CREATOR TOOLS <b>/</b> BETA
      </div>
      <h1>
        Studio Lite<span className="title-dot">.</span>
      </h1>
      <p className="fb-intro">
        {pl
          ? 'Zbuduj własny tor z klocków, przetestuj skoki i wyślij wyzwanie znajomym.'
          : 'Build a course out of blocks, test your jumps and send friends a challenge.'}
      </p>
      <div className="studio-layout">
        <div className="studio-panel">
          <div className="fb-panel-head">
            <span>
              <Layers3 size={17} />
              {pl ? 'Podgląd toru' : 'Course preview'}
            </span>
            <small>
              {course.pieces.length} / {LIMIT}
            </small>
          </div>
          <div className="studio-diagram">
            <span className="diagram-label">FB STUDIO&nbsp; / &nbsp;ISO</span>
            <svg
              viewBox={`-12 -70 ${full.length * 49 + 20} 148`}
              role="img"
              aria-label={pl ? 'Izometryczny podgląd toru' : 'Isometric course preview'}
            >
              {full.map((p, i) => (
                <g key={i}>
                  <Block
                    x={i * 49}
                    y={15 - i * 2 - p.level * 8}
                    color={i === 0 ? '#c9c6bc' : pieceInfo[p.kind].color}
                    flag={i === full.length - 1 || p.kind === 'checkpoint'}
                  />
                  {i === idx + 1 && (
                    <path d={`m${i * 49 + 16},${51 - i * 2 - p.level * 8} 8 -4 8 4 -8 4z`} fill="#0ea5e9" />
                  )}
                </g>
              ))}
            </svg>
          </div>
          <div className="studio-panel-body">
            <label className="fb-label" htmlFor="course-name">
              {pl ? 'Nazwa toru' : 'Course name'}
            </label>
            <input
              id="course-name"
              maxLength={40}
              className="fb-input"
              value={course.title}
              onChange={(e) => update({ ...course, title: e.target.value })}
            />
            <div className="fb-between">
              <h3>{pl ? 'Kolejność klocków' : 'Block sequence'}</h3>
              <div className="fb-row">
                <button
                  className="fb-icon"
                  disabled={!history.length}
                  aria-label={pl ? 'Cofnij' : 'Undo'}
                  onClick={() => {
                    setFuture((f) => [course, ...f])
                    onChange(history[history.length - 1])
                    setHistory((h) => h.slice(0, -1))
                    setLink('')
                  }}
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="fb-icon"
                  disabled={!future.length}
                  aria-label={pl ? 'Ponów' : 'Redo'}
                  onClick={() => {
                    setHistory((h) => [...h, course])
                    onChange(future[0])
                    setFuture((f) => f.slice(1))
                    setLink('')
                  }}
                >
                  <Redo2 size={16} />
                </button>
              </div>
            </div>
            <div className="piece-sequence">
              {course.pieces.map((p, i) => {
                const Icon = icons[p.kind]
                return (
                  <button
                    key={i}
                    className={i === idx ? 'selected' : ''}
                    onClick={() => select(i)}
                    aria-pressed={i === idx}
                  >
                    <Icon size={17} color={pieceInfo[p.kind].color} />
                    <small>{String(i + 1).padStart(2, '0')}</small>
                  </button>
                )
              })}
              <button
                disabled={course.pieces.length === LIMIT}
                title={pl ? 'Dodaj klocek' : 'Add block'}
                aria-label={pl ? 'Dodaj klocek' : 'Add block'}
                onClick={() => {
                  update({ ...course, pieces: [...course.pieces, { kind: 'solid', level: 0 }] })
                  select(course.pieces.length)
                }}
              >
                <Plus size={19} />
              </button>
            </div>
          </div>
        </div>
        <div className="studio-panel">
          <div className="fb-panel-head">
            <span>
              <Box size={17} />
              {pl ? 'Wybrany klocek' : 'Selected block'}
            </span>
            <small>{String(idx + 1).padStart(2, '0')}</small>
          </div>
          <div className="studio-panel-body">
            <p className="fb-label">{pl ? 'Rodzaj' : 'Type'}</p>
            <div className="piece-palette">
              {kinds.map((k) => {
                const Icon = icons[k]
                return (
                  <button
                    key={k}
                    aria-pressed={selected.kind === k}
                    className={selected.kind === k ? 'selected' : ''}
                    onClick={() => changePiece(k, selected.level)}
                  >
                    <Icon size={18} color={pieceInfo[k].color} />
                    {pieceInfo[k][lang]}
                  </button>
                )
              })}
            </div>
            <div className="studio-setting">
              <span>{pl ? 'Wysokość' : 'Height'}</span>
              <div className="fb-row">
                <button
                  className="fb-icon"
                  disabled={!selected.level}
                  aria-label={pl ? 'Obniż' : 'Lower'}
                  onClick={() => changePiece(selected.kind, selected.level - 1)}
                >
                  <ArrowDown size={15} />
                </button>
                {selected.level}
                <button
                  className="fb-icon"
                  disabled={selected.level === 2}
                  aria-label={pl ? 'Podwyższ' : 'Raise'}
                  onClick={() => changePiece(selected.kind, selected.level + 1)}
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
            <div className="studio-setting">
              <span>{pl ? 'Pozycja' : 'Position'}</span>
              <div className="fb-row">
                <button
                  className="fb-icon"
                  disabled={!idx}
                  aria-label={pl ? 'Przesuń w lewo' : 'Move left'}
                  onClick={() => move(-1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  className="fb-icon"
                  disabled={idx === course.pieces.length - 1}
                  aria-label={pl ? 'Przesuń w prawo' : 'Move right'}
                  onClick={() => move(1)}
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  className="fb-icon"
                  disabled={course.pieces.length === 1}
                  aria-label={pl ? 'Usuń klocek' : 'Remove block'}
                  onClick={() => update({ ...course, pieces: course.pieces.filter((_, i) => i !== idx) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="studio-actions">
        <span>
          <CheckCheck size={17} />
          {saved
            ? pl
              ? 'Szkic zapisany na tym urządzeniu'
              : 'Draft saved on this device'
            : pl
              ? 'Szkic tylko w tej sesji'
              : 'Draft kept for this session only'}
        </span>
        <div className="fb-row">
          <button className="fb-btn ghost" disabled={!tested} onClick={() => void share()}>
            <Link2 size={16} />
            {pl ? 'Udostępnij' : 'Share'}
          </button>
          <button className="fb-btn primary" onClick={onTest}>
            <Play size={15} fill="currentColor" />
            {pl ? 'Testuj tor' : 'Test course'}
          </button>
        </div>
      </div>
      <p className="fb-footnote">
        {pl
          ? 'Ukończ tę wersję toru, aby odblokować link. Każdy z linkiem może grać bez konta. Tor nie trafia do publicznego katalogu.'
          : 'Finish this version to unlock sharing. Anyone with the link can play without an account. Courses are not listed publicly.'}
      </p>
      {tested && link && (
        <div className="studio-share">
          <label htmlFor="shared-url">
            {copied ? <Check size={16} /> : <Link2 size={16} />}{' '}
            {copied ? (pl ? 'Link skopiowany' : 'Link copied') : pl ? 'Skopiuj link' : 'Copy the link'}
          </label>
          <input
            className="fb-input"
            id="shared-url"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </section>
  )
}
