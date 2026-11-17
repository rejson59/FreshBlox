import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Check,
  Crown,
  Eye,
  Lock,
  Moon,
  Palette,
  Play,
  RotateCcw,
  RotateCw,
  Shirt,
  ShoppingBag,
  Smile,
  Sparkles,
  Sun,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import {
  FACE_CATALOG,
  HAT_CATALOG,
  OUTFIT_CATALOG,
  OutfitId,
  R6AvatarConfig,
  SKIN_SWATCHES,
} from '../../data/catalog'
import { PlayerProfile } from '../../store/usePlayerStore'
import { FreshGemShard } from '../brand/FreshBloxBrand'
import { createR6Rig, getSharedFreshStudTexture, R6RigHandle } from '../../engine/r6Builder'
import { PlayerPose } from '../../lib/multiplayer'
import { sfx } from '../../lib/sfx'

interface AvatarEditorViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onBuyAndEquip: (category: 'outfit' | 'hat' | 'face', itemId: string, price: number) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  onEnterLobby: () => void
}

type EditorTab = 'outfits' | 'hats' | 'faces' | 'skin'
type StudioLighting = 'day' | 'neon'

const OUTFIT_SWATCHES: Record<OutfitId, { torso: string; arms: string; legs: string }> = {
  'fresh-creator': { torso: '#0EA5E9', arms: '#38BDF8', legs: '#1E3A8A' },
  'classic-remaster': { torso: '#2563EB', arms: '#FDE0B6', legs: '#22C55E' },
  'arctic-frost': { torso: '#E0F2FE', arms: '#7DD3FC', legs: '#0369A1' },
  'midnight-neon': { torso: '#0F172A', arms: '#0284C7', legs: '#1E293B' },
  'glacier-captain': { torso: '#0891B2', arms: '#E0F2FE', legs: '#0C4A6E' },
  'crystal-royal': { torso: '#38BDF8', arms: '#F8FAFC', legs: '#1D4ED8' },
}

export const AvatarEditorView: React.FC<AvatarEditorViewProps> = ({
  profile,
  mode,
  lang,
  onBuyAndEquip,
  onBuyBundle,
  onSkinChange,
  onEnterLobby,
}) => {
  const [tab, setTab] = useState<EditorTab>('outfits')
  const [previewPose, setPreviewPose] = useState<PlayerPose>('idle')
  const [studioLight, setStudioLight] = useState<StudioLighting>('day')
  const [autoRotate, setAutoRotate] = useState<boolean>(true)

  // Free Try-On preview avatar (can combine unowned outfits, hats & faces before buying!)
  const [previewAvatar, setPreviewAvatar] = useState<R6AvatarConfig>(() => ({ ...profile.avatar }))

  // Keep skin synced with owned profile immediately
  useEffect(() => {
    setPreviewAvatar((prev) => ({ ...prev, skinColor: profile.avatar.skinColor }))
  }, [profile.avatar.skinColor])

  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rigRef = useRef<R6RigHandle | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const hemiRef = useRef<THREE.HemisphereLight | null>(null)
  const sunRef = useRef<THREE.DirectionalLight | null>(null)
  const rimRef = useRef<THREE.DirectionalLight | null>(null)
  const ringMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const poseRef = useRef<PlayerPose>(previewPose)
  poseRef.current = previewPose

  // Compute unowned items currently being tried on
  const triedUnowned = useMemo(() => {
    const list: Array<{
      category: 'outfit' | 'hat' | 'face'
      id: string
      name: string
      price: number
    }> = []

    if (!profile.unlockedOutfits.includes(previewAvatar.outfitId)) {
      const it = OUTFIT_CATALOG.find((x) => x.id === previewAvatar.outfitId)
      if (it) list.push({ category: 'outfit', id: it.id, name: lang === 'pl' ? it.namePl : it.nameEn, price: it.price })
    }
    if (!profile.unlockedHats.includes(previewAvatar.hatId)) {
      const it = HAT_CATALOG.find((x) => x.id === previewAvatar.hatId)
      if (it) list.push({ category: 'hat', id: it.id, name: lang === 'pl' ? it.namePl : it.nameEn, price: it.price })
    }
    if (!profile.unlockedFaces.includes(previewAvatar.faceId)) {
      const it = FACE_CATALOG.find((x) => x.id === previewAvatar.faceId)
      if (it) list.push({ category: 'face', id: it.id, name: lang === 'pl' ? it.namePl : it.nameEn, price: it.price })
    }
    return list
  }, [previewAvatar, profile.unlockedOutfits, profile.unlockedHats, profile.unlockedFaces, lang])

  const totalTryOnPrice = useMemo(() => triedUnowned.reduce((acc, i) => acc + i.price, 0), [triedUnowned])

  // Apply studio lighting theme (Day / Neon) live!
  useEffect(() => {
    const scene = sceneRef.current
    const hemi = hemiRef.current
    const sun = sunRef.current
    const rim = rimRef.current
    const ringMat = ringMatRef.current
    if (!scene) return

    if (studioLight === 'day') {
      scene.background = new THREE.Color('#D7EFFE')
      scene.fog = new THREE.Fog('#D7EFFE', 15, 34)
      if (hemi) {
        hemi.color.set('#F4FBFF')
        hemi.groundColor.set('#6BA5D4')
        hemi.intensity = 1.25
      }
      if (sun) {
        sun.color.set('#FFFFFF')
        sun.intensity = 1.65
      }
      if (rim) {
        rim.color.set('#38BDF8')
        rim.intensity = 1.0
      }
      if (ringMat) ringMat.emissiveIntensity = 0.65
    } else {
      scene.background = new THREE.Color('#07142B')
      scene.fog = new THREE.Fog('#07142B', 14, 32)
      if (hemi) {
        hemi.color.set('#7DD3FC')
        hemi.groundColor.set('#0C2446')
        hemi.intensity = 0.85
      }
      if (sun) {
        sun.color.set('#E0F2FE')
        sun.intensity = 1.3
      }
      if (rim) {
        rim.color.set('#38BDF8')
        rim.intensity = 2.1
      }
      if (ringMat) ringMat.emissiveIntensity = 1.35
    }
  }, [studioLight])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate
    }
  }, [autoRotate])

  // Initialize Flagship 3D Locker Room Showcase Stage
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const disposables: Array<{ dispose: () => void }> = []
    const track = <T extends { dispose: () => void }>(r: T): T => {
      disposables.push(r)
      return r
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(container.clientWidth || 420, container.clientHeight || 440)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#D7EFFE')
    scene.fog = new THREE.Fog('#D7EFFE', 15, 34)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 420) / (container.clientHeight || 440),
      0.1,
      65,
    )
    camera.position.set(0, 2.55, 8.7)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 1.92, 0)
    controls.minDistance = 4.8
    controls.maxDistance = 12.2
    controls.maxPolarAngle = Math.PI * 0.52
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.65
    controlsRef.current = controls

    // Studio 3-point lighting
    const hemi = new THREE.HemisphereLight('#F4FBFF', '#6BA5D4', 1.25)
    scene.add(hemi)
    hemiRef.current = hemi

    const sun = new THREE.DirectionalLight('#FFFFFF', 1.65)
    sun.position.set(6, 11, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(512, 512)
    scene.add(sun)
    sunRef.current = sun

    const rim = new THREE.DirectionalLight('#38BDF8', 1.0)
    rim.position.set(-6, 5, -6)
    scene.add(rim)
    rimRef.current = rim

    // === LOCKER ROOM TURNTABLE PODIUM & ARCHITECTURAL BACKDROP ===
    const studMap = track(getSharedFreshStudTexture().clone())
    studMap.needsUpdate = true
    studMap.repeat.set(3, 3)

    // Upper circular studio podium
    const topDisc = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.35, 2.55, 0.34, 32)),
      track(
        new THREE.MeshStandardMaterial({
          color: '#F0F9FF',
          map: studMap,
          roughness: 0.22,
          metalness: 0.08,
        }),
      ),
    )
    topDisc.position.y = -0.17
    topDisc.receiveShadow = true
    scene.add(topDisc)

    // Glowing Arctic Sky accent rim around turntable
    const ringMat = track(
      new THREE.MeshStandardMaterial({
        color: '#7DD3FC',
        emissive: '#0EA5E9',
        emissiveIntensity: 0.65,
        roughness: 0.16,
        metalness: 0.2,
      }),
    )
    ringMatRef.current = ringMat
    const glowRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.44, 0.065, 10, 48)), ringMat)
    glowRing.rotation.x = Math.PI / 2
    glowRing.position.y = -0.02
    scene.add(glowRing)

    // Lower dark slate base pedestal
    const lowerBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.9, 3.15, 0.38, 32)),
      track(new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.35, metalness: 0.2 })),
    )
    lowerBase.position.y = -0.52
    scene.add(lowerBase)

    // Subtle sleek studio showcase pillars behind avatar
    const pillarGeo = track(new RoundedBoxGeometry(0.52, 6.4, 0.52, 2, 0.08))
    const pillarMat = track(new THREE.MeshStandardMaterial({ color: '#0C2340', roughness: 0.32, metalness: 0.25 }))
    const stripGeo = track(new THREE.BoxGeometry(0.12, 5.2, 0.08))
    const stripMat = track(new THREE.MeshBasicMaterial({ color: '#38BDF8' }))

    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat)
      p.position.set(side * 4.2, 2.4, -3.6)
      p.rotation.y = side * -0.22
      scene.add(p)

      const strip = new THREE.Mesh(stripGeo, stripMat)
      strip.position.set(0, 0, 0.26)
      p.add(strip)
    }

    // Floating background studio arch beam
    const topArch = new THREE.Mesh(
      track(new RoundedBoxGeometry(9.4, 0.42, 0.65, 2, 0.1)),
      pillarMat,
    )
    topArch.position.set(0, 5.65, -3.6)
    scene.add(topArch)

    // Subtle orbiting background FreshGem emblem behind stage
    const decoGem = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.42, 0)),
      ringMat,
    )
    decoGem.position.set(0, 4.75, -3.2)
    scene.add(decoGem)

    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt
      decoGem.rotation.y = elapsed * 1.1
      decoGem.position.y = 4.75 + Math.sin(elapsed * 2) * 0.14
      rigRef.current?.update(dt, elapsed, poseRef.current)
      controls.update()
      renderer.render(scene, camera)
    }
    rafId = requestAnimationFrame(animate)

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.floor(entry.contentRect.width))
        const h = Math.max(200, Math.floor(entry.contentRect.height))
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      controls.dispose()
      if (rigRef.current) {
        scene.remove(rigRef.current.root)
        rigRef.current.dispose()
        rigRef.current = null
      }
      for (const d of disposables) d.dispose()
      renderer.dispose()
      sceneRef.current = null
      controlsRef.current = null
    }
  }, [])

  // Rebuild clean R6 rig live whenever previewAvatar changes (instant free Try-On!)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (rigRef.current) {
      scene.remove(rigRef.current.root)
      rigRef.current.dispose()
    }
    const rig = createR6Rig({
      avatar: previewAvatar,
      showNameplate: false,
      castShadow: true,
    })
    scene.add(rig.root)
    rigRef.current = rig
  }, [previewAvatar])

  const t = LOCALES[lang].avatar
  const tokens = getThemeTokens(mode)

  // Clicking a card: if owned -> equip immediately; if NOT owned -> FREE TRY-ON!
  const handleCardClick = (category: 'outfit' | 'hat' | 'face', itemId: string, isOwned: boolean) => {
    sfx.playClick()
    if (category === 'outfit') setPreviewAvatar((p) => ({ ...p, outfitId: itemId as OutfitId }))
    if (category === 'hat') setPreviewAvatar((p) => ({ ...p, hatId: itemId as R6AvatarConfig['hatId'] }))
    if (category === 'face') setPreviewAvatar((p) => ({ ...p, faceId: itemId as R6AvatarConfig['faceId'] }))

    if (isOwned) {
      onBuyAndEquip(category, itemId, 0)
    }
  }

  // Clicking explicit "Kup" button on a card buys & equips immediately!
  const handleBuyItem = (
    e: React.MouseEvent,
    category: 'outfit' | 'hat' | 'face',
    itemId: string,
    price: number,
  ) => {
    e.stopPropagation()
    const ok = onBuyAndEquip(category, itemId, price)
    if (ok) {
      sfx.playGemCollect()
      if (category === 'outfit') setPreviewAvatar((p) => ({ ...p, outfitId: itemId as OutfitId }))
      if (category === 'hat') setPreviewAvatar((p) => ({ ...p, hatId: itemId as R6AvatarConfig['hatId'] }))
      if (category === 'face') setPreviewAvatar((p) => ({ ...p, faceId: itemId as R6AvatarConfig['faceId'] }))
    }
  }

  // Buy all currently tried-on unowned items atomically in one click!
  const handleBuyTryOnBundle = () => {
    if (profile.freshGems < totalTryOnPrice || triedUnowned.length === 0) return
    const ok = onBuyBundle(triedUnowned.map(({ category, id, price }) => ({ category, id, price })))
    if (ok) sfx.playQuestClaim()
  }

  const handleResetPreview = () => {
    setPreviewAvatar({ ...profile.avatar })
    sfx.playClick()
  }

  const tabs: Array<{ id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'outfits', label: t.tabs.outfits, icon: Shirt },
    { id: 'hats', label: t.tabs.hats, icon: Crown },
    { id: 'faces', label: t.tabs.faces, icon: Smile },
    { id: 'skin', label: t.tabs.skin, icon: Palette },
  ]

  const renderCatalogGrid = <T extends string>(
    category: 'outfit' | 'hat' | 'face',
    items: Array<{ id: T; namePl: string; nameEn: string; descPl: string; descEn: string; price: number; accent: string }>,
    unlocked: T[],
    equippedOwnedId: T,
    previewedId: T,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const isOwned = unlocked.includes(item.id)
        const isEquipped = isOwned && equippedOwnedId === item.id
        const isTryingOn = !isOwned && previewedId === item.id
        const isSelected = previewedId === item.id
        const canAfford = profile.freshGems >= item.price
        const outfitSw = category === 'outfit' ? OUTFIT_SWATCHES[item.id as OutfitId] : null

        return (
          <div
            key={item.id}
            onClick={() => handleCardClick(category, item.id, isOwned)}
            className="group flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{
              background: isTryingOn
                ? 'linear-gradient(135deg, rgba(245,158,11,0.16) 0%, rgba(56,189,248,0.14) 100%)'
                : isSelected
                  ? tokens.heroGradient
                  : tokens.cardBg,
              borderColor: isTryingOn
                ? '#F59E0B'
                : isSelected
                  ? ARCTIC_SKY.skyMain
                  : tokens.cardBorder,
              boxShadow: isTryingOn
                ? '0 0 0 1px rgba(245,158,11,0.65)'
                : isSelected
                  ? `0 0 0 1px ${ARCTIC_SKY.skyMain}`
                  : 'none',
            }}
          >
            <div className="flex items-start gap-3">
              {/* Visual R6 Block Thumbnail Swatch */}
              {outfitSw ? (
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/20 bg-slate-950/35 p-1.5">
                  <div className="flex items-center gap-[2px]">
                    <span className="h-4 w-1.5 rounded-[2px]" style={{ background: outfitSw.arms }} />
                    <span className="h-4 w-4 rounded-[3px] border border-white/30" style={{ background: outfitSw.torso }} />
                    <span className="h-4 w-1.5 rounded-[2px]" style={{ background: outfitSw.arms }} />
                  </div>
                  <div className="mt-[2px] flex gap-[2px]">
                    <span className="h-3.5 w-2 rounded-[2px]" style={{ background: outfitSw.legs }} />
                    <span className="h-3.5 w-2 rounded-[2px]" style={{ background: outfitSw.legs }} />
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 shadow-inner"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${item.accent}, rgba(15,23,42,0.75))`,
                  }}
                >
                  {category === 'hat' ? (
                    <Crown className="h-5 w-5 text-white drop-shadow" />
                  ) : (
                    <Smile className="h-5 w-5 text-white drop-shadow" />
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-display text-sm font-extrabold leading-tight" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? item.namePl : item.nameEn}
                  </span>

                  {isEquipped ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-white"
                      style={{ background: tokens.buttonGradient }}
                    >
                      <Check className="h-3 w-3" /> {t.equipped}
                    </span>
                  ) : isTryingOn ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                      <Eye className="h-3 w-3" /> {t.tryingOn}
                    </span>
                  ) : isOwned ? (
                    <span
                      className="rounded-lg px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: tokens.badgeBg, color: tokens.badgeText }}
                    >
                      {t.equip}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold"
                      style={{
                        background: canAfford ? tokens.badgeBg : 'rgba(244,63,94,0.14)',
                        color: canAfford ? tokens.badgeText : '#FB7185',
                      }}
                    >
                      <FreshGemShard size={13} />
                      {item.price}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                  {lang === 'pl' ? item.descPl : item.descEn}
                </p>
              </div>
            </div>

            {/* Footer bar on locked items: Free Try-On indicator + 1-click Buy button */}
            {!isOwned && (
              <div
                className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2 text-[11px]"
                style={{ borderColor: tokens.cardBorder }}
              >
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: isTryingOn ? '#FBBF24' : tokens.textSecondary }}>
                  <Eye className="h-3.5 w-3.5" />
                  {isTryingOn ? t.tryingOn : t.tryOnHint}
                </span>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={(e) => handleBuyItem(e, category, item.id, item.price)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                    canAfford
                      ? 'text-white shadow-md hover:brightness-110 active:scale-95'
                      : 'opacity-55 cursor-not-allowed bg-rose-500/20 text-rose-300'
                  }`}
                  style={canAfford ? { background: tokens.buttonGradient } : undefined}
                >
                  {!canAfford && <Lock className="h-3 w-3" />}
                  {canAfford ? `${t.buy} • ${item.price}` : t.notEnough}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6 px-3 py-5 sm:px-6 sm:py-8 overflow-x-clip">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="max-w-2xl min-w-0">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase"
            style={{ background: tokens.badgeBg, color: tokens.badgeText, borderColor: `${ARCTIC_SKY.skyMain}44` }}
          >
            <Sparkles className="h-3 w-3" />
            <span>{t.tryBannerTitle} • 0% Pay-to-Win</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: tokens.textPrimary }}>
            {t.title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: tokens.textSecondary }}>
            {t.subtitle}
          </p>
        </div>

        <div className="flex w-full sm:w-auto flex-col items-stretch sm:items-end gap-1">
          <button
            onClick={onEnterLobby}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 cursor-pointer"
            style={{ background: tokens.buttonGradient }}
          >
            <Play className="h-4 w-4 fill-current shrink-0" />
            <span>{t.enterWithAvatar}</span>
          </button>
          {triedUnowned.length > 0 && (
            <span className="text-center sm:text-right text-[10px] font-semibold text-amber-400">
              {t.enterEquippedNote}
            </span>
          )}
        </div>
      </div>

      {/* Main Split: Flagship 3D Locker Room + Shop Catalog */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
        {/* Left: 3D Locker Room Showcase Stage */}
        <div
          className="min-w-0 flex flex-col overflow-hidden rounded-3xl border p-3 lg:col-span-5"
          style={{
            background: tokens.cardBg,
            borderColor: triedUnowned.length > 0 ? 'rgba(245,158,11,0.55)' : `${ARCTIC_SKY.skyMain}44`,
          }}
        >
          <div className="relative h-[350px] w-full overflow-hidden rounded-2xl sm:h-[430px]">
            <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

            {/* Top-left Status Badge */}
            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-950/70 px-3 py-1 text-[11px] font-bold text-sky-200 border border-sky-400/30 backdrop-blur">
                Classic R6 (1:1)
              </span>
              {triedUnowned.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-slate-950 shadow-lg">
                  <Eye className="h-3 w-3" />
                  {t.tryingOn} ({triedUnowned.length})
                </span>
              )}
            </div>

            {/* Top-right Studio Stage Controls (Day/Neon + Auto-Rotate) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStudioLight((s) => (s === 'day' ? 'neon' : 'day'))
                  sfx.playClick()
                }}
                className="flex items-center gap-1 rounded-xl bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-bold text-sky-100 border border-sky-400/30 backdrop-blur hover:bg-slate-900 cursor-pointer"
              >
                {studioLight === 'day' ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5 text-sky-300" />}
                <span>{studioLight === 'day' ? t.studioDay : t.studioNeon}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((r) => !r)}
                title="Auto-rotate"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur transition cursor-pointer ${
                  autoRotate
                    ? 'bg-sky-500/35 border-sky-300/60 text-white'
                    : 'bg-slate-950/70 border-slate-500/40 text-slate-300'
                }`}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-950/60 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
              {t.dragPreview}
            </div>
          </div>

          {/* LIVE TRY-ON CHECKOUT BAR (Appears whenever trying on 1+ unowned items!) */}
          {triedUnowned.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-400/45 bg-amber-500/10 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                  <Eye className="h-4 w-4 shrink-0" />
                  <span>{t.tryBannerTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetPreview}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold text-sky-100 hover:bg-slate-900 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t.resetPreview}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {triedUnowned.map((item) => (
                  <span
                    key={`${item.category}-${item.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-950/60 border border-amber-400/30 px-2 py-0.5 text-[11px] font-bold text-sky-50"
                  >
                    <span>{item.name}</span>
                    <FreshGemShard size={12} />
                    <span className="text-sky-300">{item.price}</span>
                  </span>
                ))}
              </div>

              <button
                type="button"
                disabled={profile.freshGems < totalTryOnPrice}
                onClick={handleBuyTryOnBundle}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  profile.freshGems >= totalTryOnPrice
                    ? 'text-white shadow-lg hover:brightness-110 active:scale-[0.98]'
                    : 'bg-rose-500/20 text-rose-300 cursor-not-allowed'
                }`}
                style={profile.freshGems >= totalTryOnPrice ? { background: tokens.buttonGradient } : undefined}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>
                  {profile.freshGems >= totalTryOnPrice
                    ? `${t.buySelected} (${totalTryOnPrice} Gems)`
                    : `${t.notEnough} (${totalTryOnPrice} Gems)`}
                </span>
              </button>
            </div>
          )}

          {/* Animation Tester Pills — Full Pro Showcase */}
          <div className="mt-3 px-0.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: tokens.textSecondary }}>
              {t.testAnim}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['idle', 'walk', 'run', 'jump', 'wave', 'dance', 'spin', 'backflip'] as PlayerPose[]).map((p) => {
                const active = previewPose === p
                return (
                  <button
                    key={p}
                    onClick={() => setPreviewPose(p)}
                    className="rounded-xl border px-1.5 py-2 text-[11px] font-bold capitalize transition cursor-pointer"
                    style={{
                      background: active ? tokens.buttonGradient : tokens.mutedBg,
                      borderColor: active ? 'transparent' : tokens.cardBorder,
                      color: active ? '#FFFFFF' : tokens.textPrimary,
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Category Tabs & FreshGems Catalog */}
        <div
          className="min-w-0 flex flex-col rounded-3xl border p-4 sm:p-5 backdrop-blur-md lg:col-span-7"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          {/* Category Switcher + Wallet Balance */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((tb) => {
                const Icon = tb.icon
                const active = tab === tb.id
                return (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer"
                    style={{
                      background: active ? tokens.buttonGradient : tokens.mutedBg,
                      borderColor: active ? 'transparent' : tokens.cardBorder,
                      color: active ? '#FFFFFF' : tokens.textSecondary,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tb.label}</span>
                  </button>
                )
              })}
            </div>

            <div
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-extrabold"
              style={{ borderColor: `${ARCTIC_SKY.skyMain}55`, background: tokens.badgeBg, color: tokens.textPrimary }}
            >
              <FreshGemShard size={19} />
              <span>{profile.freshGems.toLocaleString()}</span>
            </div>
          </div>

          {/* Active Catalog Content */}
          <div className="flex-1">
            {tab === 'outfits' &&
              renderCatalogGrid(
                'outfit',
                OUTFIT_CATALOG,
                profile.unlockedOutfits,
                profile.avatar.outfitId,
                previewAvatar.outfitId,
              )}
            {tab === 'hats' &&
              renderCatalogGrid(
                'hat',
                HAT_CATALOG,
                profile.unlockedHats,
                profile.avatar.hatId,
                previewAvatar.hatId,
              )}
            {tab === 'faces' &&
              renderCatalogGrid(
                'face',
                FACE_CATALOG,
                profile.unlockedFaces,
                profile.avatar.faceId,
                previewAvatar.faceId,
              )}
            {tab === 'skin' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {SKIN_SWATCHES.map((sw) => {
                  const active = previewAvatar.skinColor === sw.hex
                  return (
                    <button
                      key={sw.hex}
                      onClick={() => {
                        onSkinChange(sw.hex)
                        sfx.playChatPop()
                      }}
                      className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 cursor-pointer"
                      style={{
                        background: active ? tokens.heroGradient : tokens.mutedBg,
                        borderColor: active ? ARCTIC_SKY.skyMain : tokens.cardBorder,
                      }}
                    >
                      <span
                        className="h-10 w-10 shrink-0 rounded-xl border-2 border-white/60 shadow-inner"
                        style={{ background: sw.hex }}
                      />
                      <div>
                        <div className="text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                          {lang === 'pl' ? sw.namePl : sw.nameEn}
                        </div>
                        <div className="font-mono-code text-[10px]" style={{ color: tokens.textSecondary }}>
                          {sw.hex}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
