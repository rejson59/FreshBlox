import type { WorldKind } from './catalog'
import type { Lang } from './locales'

export type WorldId = WorldKind | 'skyline' | 'duel'
export type Genre = 'parkour' | 'racing' | 'action' | 'social'
type Text = Record<Lang, string>
export interface World {
  id: WorldId
  name: Text
  genre: Genre
  cover: string
  accent: string
  summary: Text
  detail: Text
  multiplayer: boolean
  room: string | null
}
export const genres: Record<Genre, Text> = {
  parkour: { pl: 'Parkour', en: 'Parkour' },
  racing: { pl: 'Wyścigi', en: 'Racing' },
  action: { pl: 'Akcja', en: 'Action' },
  social: { pl: 'Społecznościowe', en: 'Social' },
}
const name = (s: string) => ({ pl: s, en: s })
export const worlds: Record<WorldId, World> = {
  skyline: {
    id: 'skyline',
    name: name('Skyline Rush'),
    genre: 'parkour',
    cover: '/worlds/skyline.webp',
    accent: '#38bdf8',
    room: null,
    multiplayer: false,
    summary: {
      pl: 'Przeskakuj między podniebnymi wyspami i złap własny rytm. Pierwszy skok należy do Ciebie.',
      en: 'Leap between sky islands and find your rhythm. The first jump is yours.',
    },
    detail: { pl: 'Bez konta', en: 'Guest play' },
  },
  obby: {
    id: 'obby',
    name: name('Parkour'),
    genre: 'parkour',
    cover: '/worlds/obby.webp',
    accent: '#7dd3fc',
    room: 'OBBY-1',
    multiplayer: true,
    summary: {
      pl: 'Od Lazurowych Wysp po Gwiezdne Iglice: 500 tras, pięć światów i cztery przejścia przez portal. Na końcu czeka korona.',
      en: 'From Azure Isles to Star Spires: 500 courses, five worlds and four portal crossings. Reach the final gate for the crown.',
    },
    detail: { pl: '5 × 100 etapów', en: '5 × 100 stages' },
  },
  racing: {
    id: 'racing',
    name: name('Turbo Kart'),
    genre: 'racing',
    cover: '/worlds/kart.webp',
    accent: '#71bffa',
    room: 'KART-1',
    multiplayer: false,
    summary: {
      pl: 'Wskocz do gokarta. Trzy okrążenia, trzech rywali sterowanych przez grę i doładowanie na ostatniej prostej.',
      en: 'Take the wheel for three laps against three AI rivals. Save some boost for the final straight.',
    },
    detail: { pl: '3 okrążenia', en: '3 laps' },
  },
  arena: {
    id: 'arena',
    name: name('Portal Arena'),
    genre: 'action',
    cover: '/worlds/arena.webp',
    accent: '#bd96ff',
    room: 'ARENA-1',
    multiplayer: true,
    summary: {
      pl: 'Połącz dwa portale, zmień kierunek w locie i zaskocz rywali. Możesz też ćwiczyć w trybie solo.',
      en: 'Connect two portals, change direction mid-air and outsmart your rivals. Solo practice included.',
    },
    detail: { pl: 'Portale 3D', en: '3D portals' },
  },
  frisbee: {
    id: 'frisbee',
    name: name('Frisbee King'),
    genre: 'action',
    cover: '/worlds/frisbee.webp',
    accent: '#0ea5e9',
    room: 'FRISBEE-1',
    multiplayer: true,
    summary: {
      pl: 'Podkręć dysk, odbij go od ściany i wygraj pojedynek w trzech rundach.',
      en: 'Curve the disc, bank it off the wall and win a three-round showdown.',
    },
    detail: { pl: '3 rundy', en: '3 rounds' },
  },
  duel: {
    id: 'duel',
    name: name('Blok Brawl'),
    genre: 'action',
    cover: '/worlds/duel.webp',
    accent: '#38bdf8',
    room: 'BRAWL-1',
    multiplayer: true,
    summary: {
      pl: 'Zepchnij rywala z kurczącej się platformy. Dash, wyczekaj rykoszet i wypchnij go w chmury — pierwszy do trzech knockoutów.',
      en: 'Shove your rival off a shrinking platform. Dash, bait the recoil and send them into the clouds — first to three knockouts.',
    },
    detail: { pl: 'PvP 1 na 1', en: '1v1 PvP' },
  },
  lobby: {
    id: 'lobby',
    name: { pl: 'Lobby Główne', en: 'Main Lobby' },
    genre: 'social',
    cover: '/worlds/lobby.webp',
    accent: '#80dda7',
    room: 'PUBLIC-1',
    multiplayer: true,
    summary: {
      pl: 'Spotkaj ekipę przy fontannie, pokaż nowy strój i wybierz następny świat.',
      en: 'Meet friends at the fountain, show off an outfit and choose your next world.',
    },
    detail: { pl: 'Strefa spotkań', en: 'Social hub' },
  },
}
export const worldOrder: WorldId[] = ['racing', 'arena', 'obby', 'frisbee', 'skyline', 'lobby', 'duel']
export const gameIds: WorldKind[] = ['lobby', 'obby', 'arena', 'frisbee', 'racing']
export const socialWorldIds = gameIds.filter((id) => worlds[id].multiplayer)
export function cleanRoom(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^#/, '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12)
}
export function roomWorld(room: string): WorldKind {
  const prefix = cleanRoom(room).split('-')[0]
  return gameIds.find((id) => worlds[id].room!.split('-')[0] === prefix) ?? 'lobby'
}
export function defaultRoom(id: WorldKind) {
  return worlds[id].room!
}

export function knownWorld(value: unknown): WorldKind {
  return gameIds.includes(value as WorldKind) ? (value as WorldKind) : 'lobby'
}
