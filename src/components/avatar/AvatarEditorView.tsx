import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Check, Lock, Play, Shirt, Crown, Smile, Palette } from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import {
  FACE_CATALOG,
  HAT_CATALOG,
  OUTFIT_CATALOG,
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
  onSkinChange: (hex: string) => void
  onEnterLobby: () => void
}

type EditorTab = 'outfits' | 'hats' | 'faces' | 'skin'

export const AvatarEditorView: React.FC<AvatarEditorViewProps> = ({
  profile,
  mode,
  lang,
  onBuyAndEquip,
  onSkinChange,
  onEnterLobby,
}) => {
  const [tab, setTab] = useState<EditorTab>('outfits')
  const [previewPose, setPreviewPose] = useState<PlayerPose>('idle')
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rigRef = useRef<R6RigHandle | null>(null)
  const poseRef = useRef<PlayerPose>(previewPose)
  poseRef.current = previewPose

  // Initialize crisp, fast Three.js fresh-day R6 preview pedestal
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const disposables: Array<{ dispose: () => void }> = []
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
    scene.background = new THREE.Color(0xd7effe)
    scene.fog = new THREE.Fog(0xd7effe, 14, 30)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 420) / (container.clientHeight || 440),
      0.1,
      60,
    )
    camera.position.set(0, 2.55, 8.8)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 1.95, 0)
    controls.minDistance = 4.8
    controls.maxDistance = 12.5
    controls.maxPolarAngle = Math.PI * 0.52
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.75

    // Fresh-day lighting
    scene.add(new THREE.HemisphereLight(0xf4fbff, 0x5c8ab5, 1.25))
    const sun = new THREE.DirectionalLight(0xffffff, 1.7)
    sun.position.set(6, 11, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(512, 512)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.95)
    rim.position.set(-6, 4, -5)
    scene.add(rim)

    // Fresh Glossy Studded Pedestal (lightweight MeshStandardMaterial)
    const studMap = getSharedFreshStudTexture().clone()
    studMap.needsUpdate = true
    studMap.repeat.set(2, 2)
    disposables.push(studMap)

    const pedGeo = new RoundedBoxGeometry(3.8, 0.44, 3.8, 2, 0.12)
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      map: studMap,
      roughness: 0.24,
      metalness: 0.05,
    })
    disposables.push(pedGeo, pedMat)
    const ped = new THREE.Mesh(pedGeo, pedMat)
    ped.position.y = -0.22
    ped.receiveShadow = true
    scene.add(ped)

    const trimGeo = new RoundedBoxGeometry(3.4, 0.28, 3.4, 2, 0.08)
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.08,
    })
    disposables.push(trimGeo, trimMat)
    const trim = new THREE.Mesh(trimGeo, trimMat)
    trim.position.y = -0.56
    scene.add(trim)

    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt
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
    }
  }, [])

  // Rebuild clean R6 rig live whenever avatar config updates (zero leaks!)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (rigRef.current) {
      scene.remove(rigRef.current.root)
      rigRef.current.dispose()
    }
    const rig = createR6Rig({
      avatar: profile.avatar,
      showNameplate: false,
      castShadow: true,
    })
    scene.add(rig.root)
    rigRef.current = rig
  }, [profile.avatar])

  const t = LOCALES[lang].avatar
  const tokens = getThemeTokens(mode)

  const handleSelectItem = (category: 'outfit' | 'hat' | 'face', itemId: string, price: number) => {
    const ok = onBuyAndEquip(category, itemId, price)
    if (ok) {
      sfx.playGemCollect()
    }
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
    equippedId: T,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const isOwned = unlocked.includes(item.id)
        const isEquipped = equippedId === item.id
        const canAfford = profile.freshGems >= item.price

        return (
          <div
            key={item.id}
            onClick={() => handleSelectItem(category, item.id, item.price)}
            className="flex flex-col justify-between rounded-2xl border p-4 transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{
              background: isEquipped ? tokens.heroGradient : tokens.cardBg,
              borderColor: isEquipped ? ARCTIC_SKY.skyMain : tokens.cardBorder,
              boxShadow: isEquipped ? `0 0 0 1px ${ARCTIC_SKY.skyMain}` : 'none',
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ background: item.accent }} />
                  <span className="font-display text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? item.namePl : item.nameEn}
                  </span>
                </span>

                {isEquipped ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold text-white"
                    style={{ background: tokens.buttonGradient }}
                  >
                    <Check className="h-3 w-3" /> {t.equipped}
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
                    {!canAfford && <Lock className="h-2.5 w-2.5" />}
                    <FreshGemShard size={14} />
                    {item.price}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
                {lang === 'pl' ? item.descPl : item.descEn}
              </p>
            </div>

            {!isOwned && (
              <div className="mt-3 pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: tokens.cardBorder }}>
                <span style={{ color: canAfford ? ARCTIC_SKY.skyMain : '#FB7185' }} className="font-bold">
                  {canAfford ? `${t.buy} (${item.price} Gems)` : t.notEnough}
                </span>
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
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: tokens.textPrimary }}>
            {t.title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: tokens.textSecondary }}>
            {t.subtitle}
          </p>
        </div>

        <button
          onClick={onEnterLobby}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:px-5 text-xs sm:text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 cursor-pointer"
          style={{ background: tokens.buttonGradient }}
        >
          <Play className="h-4 w-4 fill-current shrink-0" />
          <span>{t.enterWithAvatar}</span>
        </button>
      </div>

      {/* Main Split: 3D R6 Turntable + Shop Panel */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
        {/* Left: 3D R6 Live Stage */}
        <div
          className="min-w-0 flex flex-col overflow-hidden rounded-3xl border p-3 lg:col-span-5"
          style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
        >
          <div className="relative h-[340px] w-full overflow-hidden rounded-2xl sm:h-[430px]">
            <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
            <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-slate-950/60 px-3 py-1 text-[11px] font-bold text-sky-200 backdrop-blur">
              Classic R6 (1:1) • Pro Animations
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-slate-950/55 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
              {t.dragPreview}
            </div>
          </div>

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
              <FreshGemShard size={20} />
              <span>{profile.freshGems.toLocaleString()}</span>
            </div>
          </div>

          {/* Active Catalog Content */}
          <div className="flex-1">
            {tab === 'outfits' &&
              renderCatalogGrid('outfit', OUTFIT_CATALOG, profile.unlockedOutfits, profile.avatar.outfitId)}
            {tab === 'hats' && renderCatalogGrid('hat', HAT_CATALOG, profile.unlockedHats, profile.avatar.hatId)}
            {tab === 'faces' && renderCatalogGrid('face', FACE_CATALOG, profile.unlockedFaces, profile.avatar.faceId)}
            {tab === 'skin' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {SKIN_SWATCHES.map((sw) => {
                  const active = profile.avatar.skinColor === sw.hex
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
