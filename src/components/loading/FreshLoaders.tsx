import React from 'react'
import { ARCTIC_SKY, ThemeMode } from '../../data/brandTheme'
import { FreshBloxLogo, FreshGemShard } from '../brand/FreshBloxBrand'

export type LoaderPresetId =
  | 'iso-blocks'
  | 'cube-3d'
  | 'voxel-grid'
  | 'obby-hop'
  | 'tile-shift'
  | 'dual-orbit'
  | 'gem-prism'
  | 'arctic-radar'
  | 'portal-vortex'
  | 'equalizer-bars'
  | 'logo-pulse'
  | 'orbital-nodes'
  | 'block-scanner'
  | 'liquid-pill'
  | 'newton-blocks'
  | 'hex-morph'

export type LoaderCategory = 'blocks' | 'minimal' | 'gaming' | 'brand'

export interface LoaderMeta {
  id: LoaderPresetId
  code: string
  category: LoaderCategory
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
}

export const FRESH_LOADERS: LoaderMeta[] = [
  {
    id: 'iso-blocks',
    code: 'L-01',
    category: 'blocks',
    namePl: 'Izometryczne Klocki 3D',
    nameEn: 'Isometric 3D Blocks',
    descPl: 'Trzy klocki 3D składające się falowo jak mapa FreshBlox.',
    descEn: 'Three 3D isometric cubes bouncing in a map-building wave.',
  },
  {
    id: 'cube-3d',
    code: 'L-02',
    category: 'blocks',
    namePl: 'Szklany Sześcian 3D',
    nameEn: 'Arctic 3D Glass Cube',
    descPl: 'Prawdziwy sześcian CSS 3D z neonowymi krawędziami.',
    descEn: 'True CSS 3D rotating cube with neon Arctic edges.',
  },
  {
    id: 'voxel-grid',
    code: 'L-03',
    category: 'blocks',
    namePl: 'Siatka Wokseli 3×3',
    nameEn: '3×3 Voxel Wave',
    descPl: 'Dziewięć wokseli pulsujących płynną falą po przekątnej.',
    descEn: 'Nine voxels pulsing across a diagonal wave.',
  },
  {
    id: 'obby-hop',
    code: 'L-04',
    category: 'blocks',
    namePl: 'Skok po Obby',
    nameEn: 'Obby Hopper',
    descPl: 'Klocek-gracz skaczący po platformach toru przeszkód.',
    descEn: 'Player cube hopping across glowing Obby platforms.',
  },
  {
    id: 'tile-shift',
    code: 'L-05',
    category: 'blocks',
    namePl: 'Układanka Kafelków 2×2',
    nameEn: '2×2 Tile Shift',
    descPl: 'Cztery zaokrąglone płytki płynnie zamieniające miejsca.',
    descEn: 'Four rounded tiles seamlessly rotating positions.',
  },
  {
    id: 'dual-orbit',
    code: 'L-06',
    category: 'minimal',
    namePl: 'Podwójna Orbita',
    nameEn: 'Dual Arctic Orbit',
    descPl: 'Dwa przeciwbieżne, precyzyjne pierścienie z rdzeniem.',
    descEn: 'Counter-rotating sleek gradient rings with glowing core.',
  },
  {
    id: 'gem-prism',
    code: 'L-07',
    category: 'brand',
    namePl: 'Lewitujący FreshGem',
    nameEn: 'Levitating FreshGem',
    descPl: 'Unoszący się kryształ FreshGem z rozchodzącą się falą.',
    descEn: 'Levitating FreshGem shard with expanding light ripples.',
  },
  {
    id: 'arctic-radar',
    code: 'L-08',
    category: 'gaming',
    namePl: 'Radar Serwera',
    nameEn: 'Server Radar Sweep',
    descPl: 'Skaner radarowy HUD wyszukujący aktywne światy 3D.',
    descEn: 'Gaming HUD radar sweeping for live 3D rooms.',
  },
  {
    id: 'portal-vortex',
    code: 'L-09',
    category: 'gaming',
    namePl: 'Tunel Teleportacji',
    nameEn: 'Teleport Vortex',
    descPl: 'Kaskada obracających się ramek wciągających do świata.',
    descEn: 'Layered rotating frames pulling into a 3D portal.',
  },
  {
    id: 'equalizer-bars',
    code: 'L-10',
    category: 'minimal',
    namePl: 'Fala Energii',
    nameEn: 'Arctic Energy Wave',
    descPl: 'Pięć smukłych słupków świetlnych w płynnej sinusoidzie.',
    descEn: 'Five crisp light bars flowing in a smooth wave.',
  },
  {
    id: 'logo-pulse',
    code: 'L-11',
    category: 'brand',
    namePl: 'Pierścień Logo FreshBlox',
    nameEn: 'FreshBlox Emblem Ring',
    descPl: 'Oficjalny znak FreshBlox otoczony świetlną orbitą.',
    descEn: 'Official FreshBlox emblem framed by a luminous arc.',
  },
  {
    id: 'orbital-nodes',
    code: 'L-12',
    category: 'gaming',
    namePl: 'Węzły Sieci 3D',
    nameEn: 'Orbital Network Nodes',
    descPl: 'Trzy nachylone orbity symbolizujące silnik multiplayer.',
    descEn: 'Three tilted atomic orbits around a bright core.',
  },
  {
    id: 'block-scanner',
    code: 'L-13',
    category: 'minimal',
    namePl: 'Skaner Segmentów',
    nameEn: 'Segment Block Scanner',
    descPl: 'Sześć klockowych segmentów LED z płynnym przelotem światła.',
    descEn: 'Six blocky LED cells swept by a luminous pulse.',
  },
  {
    id: 'liquid-pill',
    code: 'L-14',
    category: 'minimal',
    namePl: 'Płynna Kapsuła',
    nameEn: 'Liquid Glass Pill',
    descPl: 'Nowoczesny, minimalistyczny pasek świetlny launchera.',
    descEn: 'Ultra-clean launcher pill with gliding light beam.',
  },
  {
    id: 'newton-blocks',
    code: 'L-15',
    category: 'blocks',
    namePl: 'Wahadło Klocków',
    nameEn: 'Block Newton Cradle',
    descPl: 'Cztery kostki odbijające się jak kołyska Newtona.',
    descEn: 'Four crisp blocks swinging like a Newton cradle.',
  },
  {
    id: 'hex-morph',
    code: 'L-16',
    category: 'minimal',
    namePl: 'Morfująca Pryzma',
    nameEn: 'Morphing Prism Core',
    descPl: 'Geometryczna figura płynnie zmieniająca kształt i obrót.',
    descEn: 'Geometric core morphing smoothly between cube and sphere.',
  },
]

export function isLoaderPresetId(value: unknown): value is LoaderPresetId {
  return typeof value === 'string' && FRESH_LOADERS.some((l) => l.id === value)
}

interface FreshLoaderAnimationProps {
  id: LoaderPresetId
  size?: 'sm' | 'md' | 'lg'
  mode?: ThemeMode
}

export const FreshLoaderAnimation: React.FC<FreshLoaderAnimationProps> = ({
  id,
  size = 'md',
  mode = 'dark',
}) => {
  const isDark = mode === 'dark'
  const scale = size === 'sm' ? 0.72 : size === 'lg' ? 1.28 : 1
  const strokeMuted = isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(14, 165, 233, 0.22)'
  const primary = ARCTIC_SKY.skyMain
  const light = ARCTIC_SKY.skyBright
  const deep = ARCTIC_SKY.skyDeep

  const renderInner = () => {
    switch (id) {
      case 'iso-blocks':
        return (
          <svg viewBox="0 0 100 84" className="h-[68px] w-[82px] overflow-visible">
            {[
              { x: 50, y: 20, delay: '0s', top: '#7DD3FC', left: '#0EA5E9', right: '#0284C7' },
              { x: 29, y: 44, delay: '0.18s', top: '#38BDF8', left: '#0284C7', right: '#0369A1' },
              { x: 71, y: 44, delay: '0.36s', top: '#BAE6FD', left: '#38BDF8', right: '#0EA5E9' },
            ].map((c, idx) => (
              <g
                key={idx}
                style={{
                  transformOrigin: `${c.x}px ${c.y}px`,
                  animation: `fbIsoBounce 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) ${c.delay} infinite`,
                }}
              >
                <polygon
                  points={`${c.x},${c.y - 11} ${c.x + 17},${c.y - 2} ${c.x},${c.y + 7} ${c.x - 17},${c.y - 2}`}
                  fill={c.top}
                />
                <polygon
                  points={`${c.x - 17},${c.y - 2} ${c.x},${c.y + 7} ${c.x},${c.y + 24} ${c.x - 17},${c.y + 15}`}
                  fill={c.left}
                />
                <polygon
                  points={`${c.x + 17},${c.y - 2} ${c.x},${c.y + 7} ${c.x},${c.y + 24} ${c.x + 17},${c.y + 15}`}
                  fill={c.right}
                />
              </g>
            ))}
          </svg>
        )

      case 'cube-3d': {
        const faceBase: React.CSSProperties = {
          position: 'absolute',
          inset: 0,
          borderRadius: '7px',
          border: `1.5px solid ${light}`,
          background: isDark
            ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(2, 132, 199, 0.12))'
            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.36), rgba(14, 165, 233, 0.14))',
          boxShadow: 'inset 0 0 12px rgba(125, 211, 252, 0.22)',
          backfaceVisibility: 'visible',
        }
        return (
          <div className="flex h-16 w-16 items-center justify-center" style={{ perspective: '220px' }}>
            <div
              className="relative h-9 w-9"
              style={{
                transformStyle: 'preserve-3d',
                animation: 'fbCubeSpin3D 3.2s linear infinite',
              }}
            >
              <div style={{ ...faceBase, transform: 'translateZ(18px)' }} />
              <div style={{ ...faceBase, transform: 'rotateY(180deg) translateZ(18px)' }} />
              <div style={{ ...faceBase, transform: 'rotateY(90deg) translateZ(18px)' }} />
              <div style={{ ...faceBase, transform: 'rotateY(-90deg) translateZ(18px)' }} />
              <div style={{ ...faceBase, transform: 'rotateX(90deg) translateZ(18px)' }} />
              <div style={{ ...faceBase, transform: 'rotateX(-90deg) translateZ(18px)' }} />
            </div>
          </div>
        )
      }

      case 'voxel-grid': {
        const delays = [0, 0.1, 0.2, 0.1, 0.2, 0.3, 0.2, 0.3, 0.4]
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {delays.map((d, i) => (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-[4px]"
                style={{
                  background: i === 4 ? '#7DD3FC' : i % 2 === 0 ? primary : light,
                  boxShadow: `0 0 10px ${primary}66`,
                  animation: `fbVoxelWave 1.25s ease-in-out ${d}s infinite`,
                }}
              />
            ))}
          </div>
        )
      }

      case 'obby-hop':
        return (
          <div className="relative h-14 w-[88px]">
            {/* Hopping cube */}
            <div
              className="absolute left-1.5 top-[22px] h-3.5 w-3.5 rounded-[4px]"
              style={{
                background: 'linear-gradient(135deg, #BAE6FD, #0EA5E9)',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
                animation: 'fbObbyJump 2.1s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              }}
            />
            {/* 4 Obby platforms */}
            <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-between px-0.5">
              {[0, 0.52, 1.04, 1.56].map((d, i) => (
                <span
                  key={i}
                  className="h-1.5 w-4 rounded-full"
                  style={{
                    background: i === 3 ? '#F59E0B' : primary,
                    boxShadow: i === 3 ? '0 0 8px rgba(245,158,11,0.6)' : `0 0 8px ${primary}66`,
                    animation: `fbObbyPad 2.1s ease-in-out ${d}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )

      case 'tile-shift':
        return (
          <div className="relative h-12 w-12">
            {[
              { anim: 'fbTileA', bg: '#7DD3FC' },
              { anim: 'fbTileB', bg: '#38BDF8' },
              { anim: 'fbTileC', bg: '#0EA5E9' },
              { anim: 'fbTileD', bg: '#0284C7' },
            ].map((t, i) => (
              <span
                key={i}
                className="absolute left-0 top-0 h-5 w-5 rounded-[6px]"
                style={{
                  background: t.bg,
                  boxShadow: `0 4px 10px ${t.bg}55`,
                  animation: `${t.anim} 2.2s cubic-bezier(0.65, 0, 0.35, 1) infinite`,
                }}
              />
            ))}
          </div>
        )

      case 'dual-orbit':
        return (
          <div className="relative flex h-14 w-14 items-center justify-center">
            <svg
              viewBox="0 0 56 56"
              className="absolute inset-0 h-full w-full"
              style={{ animation: 'fbSpinCW 1.25s linear infinite' }}
            >
              <defs>
                <linearGradient id="fbDualG1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7DD3FC" />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="28" cy="28" r="24" fill="none" stroke={strokeMuted} strokeWidth="2.5" />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="url(#fbDualG1)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="88 64"
              />
            </svg>
            <svg
              viewBox="0 0 56 56"
              className="absolute inset-0 h-full w-full"
              style={{ animation: 'fbSpinCCW 1.85s linear infinite' }}
            >
              <circle
                cx="28"
                cy="28"
                r="16"
                fill="none"
                stroke={light}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeDasharray="44 58"
              />
            </svg>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: '#BAE6FD',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.95)',
              }}
            />
          </div>
        )

      case 'gem-prism':
        return (
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span
              className="absolute h-10 w-10 rounded-full border"
              style={{
                borderColor: `${light}99`,
                animation: 'fbRippleOut 1.8s ease-out infinite',
              }}
            />
            <span
              className="absolute h-10 w-10 rounded-full border"
              style={{
                borderColor: `${primary}88`,
                animation: 'fbRippleOut 1.8s ease-out 0.9s infinite',
              }}
            />
            <div style={{ animation: 'fbGemLevitate 1.9s ease-in-out infinite' }}>
              <FreshGemShard size={34} />
            </div>
          </div>
        )

      case 'arctic-radar':
        return (
          <div
            className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border"
            style={{
              borderColor: `${primary}66`,
              background: isDark ? 'rgba(7, 17, 34, 0.85)' : 'rgba(14, 165, 233, 0.08)',
            }}
          >
            <span className="absolute h-9 w-9 rounded-full border" style={{ borderColor: strokeMuted }} />
            <span className="absolute h-4 w-4 rounded-full border" style={{ borderColor: strokeMuted }} />
            <span className="absolute inset-x-0 h-px" style={{ background: strokeMuted }} />
            <span className="absolute inset-y-0 w-px" style={{ background: strokeMuted }} />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(56,189,248,0.55) 0deg, rgba(56,189,248,0) 78deg, transparent 360deg)',
                animation: 'fbSpinCW 1.9s linear infinite',
              }}
            />
            <span
              className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-cyan-300"
              style={{ animation: 'fbRadarBlip 1.9s ease-out 0.35s infinite' }}
            />
            <span
              className="absolute bottom-3.5 left-3.5 h-1.5 w-1.5 rounded-full bg-sky-400"
              style={{ animation: 'fbRadarBlip 1.9s ease-out 1.15s infinite' }}
            />
            <span className="relative h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_8px_#38BDF8]" />
          </div>
        )

      case 'portal-vortex':
        return (
          <div className="relative flex h-14 w-14 items-center justify-center">
            {[
              { s: 48, d: '0s', c: `${deep}BB`, r: '12px' },
              { s: 36, d: '0.18s', c: `${primary}DD`, r: '10px' },
              { s: 24, d: '0.36s', c: light, r: '7px' },
              { s: 12, d: '0.54s', c: '#E0F2FE', r: '4px' },
            ].map((sq, i) => (
              <span
                key={i}
                className="absolute border-2"
                style={{
                  width: sq.s,
                  height: sq.s,
                  borderRadius: sq.r,
                  borderColor: sq.c,
                  animation: `fbPortalSquare 2.1s ease-in-out ${sq.d} infinite`,
                }}
              />
            ))}
          </div>
        )

      case 'equalizer-bars':
        return (
          <div className="flex h-12 items-center gap-1.5">
            {[0, 0.14, 0.28, 0.42, 0.56].map((d, i) => (
              <span
                key={i}
                className="h-10 w-2 rounded-full"
                style={{
                  background: `linear-gradient(180deg, #BAE6FD 0%, ${primary} 100%)`,
                  boxShadow: `0 0 10px ${primary}55`,
                  animation: `fbBarWave 1.05s ease-in-out ${d}s infinite`,
                }}
              />
            ))}
          </div>
        )

      case 'logo-pulse':
        return (
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg
              viewBox="0 0 64 64"
              className="absolute inset-0 h-full w-full"
              style={{ animation: 'fbSpinCW 1.6s linear infinite' }}
            >
              <circle cx="32" cy="32" r="29" fill="none" stroke={strokeMuted} strokeWidth="2.5" />
              <circle
                cx="32"
                cy="32"
                r="29"
                fill="none"
                stroke={light}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="56 130"
              />
            </svg>
            <div style={{ animation: 'fbLogoBreathe 1.8s ease-in-out infinite' }}>
              <FreshBloxLogo size={36} />
            </div>
          </div>
        )

      case 'orbital-nodes':
        return (
          <div className="relative flex h-14 w-14 items-center justify-center">
            {[0, 60, 120].map((deg, idx) => (
              <div
                key={deg}
                className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div
                  className="relative h-14 w-6 rounded-full border"
                  style={{
                    borderColor: `${light}66`,
                    animation: `fbSpinCW ${1.6 + idx * 0.25}s linear infinite`,
                  }}
                >
                  <span
                    className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
                    style={{
                      background: idx === 0 ? '#BAE6FD' : idx === 1 ? '#38BDF8' : '#34D399',
                      boxShadow: '0 0 8px rgba(56, 189, 248, 0.9)',
                    }}
                  />
                </div>
              </div>
            ))}
            <span
              className="relative h-3 w-3 rounded-full"
              style={{
                background: `radial-gradient(circle, #E0F2FE, ${primary})`,
                boxShadow: `0 0 14px ${primary}`,
              }}
            />
          </div>
        )

      case 'block-scanner':
        return (
          <div className="flex items-center gap-1.5">
            {[0, 0.12, 0.24, 0.36, 0.48, 0.6].map((d, i) => (
              <span
                key={i}
                className="h-5 w-2.5 rounded-[4px]"
                style={{
                  background: `linear-gradient(180deg, #7DD3FC, ${primary})`,
                  boxShadow: `0 0 10px ${primary}66`,
                  animation: `fbScannerCell 1.2s ease-in-out ${d}s infinite`,
                }}
              />
            ))}
          </div>
        )

      case 'liquid-pill':
        return (
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative h-3 w-28 overflow-hidden rounded-full border"
              style={{
                borderColor: `${primary}44`,
                background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(14, 165, 233, 0.12)',
              }}
            >
              <div
                className="absolute inset-y-0 left-0 w-12 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, #38BDF8, #BAE6FD, #0EA5E9, transparent)',
                  animation: 'fbLiquidSlide 1.35s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              {[0, 0.2, 0.4].map((d, i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-sky-400"
                  style={{ animation: `fbVoxelWave 1.2s ease-in-out ${d}s infinite` }}
                />
              ))}
            </div>
          </div>
        )

      case 'newton-blocks':
        return (
          <div className="flex h-12 items-end gap-1 pb-2">
            <div
              className="h-7 w-3 flex flex-col items-center justify-end"
              style={{ transformOrigin: 'top center', animation: 'fbNewtonLeft 1.3s ease-in-out infinite' }}
            >
              <span className="h-3 w-3 rounded-[4px] bg-sky-300 shadow-[0_0_8px_#7DD3FC]" />
            </div>
            <div className="h-7 w-3 flex flex-col items-center justify-end">
              <span className="h-3 w-3 rounded-[4px] bg-sky-400" />
            </div>
            <div className="h-7 w-3 flex flex-col items-center justify-end">
              <span className="h-3 w-3 rounded-[4px] bg-sky-500" />
            </div>
            <div
              className="h-7 w-3 flex flex-col items-center justify-end"
              style={{ transformOrigin: 'top center', animation: 'fbNewtonRight 1.3s ease-in-out infinite' }}
            >
              <span className="h-3 w-3 rounded-[4px] bg-cyan-300 shadow-[0_0_8px_#67E8F9]" />
            </div>
          </div>
        )

      case 'hex-morph':
        return (
          <div className="relative flex h-14 w-14 items-center justify-center">
            <span
              className="h-11 w-11 border-2"
              style={{
                borderColor: primary,
                background: 'rgba(14, 165, 233, 0.12)',
                boxShadow: `0 0 18px ${primary}44`,
                animation: 'fbMorphShape 2.4s ease-in-out infinite',
              }}
            />
            <span
              className="absolute h-5 w-5 rounded-[5px]"
              style={{
                background: 'linear-gradient(135deg, #BAE6FD, #0EA5E9)',
                animation: 'fbSpinCCW 2.4s ease-in-out infinite',
              }}
            />
          </div>
        )
    }
  }

  return (
    <div
      className="inline-flex items-center justify-center select-none"
      style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
      aria-hidden="true"
    >
      {renderInner()}
    </div>
  )
}
