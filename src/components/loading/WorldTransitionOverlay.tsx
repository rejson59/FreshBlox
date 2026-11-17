import React, { useEffect, useMemo, useState } from 'react'
import { Lightbulb, Sparkles, Users } from 'lucide-react'
import { ARCTIC_SKY } from '../../data/brandTheme'
import { Lang } from '../../data/locales'
import { WorldKind } from '../../data/catalog'
import { useWorldThumbnails } from '../../engine/worldThumbnails'
import { FreshBloxLogo, FreshBloxWordmark } from '../brand/FreshBloxBrand'
import { FreshLoaderAnimation, LoaderPresetId } from './FreshLoaders'

interface WorldTransitionOverlayProps {
  world: WorldKind
  roomCode: string
  loaderPreset: LoaderPresetId
  lang: Lang
  fading: boolean
  onlineCount?: number | null
}

const TIPS_PL: Record<WorldKind, string[]> = {
  lobby: [
    'Wciśnij G, aby otworzyć koło emotek na środku ekranu.',
    'Wciśnij I w trakcie gry, żeby błyskawicznie zmienić strój w Szatni.',
    'Jedno kliknięcie ESC otwiera mini-menu nawet przy zablokowanej myszce.',
    'Na Placu Głównym stoi Podium 3D Mistrzów TOP 3 Test Obby 100!',
    'W ustawieniach mini-menu (O) możesz zmienić pogodę i cykl dnia.',
  ],
  obby: [
    'Przytrzymaj Spację, aby skakać bez opóźnienia po wylądowaniu.',
    'Użyj klawiszy [ i ], aby szybko przeskakiwać między odblokowanymi etapami.',
    'Włącz Ducha (Ghost) w ustawieniach, aby ścigać się ze swoim rekordem czasu!',
    'Wciśnij G, aby szybko wywołać koło emotek na mecie etapu 100.',
    'Jedno kliknięcie ESC otwiera mini-menu gry z ustawieniami FOV i czułości.',
  ],
  arena: [
    'Zamknięta komora 3D — zero przepaści! LPM = Portal Cyan, PPM = Portal Orange!',
    'Przez tafle portali widzisz na żywo drugą stronę komory — celuj i planuj ataki!',
    'Rozpędź się ponad 95 km/h przez portale, aby zamienić się w Ludzki Meteoryt!',
    'Włącz tryb Trening Solo u góry ekranu, aby ćwiczyć portale bez botów!',
    'Postaw portal pod centralnym Laserem, aby przekierować wiązkę w poprzek hali!',
  ],
  frisbee: [
    'Mecz trwa 3 rundy — na początku każdej losowy gracz otrzymuje Frisbee!',
    'Odbijaj Frisbee od ukośnych ścian 45° i ramp, aby rozpędzić je w OGNISTY TRYB!',
    'Zanim Frisbee zapłonie (niebieskie), możesz je ZŁAPAĆ (PPM lub E) i odrzucić z mocą!',
    'Użyj Q lub E podczas trzymania dysku, aby wykonać podkręcony rzut (Curve Trick)!',
    'Ogniste Frisbee dosłownie przecina rywali — chowaj się za krętymi ścianami i na rampach!',
  ],
}

const TIPS_EN: Record<WorldKind, string[]> = {
  lobby: [
    'Press G to open the radial Emote Wheel right on screen.',
    'Press I anytime in-game to swap outfits in the live Wardrobe.',
    'A single ESC press opens the mini-menu even while Mouse Lock is active.',
    'Check out the live 3D Champions Podium at Main Plaza!',
    'Toggle Arctic Snow, Starfall, or Auto Day Cycle inside Settings (O).',
  ],
  obby: [
    'Hold Spacebar for zero-cooldown consecutive jumps.',
    'Use [ and ] keys to jump between your unlocked Obby stages.',
    'Toggle your Personal Best Ghost in settings to race your own record!',
    'Press G to open the quick Emote Wheel.',
    'Adjust camera FOV (60°–100°) anytime in Settings (O).',
  ],
  arena: [
    '100% enclosed 3D box chamber — zero pits! LMB Cyan Portal, RMB Orange Portal!',
    'Look right through live see-through portal panes to line up lethal plays!',
    'Exceed 95 km/h through portal loops to ignite as a Human Meteor!',
    'Switch to Solo Training at the top to practice portals and targets with zero bots!',
    'Place a portal under the Central Laser to redirect the deadly beam across the box!',
  ],
  frisbee: [
    'Each match lasts 3 rounds — one random player receives the Frisbee at round start!',
    'Bank the Frisbee off 45° corner walls & ramps to accelerate it into BLAZING FIRE!',
    'Catch a cool blue Frisbee mid-air (RMB or E) before it ignites for a boosted counter-throw!',
    'Use Q or E while holding the disc to throw a curved trick shot around winding walls!',
    'Once blazing, the Frisbee literally slices rivals in half — use ramps & cover to dodge!',
  ],
}

export const WorldTransitionOverlay: React.FC<WorldTransitionOverlayProps> = ({
  world,
  roomCode,
  loaderPreset,
  lang,
  fading,
  onlineCount,
}) => {
  const thumbs = useWorldThumbnails()
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(18)

  const isPl = lang === 'pl'
  const bgThumb =
    world === 'obby'
      ? thumbs.obby
      : world === 'arena'
        ? thumbs.arena
        : world === 'frisbee'
          ? thumbs.frisbee
          : thumbs.lobby
  const worldTitle =
    world === 'obby'
      ? 'Test Obby 100'
      : world === 'arena'
        ? 'Portal Arena'
        : world === 'frisbee'
          ? 'Frisbee King'
          : isPl
            ? 'Lobby Główne'
            : 'Main Lobby'

  const tip = useMemo(() => {
    const list = isPl ? TIPS_PL[world] : TIPS_EN[world]
    return list[Math.floor(Math.random() * list.length)]
  }, [world, isPl])

  const steps = useMemo(
    () =>
      isPl
        ? ['Łączenie z pokojem…', 'Wczytywanie świata 3D…', 'Synchronizacja awatarów…', 'Gotowe!']
        : ['Connecting to room…', 'Loading 3D world…', 'Syncing avatars…', 'Ready!'],
    [isPl],
  )

  useEffect(() => {
    setStepIdx(0)
    setProgress(22)
    const t1 = window.setTimeout(() => {
      setStepIdx(1)
      setProgress(58)
    }, 180)
    const t2 = window.setTimeout(() => {
      setStepIdx(2)
      setProgress(86)
    }, 390)
    const t3 = window.setTimeout(() => {
      setStepIdx(3)
      setProgress(100)
    }, 560)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [world, roomCode])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden px-5 py-7 transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ background: '#050B16' }}
    >
      {/* W-01: Real 3D blurred world backdrop */}
      {bgThumb && (
        <img
          src={bgThumb}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-32 blur-xl"
          draggable={false}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.22) 0%, rgba(5, 11, 22, 0.86) 62%, rgba(4, 8, 18, 0.98) 100%)',
        }}
      />

      {/* W-02: Top Brand Header */}
      <div className="relative z-10 flex items-center gap-2.5">
        <FreshBloxLogo size={34} />
        <FreshBloxWordmark mode="dark" size="md" />
      </div>

      {/* L-02 + W-02 + W-03: Center 3D Glass Cube + Room Card + Progress */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex h-24 w-24 items-center justify-center">
          <FreshLoaderAnimation id={loaderPreset} size="lg" mode="dark" />
        </div>

        {/* W-03: Room & Status Card */}
        <div className="w-full space-y-3 rounded-2xl border border-sky-300/20 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="truncate font-display text-base font-extrabold text-white">
                {worldTitle}
              </span>
            </div>
            <span className="shrink-0 rounded-lg border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-sky-300">
              #{roomCode}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${ARCTIC_SKY.skyDeep}, ${ARCTIC_SKY.skyBright})`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-sky-200/80">
              <span>{steps[stepIdx]}</span>
              <span className="inline-flex items-center gap-1 font-mono text-emerald-300">
                <Users className="h-3 w-3" />
                {typeof onlineCount === 'number' ? onlineCount : 1}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* W-01: Bottom Helpful Tip */}
      <div className="relative z-10 flex max-w-md items-center gap-2 rounded-xl border border-white/10 bg-slate-950/65 px-3.5 py-2 text-xs font-semibold text-sky-100/90 backdrop-blur-md">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        <span>{tip}</span>
      </div>
    </div>
  )
}
