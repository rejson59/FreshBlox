import { ArrowUpRight, Bookmark, Box, UserRound, UsersRound } from 'lucide-react'
import { genres, type World } from '../data/worlds'
import type { Lang } from '../data/locales'
export function WorldCard({
  world: w,
  lang,
  saved,
  onSave,
  onOpen,
}: {
  world: World
  lang: Lang
  saved: boolean
  onSave: () => void
  onOpen: () => void
}) {
  const title = w.name[lang],
    pl = lang === 'pl',
    Icon = w.multiplayer ? UsersRound : UserRound
  return (
    <article className="world-card">
      <button
        className="world-card-main"
        onClick={onOpen}
        aria-label={`${pl ? 'Szczegóły' : 'Details'}: ${title}`}
      >
        <div className="world-cover">
          <img alt="" loading="lazy" src={w.cover} width="780" height="444" />
          <span className="world-mode">
            <Icon size={11} />
            {w.multiplayer ? 'MULTI' : 'SOLO'}
          </span>
        </div>
        <div className="world-info">
          <div>
            <span className="world-genre">
              <i style={{ background: w.accent }} />
              {genres[w.genre][lang]}
            </span>
            <h3>{title}</h3>
          </div>
          <ArrowUpRight size={17} />
        </div>
        <div className="world-meta">
          <Box size={13} />
          {w.detail[lang]} <i /> FreshBlox
        </div>
      </button>
      <button
        className={`world-save ${saved ? 'is-saved' : ''}`}
        onClick={onSave}
        aria-pressed={saved}
        aria-label={`${saved ? (pl ? 'Usuń z biblioteki' : 'Remove from library') : pl ? 'Zapisz w bibliotece' : 'Save to library'}: ${title}`}
      >
        <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
