import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  Bookmark,
  Bot,
  Check,
  Crown,
  Eye,
  Feather,
  Lock,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Save,
  Shirt,
  ShoppingBag,
  Smile,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import {
  BACK_CATALOG,
  BackId,
  CatalogItem,
  FACE_CATALOG,
  GEMS_SYSTEM_IN_PROGRESS,
  getCoinPrice,
  HAT_CATALOG,
  OUTFIT_CATALOG,
  OutfitId,
  PET_CATALOG,
  PetId,
  R6AvatarConfig,
  SKIN_SWATCHES,
  TRAIL_CATALOG,
  TrailId,
} from '../../data/catalog'
import { PlayerProfile } from '../../store/usePlayerStore'
import { FreshGemShard } from '../brand/FreshBloxBrand'
import { createR6Rig, R6RigHandle } from '../../engine/r6Builder'
import { cloneFreshTexturesWithRepeat } from '../../engine/freshTextures'
import { PlayerPose } from '../../lib/multiplayer'
import { sfx } from '../../lib/sfx'

interface AvatarEditorViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onBuyWithCoins: (category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet', itemId: string) => Promise<boolean>
  onBuyAndEquip: (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    price: number,
    currency?: 'gems' | 'coins',
  ) => boolean
  onBuyBundle: (items: Array<{ category: 'outfit' | 'hat' | 'face'; id: string; price: number }>) => boolean
  onSkinChange: (hex: string) => void
  onSaveOutfitSlot?: (slot: number, name: string, avatar: R6AvatarConfig) => void
  onDeleteOutfitSlot?: (slot: number) => void
  onApplySavedOutfit?: (avatar: R6AvatarConfig) => void
  onEnterLobby: () => void
}

type EditorTab = 'outfits' | 'hats' | 'faces' | 'backs' | 'pets' | 'trails' | 'skin' | 'presets'
type StudioLighting = 'day' | 'night'

const OUTFIT_SWATCHES: Record<OutfitId, { torso: string; arms: string; legs: string }> = {
  'fresh-creator': { torso: '#0EA5E9', arms: '#38BDF8', legs: '#1E3A8A' },
  'classic-remaster': { torso: '#2563EB', arms: '#FDE0B6', legs: '#22C55E' },
  'arctic-frost': { torso: '#E0F2FE', arms: '#7DD3FC', legs: '#0369A1' },
  'midnight-slate': { torso: '#0F172A', arms: '#0284C7', legs: '#1E293B' },
  'glacier-captain': { torso: '#0891B2', arms: '#E0F2FE', legs: '#0C4A6E' },
  'crystal-royal': { torso: '#38BDF8', arms: '#F8FAFC', legs: '#1D4ED8' },
}

export const AvatarEditorView: React.FC<AvatarEditorViewProps> = ({
  profile,
  mode,
  lang,
  onBuyAndEquip,
  onBuyWithCoins,
  onBuyBundle,
  onSkinChange,
  onSaveOutfitSlot,
  onDeleteOutfitSlot,
  onApplySavedOutfit,
  onEnterLobby,
}) => {
  const [tab, setTab] = useState<EditorTab>('outfits')
  const [slotNames, setSlotNames] = useState<Record<number, string>>({})
  const [previewPose, setPreviewPose] = useState<PlayerPose>('idle')
  const [studioLight, setStudioLight] = useState<StudioLighting>('day')

  // Free Try-On preview avatar (can combine unowned outfits, hats & faces before buying!)
  const [previewAvatar, setPreviewAvatar] = useState<R6AvatarConfig>(() => ({ ...profile.avatar }))

  useEffect(() => {
    setPreviewAvatar((prev) => ({ ...prev, skinColor: profile.avatar.skinColor }))
  }, [profile.avatar.skinColor])

  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rigRef = useRef<R6RigHandle | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const hemiRef = useRef<THREE.HemisphereLight | null>(null)
  const sunRef = useRef<THREE.DirectionalLight | null>(null)
  const fillRef = useRef<THREE.DirectionalLight | null>(null)
  const dayGroupRef = useRef<THREE.Group | null>(null)
  const nightGroupRef = useRef<THREE.Group | null>(null)
  const podiumMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const trimMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const archMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const poseRef = useRef<PlayerPose>(previewPose)
  poseRef.current = previewPose

  // Compute unowned items currently being tried on
  const triedUnowned = useMemo(() => {
    const list: Array<{
      category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet'
      id: string
      name: string
      price: number
      rewardOnly?: 'obby100' | 'arenaWin' | 'arenaMeteor' | 'frisbeeWin'
    }> = []

    if (!profile.unlockedOutfits.includes(previewAvatar.outfitId)) {
      const it = OUTFIT_CATALOG.find((x) => x.id === previewAvatar.outfitId)
      if (it)
        list.push({
          category: 'outfit',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    if (!profile.unlockedHats.includes(previewAvatar.hatId)) {
      const it = HAT_CATALOG.find((x) => x.id === previewAvatar.hatId)
      if (it)
        list.push({
          category: 'hat',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    if (!profile.unlockedFaces.includes(previewAvatar.faceId)) {
      const it = FACE_CATALOG.find((x) => x.id === previewAvatar.faceId)
      if (it)
        list.push({
          category: 'face',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    const backId = (previewAvatar.backId ?? 'none') as BackId
    if (!profile.unlockedBacks.includes(backId)) {
      const it = BACK_CATALOG.find((x) => x.id === backId)
      if (it)
        list.push({
          category: 'back',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    const trailId = (previewAvatar.trailId ?? 'none') as TrailId
    if (!profile.unlockedTrails.includes(trailId)) {
      const it = TRAIL_CATALOG.find((x) => x.id === trailId)
      if (it)
        list.push({
          category: 'trail',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    const petId = (previewAvatar.petId ?? 'none') as PetId
    if (!profile.unlockedPets.includes(petId)) {
      const it = PET_CATALOG.find((x) => x.id === petId)
      if (it)
        list.push({
          category: 'pet',
          id: it.id,
          name: lang === 'pl' ? it.namePl : it.nameEn,
          price: it.price,
          rewardOnly: it.rewardOnly,
        })
    }
    return list
  }, [
    previewAvatar,
    profile.unlockedOutfits,
    profile.unlockedHats,
    profile.unlockedFaces,
    profile.unlockedBacks,
    profile.unlockedTrails,
    profile.unlockedPets,
    lang,
  ])

  const purchasableTried = useMemo(
    () =>
      triedUnowned.filter(
        (i): i is { category: 'outfit' | 'hat' | 'face'; id: string; name: string; price: number } =>
          !i.rewardOnly && (i.category === 'outfit' || i.category === 'hat' || i.category === 'face'),
      ),
    [triedUnowned],
  )
  const hasRewardOnlyTried = useMemo(() => triedUnowned.some((i) => Boolean(i.rewardOnly)), [triedUnowned])
  const totalTryOnPrice = useMemo(() => purchasableTried.reduce((acc, i) => acc + i.price, 0), [purchasableTried])

  // Apply natural Day / Night lighting live (clean sky & moonlight — zero neon!)
  useEffect(() => {
    const scene = sceneRef.current
    const hemi = hemiRef.current
    const sun = sunRef.current
    const fill = fillRef.current
    if (!scene) return

    if (studioLight === 'day') {
      scene.background = new THREE.Color('#D4EEFF')
      scene.fog = new THREE.Fog('#D4EEFF', 16, 38)
      if (hemi) {
        hemi.color.set('#F5FBFF')
        hemi.groundColor.set('#7BB4DC')
        hemi.intensity = 1.25
      }
      if (sun) {
        sun.color.set('#FFFDF7')
        sun.intensity = 1.65
        sun.position.set(6, 11, 8)
      }
      if (fill) {
        fill.color.set('#BAE6FD')
        fill.intensity = 0.72
      }
      if (dayGroupRef.current) dayGroupRef.current.visible = true
      if (nightGroupRef.current) nightGroupRef.current.visible = false
      if (podiumMatRef.current) podiumMatRef.current.color.set('#F4FAFF')
      if (trimMatRef.current) trimMatRef.current.color.set('#7DD3FC')
      if (archMatRef.current) archMatRef.current.color.set('#E2F1FC')
    } else {
      scene.background = new THREE.Color('#0B1528')
      scene.fog = new THREE.Fog('#0B1528', 16, 38)
      if (hemi) {
        hemi.color.set('#94B8E0')
        hemi.groundColor.set('#14233C')
        hemi.intensity = 0.85
      }
      if (sun) {
        // Soft natural moonlight from upper right
        sun.color.set('#DCEBFF')
        sun.intensity = 1.2
        sun.position.set(5, 10, 7)
      }
      if (fill) {
        // Warm subtle lantern fill so avatar colors stay natural and clear at night
        fill.color.set('#FFE6C4')
        fill.intensity = 0.75
      }
      if (dayGroupRef.current) dayGroupRef.current.visible = false
      if (nightGroupRef.current) nightGroupRef.current.visible = true
      if (podiumMatRef.current) podiumMatRef.current.color.set('#CAD9EA')
      if (trimMatRef.current) trimMatRef.current.color.set('#47698F')
      if (archMatRef.current) archMatRef.current.color.set('#223552')
    }
  }, [studioLight])

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 2.5, 8.6)
      controlsRef.current.target.set(0, 1.9, 0)
      controlsRef.current.update()
    }
  }

  // Initialize Clean Fresh Glossy 3D Locker Terrace (Day & Starry Night — Zero Neon!)
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
    renderer.toneMappingExposure = 1.06
    renderer.domElement.style.touchAction = 'none'
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#D4EEFF')
    scene.fog = new THREE.Fog('#D4EEFF', 16, 38)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 420) / (container.clientHeight || 440),
      0.1,
      70,
    )
    camera.position.set(0, 2.5, 8.6)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.target.set(0, 1.9, 0)
    controls.minDistance = 4.8
    controls.maxDistance = 12.2
    controls.maxPolarAngle = Math.PI * 0.52
    controls.autoRotate = false
    controlsRef.current = controls

    // Natural 3-point outdoor lighting (Sun / Moon + Soft Sky Fill)
    const hemi = new THREE.HemisphereLight('#F5FBFF', '#7BB4DC', 1.25)
    scene.add(hemi)
    hemiRef.current = hemi

    const sun = new THREE.DirectionalLight('#FFFDF7', 1.65)
    sun.position.set(6, 11, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(512, 512)
    scene.add(sun)
    sunRef.current = sun

    const fill = new THREE.DirectionalLight('#BAE6FD', 0.72)
    fill.position.set(-6, 5, -5)
    scene.add(fill)
    fillRef.current = fill

    // === CLEAN FRESH ARCHITECTURAL MARBLE PODIUM (ZERO STUDS / ZERO NEON) ===
    const podiumTex = cloneFreshTexturesWithRepeat('marble', 2, 2, track)
    const flutedTex = cloneFreshTexturesWithRepeat('fluted', 1, 2, track)
    const baseStoneTex = cloneFreshTexturesWithRepeat('terrazzo', 3, 1, track)

    const podiumMat = track(
      new THREE.MeshStandardMaterial({
        color: '#F4FAFF',
        map: podiumTex.map,
        bumpMap: podiumTex.bumpMap,
        bumpScale: podiumTex.bumpScale,
        roughness: 0.28,
        metalness: 0.05,
      }),
    )
    podiumMatRef.current = podiumMat

    const topDisc = new THREE.Mesh(track(new THREE.CylinderGeometry(2.35, 2.55, 0.34, 32)), podiumMat)
    topDisc.position.y = -0.17
    topDisc.receiveShadow = true
    scene.add(topDisc)

    // Clean satin sky-stone trim ring (no emissive neon!)
    const trimMat = track(
      new THREE.MeshStandardMaterial({
        color: '#7DD3FC',
        roughness: 0.24,
        metalness: 0.14,
      }),
    )
    trimMatRef.current = trimMat
    const trimRing = new THREE.Mesh(track(new THREE.TorusGeometry(2.44, 0.06, 10, 48)), trimMat)
    trimRing.rotation.x = Math.PI / 2
    trimRing.position.y = -0.02
    scene.add(trimRing)

    const lowerBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.9, 3.15, 0.38, 32)),
      track(
        new THREE.MeshStandardMaterial({
          color: '#334155',
          map: baseStoneTex.map,
          bumpMap: baseStoneTex.bumpMap,
          bumpScale: baseStoneTex.bumpScale,
          roughness: 0.44,
          metalness: 0.08,
        }),
      ),
    )
    lowerBase.position.y = -0.52
    lowerBase.receiveShadow = true
    scene.add(lowerBase)

    // Subtle open-air pavilion backdrop fluted columns (matte architectural stone — no LED strips!)
    const archMat = track(
      new THREE.MeshStandardMaterial({
        color: '#E2F1FC',
        map: flutedTex.map,
        bumpMap: flutedTex.bumpMap,
        bumpScale: flutedTex.bumpScale,
        roughness: 0.36,
        metalness: 0.05,
      }),
    )
    archMatRef.current = archMat
    const pillarGeo = track(new RoundedBoxGeometry(0.56, 5.8, 0.56, 2, 0.09))

    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, archMat)
      p.position.set(side * 4.3, 2.2, -4.1)
      p.rotation.y = side * -0.18
      p.receiveShadow = true
      scene.add(p)
    }

    const topBeam = new THREE.Mesh(track(new RoundedBoxGeometry(9.6, 0.42, 0.68, 2, 0.1)), archMat)
    topBeam.position.set(0, 5.25, -4.1)
    scene.add(topBeam)

    // === DAY SKY DETAILS (Soft stylized FreshBlox clouds) ===
    const dayGroup = new THREE.Group()
    const cloudMat = track(new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.55 }))
    const cloudSpecs: Array<[number, number, number, number, number, number]> = [
      [-6.5, 6.2, -10, 3.6, 0.85, 1.6],
      [-5.2, 6.75, -10, 2.2, 0.7, 1.4],
      [6.2, 5.6, -11, 3.8, 0.85, 1.6],
      [7.4, 6.15, -11, 2.1, 0.65, 1.3],
      [0.4, 7.6, -13, 3.2, 0.75, 1.5],
    ]
    for (const [cx, cy, cz, cw, ch, cd] of cloudSpecs) {
      const cm = new THREE.Mesh(track(new RoundedBoxGeometry(cw, ch, cd, 2, 0.25)), cloudMat)
      cm.position.set(cx, cy, cz)
      dayGroup.add(cm)
    }
    scene.add(dayGroup)
    dayGroupRef.current = dayGroup

    // === NIGHT SKY DETAILS (Natural Moon + Gentle Starfield — Zero Neon!) ===
    const nightGroup = new THREE.Group()
    nightGroup.visible = false

    const moon = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.95, 20, 16)),
      track(new THREE.MeshBasicMaterial({ color: '#F4F7FF' })),
    )
    moon.position.set(5.6, 6.8, -14)
    nightGroup.add(moon)

    const starCoords: Array<[number, number, number, number]> = [
      [-8.5, 7.8, -14, 0.08],
      [-6.2, 6.4, -15, 0.06],
      [-4.1, 8.2, -14, 0.07],
      [-2.3, 6.9, -15, 0.05],
      [-0.6, 8.6, -15, 0.08],
      [1.8, 7.4, -14, 0.06],
      [3.1, 8.5, -15, 0.07],
      [8.2, 7.6, -14, 0.07],
      [7.1, 4.9, -15, 0.05],
      [-7.4, 4.6, -15, 0.06],
      [-3.2, 4.4, -16, 0.05],
      [2.6, 5.1, -16, 0.05],
      [-9.6, 5.9, -15, 0.07],
      [9.4, 6.1, -15, 0.06],
    ]
    const starGeo = track(new THREE.OctahedronGeometry(1, 0))
    const starMat = track(new THREE.MeshBasicMaterial({ color: '#E2ECFF' }))
    for (const [sx, sy, sz, sr] of starCoords) {
      const st = new THREE.Mesh(starGeo, starMat)
      st.position.set(sx, sy, sz)
      st.scale.setScalar(sr)
      nightGroup.add(st)
    }
    scene.add(nightGroup)
    nightGroupRef.current = nightGroup

    let rafId = 0
    let lastTime = performance.now()
    let elapsed = 0
    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      elapsed += dt
      dayGroup.position.x = Math.sin(elapsed * 0.14) * 0.45
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
      dayGroupRef.current = null
      nightGroupRef.current = null
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

  const handleCardClick = (
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    isOwned: boolean,
  ) => {
    sfx.playClick()
    if (category === 'outfit') setPreviewAvatar((p) => ({ ...p, outfitId: itemId as OutfitId }))
    if (category === 'hat') setPreviewAvatar((p) => ({ ...p, hatId: itemId as R6AvatarConfig['hatId'] }))
    if (category === 'face') setPreviewAvatar((p) => ({ ...p, faceId: itemId as R6AvatarConfig['faceId'] }))
    if (category === 'back') setPreviewAvatar((p) => ({ ...p, backId: itemId as BackId }))
    if (category === 'trail') setPreviewAvatar((p) => ({ ...p, trailId: itemId as TrailId }))
    if (category === 'pet') setPreviewAvatar((p) => ({ ...p, petId: itemId as PetId }))

    if (isOwned) {
      onBuyAndEquip(category, itemId, 0)
    }
  }

  const [coinBusy, setCoinBusy] = useState(false)
  const [coinMessage, setCoinMessage] = useState('')
  const handleBuyItem = async (
    e: React.MouseEvent,
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    itemId: string,
    price: number,
    currency: 'gems' | 'coins' = 'gems',
  ) => {
    e.stopPropagation()
    const balance = currency === 'coins' ? (profile.freshCoins ?? 0) : profile.freshGems
    if (balance < price) return
    if (currency === 'coins' && coinBusy) return
    let ok = false
    if (currency === 'coins') {
      setCoinBusy(true)
      try { ok = await onBuyWithCoins(category, itemId) } catch { ok = false } finally { setCoinBusy(false) }
      setCoinMessage(ok ? (lang === 'pl' ? 'Zakup zapisany na koncie.' : 'Purchase saved.') : (lang === 'pl' ? 'Zakup niepotwierdzony. Odśwież saldo i spróbuj ponownie.' : 'Purchase not confirmed. Refresh your balance and retry.'))
    } else ok = onBuyAndEquip(category, itemId, price, currency)
    if (ok) {
      sfx.playGemCollect()
      if (category === 'outfit') setPreviewAvatar((p) => ({ ...p, outfitId: itemId as OutfitId }))
      if (category === 'hat') setPreviewAvatar((p) => ({ ...p, hatId: itemId as R6AvatarConfig['hatId'] }))
      if (category === 'face') setPreviewAvatar((p) => ({ ...p, faceId: itemId as R6AvatarConfig['faceId'] }))
      if (category === 'back') setPreviewAvatar((p) => ({ ...p, backId: itemId as BackId }))
      if (category === 'trail') setPreviewAvatar((p) => ({ ...p, trailId: itemId as TrailId }))
      if (category === 'pet') setPreviewAvatar((p) => ({ ...p, petId: itemId as PetId }))
    }
  }

  const handleBuyTryOnBundle = () => {
    if (profile.freshGems < totalTryOnPrice || purchasableTried.length === 0) return
    const ok = onBuyBundle(purchasableTried.map(({ category, id, price }) => ({ category, id, price })))
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
    { id: 'backs', label: lang === 'pl' ? 'Skrzydła & Plecaki 3D' : '3D Wings & Backs', icon: Feather },
    { id: 'pets', label: lang === 'pl' ? 'Pety 3D (Kompani)' : '3D Companion Pets', icon: Bot },
    { id: 'trails', label: lang === 'pl' ? 'Ślady stóp 3D' : '3D Footstep Trails', icon: Sparkles },
    { id: 'skin', label: t.tabs.skin, icon: Palette },
    { id: 'presets', label: lang === 'pl' ? 'Zapisane zestawy (5)' : 'Saved Outfits (5)', icon: Bookmark },
  ]

  const renderCatalogGrid = <T extends string>(
    category: 'outfit' | 'hat' | 'face' | 'trail' | 'back' | 'pet',
    items: CatalogItem<T>[],
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
        const isRewardOnly = Boolean(item.rewardOnly)
        const canAfford = !isRewardOnly && !GEMS_SYSTEM_IN_PROGRESS && profile.freshGems >= item.price
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
                  ) : category === 'back' ? (
                    <Feather className="h-5 w-5 text-white drop-shadow" />
                  ) : category === 'pet' ? (
                    <Bot className="h-5 w-5 text-white drop-shadow" />
                  ) : category === 'trail' ? (
                    <Sparkles className="h-5 w-5 text-white drop-shadow" />
                  ) : (
                    <Smile className="h-5 w-5 text-white drop-shadow" />
                  )}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-sm font-extrabold" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? item.namePl : item.nameEn}
                  </span>

                  {isEquipped ? (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: tokens.buttonGradient }}
                      title={t.equipped}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>
                  ) : isTryingOn ? (
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950"
                      title={t.tryingOn}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </span>
                  ) : isOwned ? null : isRewardOnly ? (
                    <span
                      title={
                        item.id === 'golden-meteor' || item.id === 'solar-halo-wings'
                          ? lang === 'pl'
                            ? 'Nagroda za grę w Portal Arena'
                            : 'Portal Arena Reward'
                          : lang === 'pl'
                            ? 'Nagroda za Stage 100 w Parkour'
                            : 'Stage 100 Parkour Reward'
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/18 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-300"
                    >
                      <Trophy className="h-3 w-3" />
                      {item.id === 'golden-meteor' || item.id === 'solar-halo-wings' ? 'ARENA' : '100'}
                    </span>
                  ) : GEMS_SYSTEM_IN_PROGRESS ? (
                    <span
                      title={LOCALES[lang].gemsNotice.shopLocked}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                    >
                      <Lock className="h-3 w-3" />
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={!canAfford}
                        title={lang === 'pl' ? 'Kup za FreshGems (taniej)' : 'Buy with FreshGems (cheaper)'}
                        onClick={(e) => handleBuyItem(e, category, item.id, item.price, 'gems')}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold transition cursor-pointer ${
                          canAfford ? 'text-white hover:brightness-110' : 'opacity-60 cursor-not-allowed'
                        }`}
                        style={{
                          background: canAfford ? tokens.buttonGradient : 'rgba(244,63,94,0.14)',
                          color: canAfford ? '#FFFFFF' : '#FB7185',
                        }}
                      >
                        <FreshGemShard size={12} />
                        {item.price}
                      </button>
                      {(() => {
                        const cPrice = getCoinPrice(item)
                        const canAffordCoins = (profile.freshCoins ?? 0) >= cPrice
                        return (
                          <button
                            type="button"
                            disabled={!canAffordCoins || coinBusy}
                            title={lang === 'pl' ? 'Kup za FreshCoins (zdobywane w grach)' : 'Buy with FreshCoins (earned in games)'}
                            onClick={(e) => handleBuyItem(e, category, item.id, cPrice, 'coins')}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold transition cursor-pointer ${
                              canAffordCoins
                                ? 'border-amber-400/50 bg-amber-500/25 text-amber-200 hover:bg-amber-500/40'
                                : 'border-amber-400/20 bg-amber-500/10 text-amber-300/60 opacity-65 cursor-not-allowed'
                            }`}
                          >
                            <span>🪙</span>
                            {cPrice}
                          </button>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6 overflow-x-clip">
      {coinMessage && <p role="status" className="rounded-lg bg-slate-800 p-3 text-sm text-white">{coinMessage}</p>}
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Shirt className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
          <h1 className="font-display text-lg font-extrabold sm:text-xl" style={{ color: tokens.textPrimary }}>
            {lang === 'pl' ? 'Szatnia awatarów' : 'Avatar Wardrobe'}
          </h1>
        </div>

        <button
          onClick={onEnterLobby}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-lg transition hover:brightness-110 cursor-pointer"
          style={{ background: tokens.buttonGradient }}
        >
          <Play className="h-3.5 w-3.5 fill-current shrink-0" />
          <span>{lang === 'pl' ? 'GRAJ' : 'PLAY'}</span>
        </button>
      </div>

      {/* Main Split: Clean 3D Locker Terrace + Shop Catalog */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
        {/* Left: 3D Locker Showcase Stage */}
        <div
          className="min-w-0 flex flex-col overflow-hidden rounded-3xl border p-3 lg:col-span-5"
          style={{
            background: tokens.cardBg,
            borderColor: triedUnowned.length > 0 ? 'rgba(245,158,11,0.55)' : `${ARCTIC_SKY.skyMain}44`,
          }}
        >
          <div className="relative h-[340px] w-full overflow-hidden rounded-2xl sm:h-[410px]">
            <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

            {/* Top-left Status Badge */}
            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5">
              <span className="rounded-full bg-slate-950/65 px-2.5 py-0.5 font-mono text-[10px] font-bold text-sky-200 border border-white/15 backdrop-blur">
                3D
              </span>
              {triedUnowned.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow">
                  <Eye className="h-3 w-3" />
                  {triedUnowned.length}
                </span>
              )}
            </div>

            {/* Top-right Icon Controls (Day/Night + Reset Camera Angle) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStudioLight((s) => (s === 'day' ? 'night' : 'day'))
                  sfx.playClick()
                }}
                title={studioLight === 'day' ? t.studioNight : t.studioDay}
                aria-label="Toggle lighting"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/65 text-sky-100 border border-white/15 backdrop-blur hover:bg-slate-900 cursor-pointer"
              >
                {studioLight === 'day' ? (
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-sky-200" />
                )}
              </button>

              <button
                type="button"
                onClick={handleResetCamera}
                title={lang === 'pl' ? 'Wyśrodkuj widok' : 'Reset camera view'}
                aria-label={lang === 'pl' ? 'Wyśrodkuj widok' : 'Reset camera view'}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/65 text-sky-100 border border-white/15 backdrop-blur hover:bg-slate-900 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* LIVE TRY-ON CHECKOUT BAR */}
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
                    {item.rewardOnly ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-300">
                        <Trophy className="h-3 w-3" /> Parkour
                      </span>
                    ) : (
                      <>
                        <FreshGemShard size={12} />
                        <span className="text-sky-300">{item.price}</span>
                      </>
                    )}
                  </span>
                ))}
              </div>

              {hasRewardOnlyTried && purchasableTried.length === 0 ? (
                <div className="rounded-xl border border-amber-400/40 bg-slate-950/55 px-3 py-2 text-xs font-bold text-amber-200 leading-snug">
                  {lang === 'pl'
                    ? '👑 Ta korona jest ekskluzywną nagrodą! Ukończ Parkour (Stage 100), aby odblokować ją na stałe.'
                    : '👑 Exclusive reward! Complete Parkour (Stage 100) to unlock this crown permanently.'}
                </div>
              ) : GEMS_SYSTEM_IN_PROGRESS ? (
                <div className="rounded-xl border border-amber-400/35 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-amber-200 leading-snug">
                  {LOCALES[lang].gemsNotice.desc}
                </div>
              ) : (
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
              )}
            </div>
          )}

          {/* Animation Tester Pills */}
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
          <div className="mb-4 flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex flex-wrap gap-1 rounded-2xl border p-1" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              {tabs.map((tb) => {
                const Icon = tb.icon
                const active = tab === tb.id
                return (
                  <button
                    key={tb.id}
                    type="button"
                    title={tb.label}
                    aria-label={tb.label}
                    onClick={() => setTab(tb.id)}
                    className="flex h-9 w-9 sm:w-10 items-center justify-center rounded-xl transition cursor-pointer"
                    style={{
                      background: active ? tokens.buttonGradient : 'transparent',
                      color: active ? '#FFFFFF' : tokens.textSecondary,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>

            <div
              title={GEMS_SYSTEM_IN_PROGRESS ? LOCALES[lang].gemsNotice.short : `${profile.freshGems} FreshGems`}
              className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold"
              style={{
                borderColor: GEMS_SYSTEM_IN_PROGRESS ? 'rgba(245,158,11,0.4)' : `${ARCTIC_SKY.skyMain}50`,
                background: GEMS_SYSTEM_IN_PROGRESS ? 'rgba(245,158,11,0.12)' : tokens.badgeBg,
                color: GEMS_SYSTEM_IN_PROGRESS ? '#FBBF24' : tokens.textPrimary,
              }}
            >
              <FreshGemShard size={15} />
              {GEMS_SYSTEM_IN_PROGRESS ? <Lock className="h-3.5 w-3.5" /> : <span>{profile.freshGems.toLocaleString()}</span>}
            </div>
          </div>

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
            {tab === 'backs' &&
              renderCatalogGrid(
                'back',
                BACK_CATALOG,
                profile.unlockedBacks,
                (profile.avatar.backId ?? 'none') as BackId,
                (previewAvatar.backId ?? 'none') as BackId,
              )}
            {tab === 'pets' &&
              renderCatalogGrid(
                'pet',
                PET_CATALOG,
                profile.unlockedPets,
                (profile.avatar.petId ?? 'none') as PetId,
                (previewAvatar.petId ?? 'none') as PetId,
              )}
            {tab === 'trails' &&
              renderCatalogGrid(
                'trail',
                TRAIL_CATALOG,
                profile.unlockedTrails,
                (profile.avatar.trailId ?? 'none') as TrailId,
                (previewAvatar.trailId ?? 'none') as TrailId,
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
            {tab === 'presets' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: tokens.textSecondary }}>
                  <span>
                    {lang === 'pl'
                      ? 'Zapisz do 5 kompletnych strojów i przełączaj je 1 kliknięciem (synchronizowane w chmurze).'
                      : 'Save up to 5 complete outfits and swap them in 1 click (cloud synced).'}
                  </span>
                  <span className="font-mono text-sky-400">{profile.savedOutfits.length}/5</span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[1, 2, 3, 4, 5].map((slotNum) => {
                    const existing = profile.savedOutfits.find((s) => s.slot === slotNum)
                    const sw = existing ? OUTFIT_SWATCHES[existing.avatar.outfitId] : null
                    const draftName = slotNames[slotNum] ?? existing?.name ?? (lang === 'pl' ? `Zestaw #${slotNum}` : `Preset #${slotNum}`)

                    return (
                      <div
                        key={slotNum}
                        className="flex flex-col justify-between gap-2.5 rounded-2xl border p-3.5"
                        style={{
                          background: existing ? tokens.heroGradient : tokens.mutedBg,
                          borderColor: existing ? `${ARCTIC_SKY.skyMain}55` : tokens.cardBorder,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-950/60 font-mono text-xs font-black text-sky-300">
                            {sw ? (
                              <div className="flex h-6 w-6 flex-col overflow-hidden rounded-md border border-white/25">
                                <span className="h-1/2 w-full" style={{ background: sw.torso }} />
                                <span className="h-1/2 w-full" style={{ background: sw.legs }} />
                              </div>
                            ) : (
                              `#${slotNum}`
                            )}
                          </div>
                          <input
                            type="text"
                            value={draftName}
                            maxLength={22}
                            onChange={(e) => setSlotNames((prev) => ({ ...prev, [slotNum]: e.target.value }))}
                            className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-extrabold outline-none focus:border-sky-400"
                            style={{ color: tokens.textPrimary }}
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onSaveOutfitSlot?.(slotNum, draftName, profile.avatar)
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-extrabold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {existing
                              ? lang === 'pl'
                                ? 'Nadpisz'
                                : 'Overwrite'
                              : lang === 'pl'
                                ? 'Zapisz obecny'
                                : 'Save current'}
                          </button>

                          {existing && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewAvatar({ ...existing.avatar })
                                  onApplySavedOutfit?.(existing.avatar)
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                                style={{ background: tokens.buttonGradient }}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {lang === 'pl' ? 'Załóż' : 'Equip'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteOutfitSlot?.(slotNum)}
                                title={lang === 'pl' ? 'Usuń slot' : 'Delete slot'}
                                className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
