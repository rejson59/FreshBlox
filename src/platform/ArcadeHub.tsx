import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Bookmark,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Flag,
  Gamepad2,
  Globe2,
  Grid2X2,
  Layers3,
  LogIn,
  Play,
  Search,
  Sparkles,
  SquareStack,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react'
import type { Lang } from '../data/locales'
import type { WorldKind } from '../data/catalog'
import { defaultRoom, genres, worldOrder, worlds, type Genre, type WorldId } from '../data/worlds'
import { decodeCourse, encodeCourse, parseCourse, skyline, starter, type Course } from '../studio/course'
import { Brand } from './Brand'
import { WorldCard } from './WorldCard'
import { Modal } from './Modal'
import { readLocal, saveLocal } from './local'
import './hub.css'
const Studio = lazy(() => import('../studio/Studio'))
const MiniRun = lazy(() => import('../studio/MiniRun'))
const BlokBrawl = lazy(() => import('../games/brawl/BlokBrawl'))
type Page = 'discover' | 'library' | 'studio'
const tabHash = (page: Page) => (page === 'discover' ? '#discover' : `#${page}`)
const featureIds: WorldId[] = ['skyline', 'racing', 'arena']
const genreIcons = { all: Grid2X2, parkour: Flag, racing: Gamepad2, action: Zap, social: UsersRound }
const shortcutIds: WorldId[] = ['obby', 'racing', 'arena']
interface Props {
  lang: Lang
  toggleLang: () => void
  username: string | null
  accountsAvailable: boolean
  onAccount: () => void
  onWorld: (id: WorldKind, room: string) => void
}
export function ArcadeHub({ lang, toggleLang, username, accountsAvailable, onAccount, onWorld }: Props) {
  const pl = lang === 'pl',
    [hash, setHash] = useState(location.hash),
    [spot, setSpot] = useState(0),
    [query, setQuery] = useState(''),
    [genre, setGenre] = useState<Genre | 'all'>('all')
  const [detail, setDetail] = useState<WorldId | null>(null),
    [info, setInfo] = useState<'profile' | 'help' | null>(null),
    [toast, setToast] = useState('')
  const [bookmarks, setBookmarks] = useState<WorldId[]>(() => {
    const list = readLocal('bookmarks')
    return Array.isArray(list) ? worldOrder.filter((id) => list.includes(id)) : []
  })
  const [draft, setDraft] = useState<Course>(() => parseCourse(readLocal('draft')) ?? starter),
    [saved, setSaved] = useState(true),
    [passed, setPassed] = useState<string>(() => String(readLocal('tested') ?? ''))
  const searchRef = useRef<HTMLInputElement>(null),
    catalogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = () => {
      setHash(location.hash)
      setDetail(null)
      setInfo(null)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', nav)
    return () => window.removeEventListener('hashchange', nav)
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    const hotkey = (e: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        !(e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) ||
        (e.target as HTMLElement).closest('input,textarea,[contenteditable=true]')
      )
        return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', hotkey)
    return () => window.removeEventListener('keydown', hotkey)
  }, [])
  const page: Page =
    hash === '#library' ? 'library' : hash === '#studio' || hash === '#test' ? 'studio' : 'discover'
  const isShared = hash.startsWith('#course='),
    isRun = hash === '#skyline' || hash === '#duel' || hash === '#test' || isShared
  const course = useMemo(
    () => (hash === '#test' ? parseCourse(draft) : isShared ? decodeCourse(hash.slice(8)) : skyline),
    [hash, isShared, draft],
  )
  const nav = (p: Page) => {
    setDetail(null)
    setInfo(null)
    setGenre('all')
    setQuery('')
    location.hash = tabHash(p)
    window.scrollTo(0, 0)
  }
  const pages: { id: Page; name: string; icon: typeof Compass }[] = [
    { id: 'discover', name: pl ? 'Odkrywaj' : 'Discover', icon: Compass },
    { id: 'library', name: pl ? 'Biblioteka' : 'Library', icon: Bookmark },
    { id: 'studio', name: 'Studio Lite', icon: Blocks },
  ]
  const title = pages.find((i) => i.id === page)!.name,
    spotWorld = worlds[featureIds[spot]]
  const play = (id: WorldId) => {
    if (id === 'skyline' || id === 'duel') {
      setDetail(null)
      setInfo(null)
      location.hash = id
      return
    }
    if (id === 'racing' || id==='obby' || username || accountsAvailable) {
      setDetail(null)
      onWorld(id, defaultRoom(id))
    } else setDetail(id)
  }
  const account = () => {
    if (username || accountsAvailable) onAccount()
    else setInfo('profile')
  }
  const save = (id: WorldId) => {
    const next = bookmarks.includes(id) ? bookmarks.filter((k) => k !== id) : [...bookmarks, id]
    setBookmarks(next)
    const stored = saveLocal('bookmarks', next)
    setToast(
      !stored
        ? pl
          ? 'Zmiana tylko w tej sesji'
          : 'Changed for this session only'
        : next.includes(id)
          ? pl
            ? 'Dodano do biblioteki'
            : 'Saved to your library'
          : pl
            ? 'Usunięto z biblioteki'
            : 'Removed from library',
    )
  }
  const filtered = worldOrder.filter(
    (id) =>
      (page !== 'library' || bookmarks.includes(id)) &&
      (genre === 'all' || worlds[id].genre === genre) &&
      [worlds[id].name[lang], genres[worlds[id].genre][lang], worlds[id].detail[lang]]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  const featureTitle = spot === 0 ? ['Skyline', 'Rush'] : spot === 1 ? ['Turbo', 'Kart'] : ['Portal', 'Arena']
  const demo =
    detail !== null &&
    (detail === 'skyline' || detail === 'racing' || detail === 'obby' || detail === 'duel'),
    canPlay = demo || !!username || accountsAvailable
  const close = pl ? 'Zamknij' : 'Close'
  return (
    <div className={`fb-hub${isRun ? ' is-playing' : ''}`}>
      <a
        className="fb-skip"
        href="#hub-main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('hub-main')?.focus()
        }}
      >
        {pl ? 'Do treści' : 'Skip to content'}
      </a>
      <aside className="hub-rail">
        <button className="brand-button" onClick={() => nav('discover')} aria-label="FreshBlox">
          <Brand />
        </button>
        <div className="rail-body">
          <div className="rail-label">{pl ? 'PLATFORMA' : 'PLATFORM'}</div>
          <nav className="rail-nav">
            {pages.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                aria-current={page === id ? 'page' : undefined}
                className={page === id ? 'active' : ''}
                onClick={() => nav(id)}
              >
                <Icon size={18} />
                {name}
                {id === 'studio' ? (
                  <small>BETA</small>
                ) : id === 'library' && bookmarks.length > 0 ? (
                  <em>{bookmarks.length}</em>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="rail-rule" />
          <div className="rail-label">{pl ? 'SZYBKI START' : 'QUICK LAUNCH'}</div>
          <div className="rail-shortcuts">
            {shortcutIds.map((id) => (
              <button onClick={() => setDetail(id)} key={id}>
                <img src={worlds[id].cover} alt="" width="31" height="31" />
                {worlds[id].name[lang]}
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
          <button className="rail-tip" onClick={() => setInfo('help')}>
            <CircleHelp size={16} />
            {pl ? 'Jak grać?' : 'How to play'}
          </button>
        </div>
        <button className="rail-user" onClick={account}>
          <span className="guest-icon">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="m4 10 10-6 14 4-10 7z" fill="#0f2f45" />
              <path d="m4 10 14 5v14L4 23z" fill="#7dd3fc" />
              <path d="m18 15 10-7v15l-10 6z" fill="#38bdf8" />
              <path d="m4 10 14 5v4L4 14zm14 5 10-7v6l-10 6z" fill="#0284c7" />
              <path d="m6 17 2 .7v2.5L6 19.5zm7 2.4 2 .7v2.4l-2-.7z" fill="#0a1b2e" />
            </svg>
          </span>
          <span>
            <strong>{username || (pl ? 'Profil gościa' : 'Guest profile')}</strong>
            <small>
              <i />
              {username ? (pl ? 'Konto gracza' : 'Player account') : pl ? 'Sesja lokalna' : 'Local session'}
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
      </aside>
      <div className="hub-body">
        <header className="hub-header">
          <div className="breadcrumbs">
            <Box size={16} />
            <span>{pl ? 'Platforma' : 'Platform'}</span>
            <ChevronRight size={12} />
            <b>{isRun ? (hash === '#duel' ? 'Blok Brawl' : 'Mini-Parkour') : title}</b>
          </div>
          <button className="mobile-brand" onClick={() => nav('discover')}>
            <Brand />
          </button>
          <div className="header-actions">
            <label className="hub-search">
              <Search size={16} />
              <input
                ref={searchRef}
                value={query}
                aria-label={pl ? 'Szukaj światów' : 'Search worlds'}
                placeholder={pl ? 'Szukaj światów…' : 'Search worlds…'}
                onChange={(e) => {
                  if (page === 'studio' || isRun) location.hash = 'discover'
                  setQuery(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('')
                    e.currentTarget.blur()
                  }
                  if (e.key === 'Enter') catalogRef.current?.scrollIntoView({ block: 'start' })
                }}
              />
              {query ? (
                <button
                  aria-label={pl ? 'Wyczyść wyszukiwanie' : 'Clear search'}
                  onClick={() => setQuery('')}
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            <button
              className="lang-btn"
              onClick={toggleLang}
              aria-label={pl ? 'Switch to English' : 'Zmień na polski'}
            >
              <Globe2 size={15} />
              {lang.toUpperCase()}
            </button>
            <button
              className="login-btn"
              onClick={account}
              aria-label={
                username ? (pl ? 'Panel gracza' : 'Player hub') : pl ? 'Konto gracza' : 'Player account'
              }
            >
              {username ? <UserRound size={15} /> : <LogIn size={15} />}
              <span>{username ? (pl ? 'Panel gracza' : 'Player hub') : pl ? 'Zaloguj się' : 'Sign in'}</span>
            </button>
          </div>
        </header>
        <main id="hub-main" tabIndex={-1} className="hub-content">
          <Suspense fallback={<div className="fb-wait">{pl ? 'Wczytywanie…' : 'Loading…'}</div>}>
            {isRun ? (
              hash === '#duel' ? (
                <BlokBrawl lang={lang} name={username} onBack={() => nav('discover')} />
              ) : course ? (
                <MiniRun
                  key={hash}
                  course={course}
                  lang={lang}
                  fromStudio={hash === '#test'}
                  onBack={() => nav(hash === '#test' ? 'studio' : 'discover')}
                  onFinish={() => {
                    if (hash === '#test') {
                      const key = encodeCourse(draft)
                      setPassed(key)
                      saveLocal('tested', key)
                    }
                  }}
                />
              ) : (
                <section className="fb-empty">
                  <Flag />
                  <h2>{pl ? 'Nieprawidłowy link do toru' : 'Invalid course link'}</h2>
                  <p>
                    {pl
                      ? 'Poproś autora o ponowne skopiowanie pełnego linku.'
                      : 'Ask the author to copy the complete link again.'}
                  </p>
                  <button className="fb-btn primary" onClick={() => nav('discover')}>
                    {pl ? 'Wróć do gier' : 'Back to games'}
                  </button>
                </section>
              )
            ) : page === 'studio' ? (
              <Studio
                lang={lang}
                course={draft}
                onChange={(c) => {
                  setDraft(c)
                  setSaved(saveLocal('draft', c))
                }}
                onTest={() => (location.hash = 'test')}
                tested={passed === encodeCourse(draft)}
                saved={saved}
              />
            ) : (
              <>
                <div className="page-title">
                  <div>
                    <div className="fb-kicker">
                      <span /> {page === 'discover' ? 'GAME HUB' : pl ? 'TWOJA KOLEKCJA' : 'YOUR COLLECTION'}
                    </div>
                    <h1>
                      {title}
                      <span className="title-dot">.</span>
                    </h1>
                  </div>
                  <div className="edition">
                    <i /> BROWSER EDITION
                  </div>
                </div>
                {page === 'discover' && !query.trim() && (
                  <section className="hub-hero" aria-label={pl ? 'Wyróżnione światy' : 'Featured worlds'}>
                    <img
                      className="hero-art"
                      src={spot === 0 ? '/worlds/skyline-hero.webp' : spotWorld.cover}
                      alt=""
                      fetchPriority="high"
                    />
                    <div className="hero-shade" />
                    <div className="hero-content">
                      <div className="hero-label">
                        <Sparkles size={12} fill="currentColor" />
                        {pl ? 'WYRÓŻNIONY ŚWIAT' : 'FEATURED WORLD'}
                      </div>
                      <h2>
                        {featureTitle[0]} <em>{featureTitle[1]}</em>
                      </h2>
                      <p>{spotWorld.summary[lang]}</p>
                      <div className="fb-row">
                        <button className="fb-btn primary" onClick={() => play(spotWorld.id)}>
                          <Play size={15} fill="currentColor" />
                          {pl ? 'Zagraj teraz' : 'Play now'}
                        </button>
                        <button className="hero-more" onClick={() => setDetail(spotWorld.id)}>
                          {pl ? 'Szczegóły' : 'Details'}
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="hero-pager">
                      <span>
                        <b>0{spot + 1}</b> / 03
                      </span>
                      <button
                        onClick={() => setSpot((s) => (s + 2) % 3)}
                        aria-label={pl ? 'Poprzedni świat' : 'Previous world'}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        onClick={() => setSpot((s) => (s + 1) % 3)}
                        aria-label={pl ? 'Następny świat' : 'Next world'}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </section>
                )}
                <section className="world-catalog" ref={catalogRef}>
                  <div className="catalog-head">
                    <div>
                      <span className="catalog-icon">
                        {page === 'library' ? <Bookmark size={19} /> : <Layers3 size={21} />}
                      </span>
                      <h2>
                        {query.trim()
                          ? pl
                            ? 'Wyniki wyszukiwania'
                            : 'Search results'
                          : page === 'library'
                            ? pl
                              ? 'Zapisane światy'
                              : 'Saved worlds'
                            : pl
                              ? 'Katalog światów'
                              : 'World catalog'}
                      </h2>
                      <span className="count-badge">{String(filtered.length).padStart(2, '0')}</span>
                    </div>
                    <small>
                      {pl ? 'KOLEKCJA' : 'COLLECTION'} <b>/</b> 01
                    </small>
                  </div>
                  <div className="genre-list">
                    {(['all', 'parkour', 'racing', 'action', 'social'] as const).map((g) => {
                      const Icon = genreIcons[g]
                      return (
                        <button
                          key={g}
                          aria-pressed={genre === g}
                          className={genre === g ? 'selected' : ''}
                          onClick={() => setGenre(g)}
                        >
                          <Icon size={14} />
                          {g === 'all' ? (pl ? 'Wszystkie' : 'All worlds') : genres[g][lang]}
                        </button>
                      )
                    })}
                  </div>
                  <div className="world-grid">
                    {filtered.map((id) => (
                      <WorldCard
                        key={id}
                        world={worlds[id]}
                        lang={lang}
                        saved={bookmarks.includes(id)}
                        wide={id === 'duel'}
                        onSave={() => save(id)}
                        onOpen={() => setDetail(id)}
                      />
                    ))}
                  </div>
                  {!filtered.length && (
                    <div className="fb-empty">
                      <SquareStack size={28} />
                      <h3>
                        {page === 'library' && !bookmarks.length
                          ? pl
                            ? 'Twoja biblioteka czeka na pierwszy świat'
                            : 'Your library is ready for its first world'
                          : pl
                            ? 'Brak pasujących światów'
                            : 'No matching worlds'}
                      </h3>
                      <p>
                        {page === 'library' && !bookmarks.length
                          ? pl
                            ? 'Kliknij zakładkę na okładce gry, aby zapisać ją na tym urządzeniu.'
                            : 'Use the bookmark on a cover to save a world on this device.'
                          : pl
                            ? 'Spróbuj innej nazwy lub kategorii.'
                            : 'Try another name or category.'}
                      </p>
                      <button
                        className="fb-btn ghost"
                        onClick={() => nav(page === 'library' && bookmarks.length ? 'library' : 'discover')}
                      >
                        {pl ? 'Pokaż światy' : 'Browse worlds'}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
                {page === 'discover' && !query && (
                  <div className="studio-promo">
                    <div className="promo-symbol">
                      <Blocks size={38} />
                    </div>
                    <div>
                      <div className="fb-kicker">CREATOR TOOLS</div>
                      <h3>{pl ? 'Teraz Twoja kolej na budowanie.' : 'Your turn to build.'}</h3>
                      <p>
                        {pl
                          ? 'Ułóż własne Mini-Parkour i podziel się torem jednym linkiem.'
                          : 'Make a Mini-Parkour and share it with a single link.'}
                      </p>
                    </div>
                    <button className="fb-btn ghost" onClick={() => nav('studio')}>
                      Studio Lite <ArrowUpRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </Suspense>
          <footer className="hub-footer">
            <span>
              FreshBlox<span className="brand-dot">.</span>
            </span>{' '}
            <span>GAME PLATFORM &nbsp; / &nbsp; WEB</span>
          </footer>
        </main>
      </div>
      <nav className="hub-mobile-nav">
        {pages.map(({ id, name, icon: Icon }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => nav(id)}>
            <Icon size={17} />
            {name}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="fb-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {detail && (
        <Modal title={worlds[detail].name[lang]} closeLabel={close} onClose={() => setDetail(null)}>
          <img className="modal-art" src={worlds[detail].cover} alt="" />
          <div className="modal-body">
            <div className="fb-kicker">
              <span />
              {genres[worlds[detail].genre][lang]} / {worlds[detail].multiplayer ? 'MULTI' : 'SOLO'}
            </div>
            <h2>{worlds[detail].name[lang]}</h2>
            <p>{worlds[detail].summary[lang]}</p>
            <div className="modal-fact">
              <Gamepad2 size={16} />
              {worlds[detail].detail[lang]} <b>·</b>{' '}
              {demo && !username
                ? detail === 'duel'
                  ? pl
                    ? 'Pojedynek bez konta'
                    : 'No account needed'
                  : pl
                    ? 'Trening bez nagród'
                    : 'Unranked practice'
                : pl
                  ? 'Konto gracza'
                  : 'Player account'}
            </div>
            {!canPlay && (
              <p className="modal-note">
                {pl
                  ? 'Ten świat sieciowy wymaga konta. W lokalnym podglądzie możesz od razu grać w Parkour, Skyline Rush, Turbo Kart i Blok Brawl.'
                  : 'This online world requires an account. In local preview you can play Parkour, Skyline Rush, Turbo Kart and Blok Brawl right away.'}
              </p>
            )}
            <div className="fb-row">
              <button className="fb-btn primary" onClick={() => play(canPlay ? detail : 'skyline')}>
                <Play size={15} fill="currentColor" />
                {!canPlay
                  ? 'Skyline Rush'
                  : demo || username
                    ? pl
                      ? 'Graj'
                      : 'Play'
                    : pl
                      ? 'Zaloguj się i graj'
                      : 'Sign in to play'}
              </button>
              <button
                className="fb-btn ghost"
                onClick={() => save(detail)}
                aria-pressed={bookmarks.includes(detail)}
              >
                <Bookmark size={15} />
                {bookmarks.includes(detail) ? (pl ? 'Zapisano' : 'Saved') : pl ? 'Zapisz' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {info && (
        <Modal
          title={
            info === 'help' ? (pl ? 'Jak grać?' : 'How to play') : pl ? 'Profil gościa' : 'Guest profile'
          }
          closeLabel={close}
          onClose={() => setInfo(null)}
        >
          <div className="modal-body standalone">
            <div className="fb-kicker">
              <span /> FRESHBLOX / HUB
            </div>
            <h2>
              {info === 'help' ? (pl ? 'Jak grać?' : 'How to play') : pl ? 'Profil gościa' : 'Guest profile'}
            </h2>
            <p>
              {info === 'help'
                ? pl
                  ? 'Wybierz Skyline Rush, poruszaj się strzałkami i skacz spacją. Na telefonie użyj przycisków pod torem. W Studio Lite możesz zbudować własną trasę.'
                  : 'Pick Skyline Rush, use arrows to move and space to jump. On mobile use the controls beneath the course. Build your own in Studio Lite.'
                : pl
                  ? 'W tym podglądzie usługa kont nie jest skonfigurowana. Biblioteka i szkic toru zapisują się na Twoim urządzeniu. Gry solo nie wymagają logowania.'
                  : 'Accounts are not configured in this preview. Your library and course draft stay on this device. Solo practice does not require a login.'}
            </p>
            <div className="fb-row">
              <button className="fb-btn primary" onClick={() => play('skyline')}>
                <Play size={15} /> Skyline Rush
              </button>
              <button className="fb-btn ghost" onClick={() => nav('studio')}>
                <Blocks size={15} />
                Studio Lite
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
