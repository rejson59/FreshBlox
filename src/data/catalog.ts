export const GEMS_SYSTEM_IN_PROGRESS = false

export type OutfitId =
  | 'fresh-creator'
  | 'classic-remaster'
  | 'arctic-frost'
  | 'midnight-slate'
  | 'glacier-captain'
  | 'crystal-royal'

export type FaceId = 'fresh-smile' | 'wink-pro' | 'arctic-visor' | 'cool-shades' | 'star-eyes'

export type HatId =
  | 'none'
  | 'fresh-cap'
  | 'headphones'
  | 'crystal-halo'
  | 'frost-horns'
  | 'arctic-crown'
  | 'obby-crown'

export type TrailId =
  | 'none'
  | 'arctic-sparks'
  | 'portal-duality'
  | 'neon-comet'
  | 'emerald-pulse'
  | 'golden-meteor'
  | 'blaze-disc'

export type BackId =
  | 'none'
  | 'crystal-wings'
  | 'portal-jetpack'
  | 'arctic-backpack'
  | 'cyber-cape'
  | 'solar-halo-wings'

export type PetId =
  | 'none'
  | 'frost-cube'
  | 'portal-drone'
  | 'star-owl'
  | 'plasma-orb'

export type WorldKind = 'lobby' | 'obby' | 'arena' | 'frisbee' | 'racing'

export interface R6AvatarConfig {
  outfitId: OutfitId
  faceId: FaceId
  hatId: HatId
  skinColor: string
  trailId?: TrailId
  backId?: BackId
  petId?: PetId
}

export interface CatalogItem<T extends string> {
  id: T
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  /** Price in FreshGems (cheaper premium currency) */
  price: number
  /** Optional explicit price in FreshCoins (earned by playing; defaults to ~4.5x FreshGems price) */
  coinPrice?: number
  accent: string
  /** Optional milestone-only unlock (cannot be purchased with FreshGems) */
  rewardOnly?: 'obby100' | 'arenaWin' | 'arenaMeteor' | 'frisbeeWin'
  rewardLabelPl?: string
  rewardLabelEn?: string
}

/** Returns the FreshCoins price for a catalog item (higher than FreshGems so players earn it by playing). */
export function getCoinPrice(item: { price: number; coinPrice?: number }): number {
  if (item.price <= 0) return 0
  if (typeof item.coinPrice === 'number') return item.coinPrice
  return Math.round((item.price * 4.5) / 10) * 10
}

export const OUTFIT_CATALOG: CatalogItem<OutfitId>[] = [
  {
    id: 'fresh-creator',
    namePl: 'Fresh Sky Creator',
    nameEn: 'Fresh Sky Creator',
    descPl: 'Domyślna błękitno-granatowa bluza FreshBlox z białym logo F.',
    descEn: 'Signature sky-blue & navy FreshBlox creator hoodie with chest F.',
    price: 0,
    accent: '#38BDF8',
  },
  {
    id: 'classic-remaster',
    namePl: 'Classic Remastered',
    nameEn: 'Classic Remastered',
    descPl: 'Kultowe kolory klockowego klasyka odświeżone w połysku Fresh Glossy.',
    descEn: 'Iconic classic block colors refreshed in modern Fresh Glossy finish.',
    price: 75,
    accent: '#FACC15',
  },
  {
    id: 'arctic-frost',
    namePl: 'Arctic Frost Pro',
    nameEn: 'Arctic Frost Pro',
    descPl: 'Lodowo-biała kurtka arktyczna z czystym błękitnym wykończeniem.',
    descEn: 'Crisp glacier-white jacket with clean sky-blue trim.',
    price: 120,
    accent: '#BAE6FD',
  },
  {
    id: 'midnight-slate',
    namePl: 'Nocny Grafit',
    nameEn: 'Midnight Slate',
    descPl: 'Ciemna granatowo-grafitowa bluza z błękitnymi rękawami.',
    descEn: 'Deep midnight navy hoodie paired with clean sky-blue sleeves.',
    price: 160,
    accent: '#0EA5E9',
  },
  {
    id: 'glacier-captain',
    namePl: 'Glacier Captain',
    nameEn: 'Glacier Captain',
    descPl: 'Strój odkrywcy lodowców z białym pasem i turkusowym akcentem.',
    descEn: 'Arctic explorer uniform with crisp white stripe and aqua shimmer.',
    price: 220,
    accent: '#22D3EE',
  },
  {
    id: 'crystal-royal',
    namePl: 'Crystal Royal',
    nameEn: 'Crystal Royal',
    descPl: 'Królewski zestaw kryształowy z platynowo-błękitnym połyskiem.',
    descEn: 'Regal crystal armor-hoodie with platinum-sky metallic sheen.',
    price: 340,
    accent: '#7DD3FC',
  },
]

export const HAT_CATALOG: CatalogItem<HatId>[] = [
  {
    id: 'none',
    namePl: 'Brak nakrycia',
    nameEn: 'No Hat',
    descPl: 'Czysta klasyczna głowa awatara.',
    descEn: 'Clean classic avatar head silhouette.',
    price: 80,
    accent: '#94A3B8',
  },
  {
    id: 'fresh-cap',
    namePl: 'Czapka FreshBlox',
    nameEn: 'FreshBlox Cap',
    descPl: 'Stylowa błękitno-biała czapka z daszkiem w połysku.',
    descEn: 'Sleek sky-blue and white glossy baseball cap.',
    price: 80,
    accent: '#38BDF8',
  },
  {
    id: 'headphones',
    namePl: 'Słuchawki Arctic Studio',
    nameEn: 'Arctic Studio Headphones',
    descPl: 'Klasyczne słuchawki nauszne z błękitno-srebrnym wykończeniem.',
    descEn: 'Classic over-ear studio headphones with sky-blue trim.',
    price: 140,
    accent: '#0EA5E9',
  },
  {
    id: 'crystal-halo',
    namePl: 'Kryształowa Aureola',
    nameEn: 'Crystal Halo',
    descPl: 'Lekki pierścień z błękitnego lodu unoszący się nad głową.',
    descEn: 'Polished sky-ice ring floating above your head.',
    price: 190,
    accent: '#7DD3FC',
  },
  {
    id: 'frost-horns',
    namePl: 'Mroźne Rogi',
    nameEn: 'Frost Horns',
    descPl: 'Stylizowane lodowe rogi w połysku Fresh Glossy.',
    descEn: 'Sculpted ice horns finished in clean Fresh Glossy polish.',
    price: 230,
    accent: '#22D3EE',
  },
  {
    id: 'arctic-crown',
    namePl: 'Korona FreshGems',
    nameEn: 'FreshGems Crown',
    descPl: 'Prestiżowa korona z osadzonym kryształem FreshGem.',
    descEn: 'Prestigious metallic-ice crown topped with a crystal FreshGem.',
    price: 350,
    accent: '#FBBF24',
  },
  {
    id: 'obby-crown',
    namePl: 'Korona Mistrza Obby',
    nameEn: 'Obby 100 Champion Crown',
    descPl: 'Ekskluzywna królewska korona ze szczytu Stage 100. Nie do kupienia — tylko za przejście Test Obby 100!',
    descEn: 'Exclusive royal crown from Stage 100. Cannot be bought — earned only by completing Test Obby 100!',
    price: 80,
    accent: '#F59E0B',
    rewardOnly: 'obby100',
    rewardLabelPl: 'Nagroda: Obby 100',
    rewardLabelEn: 'Reward: Obby 100',
  },
]

export const FACE_CATALOG: CatalogItem<FaceId>[] = [
  {
    id: 'fresh-smile',
    namePl: 'Klasyczny Uśmiech Fresh',
    nameEn: 'Classic Fresh Smile',
    descPl: 'Przyjazne, błyszczące oczy i ikoniczny uśmiech FreshBlox.',
    descEn: 'Bright lively eyes with the iconic friendly FreshBlox smile.',
    price: 0,
    accent: '#38BDF8',
  },
  {
    id: 'wink-pro',
    namePl: 'Pewne Mrugnięcie',
    nameEn: 'Confident Wink',
    descPl: 'Stylowe mrugnięcie z lekkim uśmiechem twórcy.',
    descEn: 'Playful creator wink with confident grin.',
    price: 80,
    accent: '#7DD3FC',
  },
  {
    id: 'arctic-visor',
    namePl: 'Gogle Arctic',
    nameEn: 'Arctic Goggles',
    descPl: 'Zimowe błękitno-białe gogle z czystym odbiciem nieba.',
    descEn: 'Crisp sky-blue winter goggles with clean glossy lenses.',
    price: 90,
    accent: '#0EA5E9',
  },
  {
    id: 'cool-shades',
    namePl: 'Okulary Sky Shades',
    nameEn: 'Sky Shades',
    descPl: 'Ciemne lustrzanki z błękitnym refleksem nieba.',
    descEn: 'Glossy dark shades reflecting the Arctic Sky horizon.',
    price: 110,
    accent: '#1E293B',
  },
  {
    id: 'star-eyes',
    namePl: 'Kryształowe Gwiazdki',
    nameEn: 'Crystal Star Eyes',
    descPl: 'Roziskrzone błękitne gwiazdki zamiast źrenic!',
    descEn: 'Sparkling sky-blue crystal stars in your eyes!',
    price: 150,
    accent: '#38BDF8',
  },
]

export const SKIN_SWATCHES = [
  { hex: '#FDE0B6', namePl: 'Jasna Fresh', nameEn: 'Light Fresh' },
  { hex: '#F3C998', namePl: 'Ciepła', nameEn: 'Warm' },
  { hex: '#D9A06C', namePl: 'Oliwkowa', nameEn: 'Tan' },
  { hex: '#9A6644', namePl: 'Brązowa', nameEn: 'Deep' },
  { hex: '#FACC15', namePl: 'Klasyczny Żółty', nameEn: 'Classic Yellow' },
  { hex: '#E0F2FE', namePl: 'Lodowy Duch', nameEn: 'Frost Spirit' },
]

export const TRAIL_CATALOG: CatalogItem<TrailId>[] = [
  {
    id: 'none',
    namePl: 'Brak śladu',
    nameEn: 'No Trail',
    descPl: 'Czysty krok bez efektów cząsteczkowych.',
    descEn: 'Clean footsteps without particle trails.',
    price: 80,
    accent: '#94A3B8',
  },
  {
    id: 'arctic-sparks',
    namePl: 'Arktyczne Iskry',
    nameEn: 'Arctic Sparks',
    descPl: 'Błękitne kryształki lodu unoszące się za Twoimi krokami.',
    descEn: 'Sky-blue frost sparks drifting behind your steps.',
    price: 80,
    accent: '#38BDF8',
  },
  {
    id: 'portal-duality',
    namePl: 'Dualizm Portalu',
    nameEn: 'Portal Duality',
    descPl: 'Naprzemienny ślad energetyczny Błękit ↔ Pomarańcz z Portal Arena.',
    descEn: 'Alternating Cyan ↔ Orange portal energy ribbon.',
    price: 80,
    accent: '#F97316',
  },
  {
    id: 'neon-comet',
    namePl: 'Neonowa Kometa',
    nameEn: 'Neon Comet',
    descPl: 'Fioletowo-różowa smuga kwantowa jak w hyper-speed!',
    descEn: 'Violet-magenta quantum trail built for hyper-speed!',
    price: 80,
    accent: '#C084FC',
  },
  {
    id: 'emerald-pulse',
    namePl: 'Szmaragdowy Impuls',
    nameEn: 'Emerald Pulse',
    descPl: 'Świecący szmaragdowy szlak energetyczny w 3D.',
    descEn: 'Glowing 3D emerald kinetic particles.',
    price: 80,
    accent: '#10B981',
  },
  {
    id: 'golden-meteor',
    namePl: 'Złoty Meteoryt',
    nameEn: 'Golden Meteor',
    descPl: 'Płonący złoty szlak za osiągnięcie 100 km/h lub wygraną w Portal Arena.',
    descEn: 'Blazing golden meteor trail earned by hitting 100 km/h or winning in Portal Arena.',
    price: 80,
    accent: '#FACC15',
    rewardOnly: 'arenaMeteor',
    rewardLabelPl: 'Nagroda: Meteoryt 100 km/h',
    rewardLabelEn: 'Reward: 100 km/h Meteor',
  },
  {
    id: 'blaze-disc',
    namePl: 'Ogniste Frisbee',
    nameEn: 'Blaze Frisbee',
    descPl: 'Płonący czerwono-złoty ślad ognia za zwycięstwo w 3-rundowym meczu Frisbee King!',
    descEn: 'Blazing fire trail unlocked by winning a 3-round Frisbee King match!',
    price: 80,
    accent: '#EF4444',
    rewardOnly: 'frisbeeWin',
    rewardLabelPl: 'Nagroda: Król Frisbee',
    rewardLabelEn: 'Reward: Frisbee King',
  },
]

export const BACK_CATALOG: CatalogItem<BackId>[] = [
  {
    id: 'none',
    namePl: 'Brak dodatku',
    nameEn: 'No Back Item',
    descPl: 'Czyste plecy awatara.',
    descEn: 'Clean avatar back silhouette.',
    price: 0,
    accent: '#94A3B8',
  },
  {
    id: 'crystal-wings',
    namePl: 'Kryształowe Skrzydła',
    nameEn: 'Crystal Wings',
    descPl: 'Animowane półprzezroczyste skrzydła z błękitnego kryształu.',
    descEn: 'Animated translucent sky-crystal wings.',
    price: 80,
    accent: '#38BDF8',
  },
  {
    id: 'portal-jetpack',
    namePl: 'Plecak Portalowy',
    nameEn: 'Portal Jetpack',
    descPl: 'Podwójny reaktor grawitacyjny (Cyan + Orange) z Portal Arena.',
    descEn: 'Dual Cyan + Orange gravity thruster pack from Portal Arena.',
    price: 80,
    accent: '#FB923C',
  },
  {
    id: 'arctic-backpack',
    namePl: 'Plecak Odkrywcy',
    nameEn: 'Arctic Explorer Pack',
    descPl: 'Lekki sportowy plecak z kryształową klamrą FreshBlox.',
    descEn: 'Sleek explorer backpack with crystal FreshBlox clasp.',
    price: 80,
    accent: '#0EA5E9',
  },
  {
    id: 'cyber-cape',
    namePl: 'Kwantowa Peleryna',
    nameEn: 'Quantum Cape',
    descPl: 'Nowoczesna wielosegmentowa peleryna reagująca na bieg.',
    descEn: 'Segmented futuristic cape that reacts to your sprint.',
    price: 80,
    accent: '#818CF8',
  },
  {
    id: 'solar-halo-wings',
    namePl: 'Skrzydła Mistrza Areny',
    nameEn: 'Arena Champion Wings',
    descPl: 'Złoto-platynowe skrzydła odblokowywane za zwycięstwo w Portal Arena!',
    descEn: 'Gold-platinum wings unlocked by winning a round in Portal Arena!',
    price: 80,
    accent: '#F59E0B',
    rewardOnly: 'arenaWin',
    rewardLabelPl: 'Nagroda: Wygrana Areny',
    rewardLabelEn: 'Reward: Arena Victory',
  },
]

export const PET_CATALOG: CatalogItem<PetId>[] = [
  {
    id: 'none',
    namePl: 'Brak kompana',
    nameEn: 'No Pet',
    descPl: 'Podróżujesz solo bez latającego kompana.',
    descEn: 'Explore solo without a floating companion.',
    price: 0,
    accent: '#94A3B8',
  },
  {
    id: 'frost-cube',
    namePl: 'Frosty Cube',
    nameEn: 'Frosty Cube',
    descPl: 'Urocza lewitująca kostka lodu z wielkimi błyszczącymi oczami!',
    descEn: 'Adorable levitating ice-cube buddy with bright glossy eyes!',
    price: 80,
    accent: '#38BDF8',
  },
  {
    id: 'portal-drone',
    namePl: 'Dron Portalowy',
    nameEn: 'Portal Drone',
    descPl: 'Miniaturowa sfera z pierścieniem Cyan/Orange krążąca przy ramieniu.',
    descEn: 'Miniature Cyan/Orange portal sphere hovering beside your shoulder.',
    price: 80,
    accent: '#F97316',
  },
  {
    id: 'star-owl',
    namePl: 'Gwiezdna Sowa',
    nameEn: 'Starlight Owl',
    descPl: 'Klockowa sówka z machającymi skrzydełkami i złotymi oczkami.',
    descEn: 'Blocky owl companion with flapping wings and golden eyes.',
    price: 80,
    accent: '#FACC15',
  },
  {
    id: 'plasma-orb',
    namePl: 'Plazmowy Kometek',
    nameEn: 'Plasma Comet',
    descPl: 'Orbitujący kryształ plazmy z dwoma pierścieniami grawitacji.',
    descEn: 'Orbiting plasma crystal surrounded by twin gravity rings.',
    price: 80,
    accent: '#C084FC',
  },
]

export interface QuestDef {
  id: 'q_obby' | 'q_chat' | 'q_emote' | 'q_tower' | 'q_jumppad'
  titlePl: string
  titleEn: string
  target: number
  rewardGems: number
  rewardXp: number
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'q_obby',
    titlePl: 'Zdobądź 5 poziomów w Test Obby 100',
    titleEn: 'Clear 5 stages in Test Obby 100',
    target: 5,
    rewardGems: 0,
    rewardXp: 150,
  },
  {
    id: 'q_chat',
    titlePl: 'Przywitaj się na czacie w Lobby Głównym',
    titleEn: 'Say hello in Main Lobby chat',
    target: 1,
    rewardGems: 0,
    rewardXp: 60,
  },
  {
    id: 'q_emote',
    titlePl: 'Użyj 2 emotek (klawisze 1–6)',
    titleEn: 'Use 2 emotes (keys 1–6)',
    target: 2,
    rewardGems: 0,
    rewardXp: 75,
  },
  {
    id: 'q_jumppad',
    titlePl: 'Wyskocz 3 razy na błękitnym Jump-Padzie',
    titleEn: 'Bounce 3 times on a Sky Jump-Pad',
    target: 3,
    rewardGems: 0,
    rewardXp: 85,
  },
  {
    id: 'q_tower',
    titlePl: 'Wejdź na Sky Taras Widokowy w Lobby',
    titleEn: 'Reach the Sky Observation Terrace in Lobby',
    target: 1,
    rewardGems: 0,
    rewardXp: 180,
  },
]

export interface BadgeDef {
  id: string
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  icon: string
}

export const BADGE_CATALOG: BadgeDef[] = [
  {
    id: 'pioneer',
    namePl: 'Pionier FreshBlox',
    nameEn: 'FreshBlox Pioneer',
    descPl: 'Dołączyłeś do pierwszej generacji FreshBlox!',
    descEn: 'Joined the very first generation of FreshBlox!',
    icon: '🚀',
  },
  {
    id: 'social',
    namePl: 'Dusza Towarzystwa',
    nameEn: 'Social Spark',
    descPl: 'Wysłano pierwszą wiadomość na czacie na żywo.',
    descEn: 'Sent your first live chat message.',
    icon: '💬',
  },
  {
    id: 'obby_runner',
    namePl: 'Skoczek Obby',
    nameEn: 'Obby Jumper',
    descPl: 'Osiągnięto co najmniej Stage 10 w Test Obby 100.',
    descEn: 'Reached at least Stage 10 in Test Obby 100.',
    icon: '🏃',
  },
  {
    id: 'obby_master',
    namePl: 'Mistrz 100 Leveli',
    nameEn: '100-Stage Master',
    descPl: 'Ukończono wszystkie 100 poziomów Test Obby!',
    descEn: 'Completed all 100 stages of Test Obby!',
    icon: '🏆',
  },
  {
    id: 'dancer',
    namePl: 'Król Parkietu',
    nameEn: 'Dance Legend',
    descPl: 'Użyto emotek podczas spotkania w Lobby.',
    descEn: 'Triggered emotes while hanging out.',
    icon: '🕺',
  },
  {
    id: 'explorer',
    namePl: 'Zdobywca Tarasu',
    nameEn: 'Terrace Explorer',
    descPl: 'Dotarto na szczyt Sky Tarasu Widokowego.',
    descEn: 'Climbed all the way to the Sky Observation Terrace.',
    icon: '🏔️',
  },
  {
    id: 'arena_meteor',
    namePl: 'Ludzki Meteoryt',
    nameEn: 'Human Meteor',
    descPl: 'Osiągnięto ponad 100 km/h i wyeliminowano rywala pędem w Portal Arena!',
    descEn: 'Hit 100+ km/h and eliminated a rival with momentum in Portal Arena!',
    icon: '☄️',
  },
  {
    id: 'arena_winner',
    namePl: 'Władca Portali',
    nameEn: 'Portal Sovereign',
    descPl: 'Wygrano rundę w Portal Arena bez ani jednego karabinu!',
    descEn: 'Won a match in Portal Arena using pure portals and physics!',
    icon: '🌀',
  },
  {
    id: 'frisbee_king',
    namePl: 'Król Frisbee',
    nameEn: 'Frisbee King',
    descPl: 'Zwyciężono 3-rundowy mecz w Frisbee King!',
    descEn: 'Won a 3-round match in Frisbee King!',
    icon: '🥏',
  },
  {
    id: 'frisbee_trick',
    namePl: 'Mistrz Rykoszetu',
    nameEn: 'Trick Shot Master',
    descPl: 'Przecięto rywala ognistym frisbee po rykoszecie lub złapano dysk w locie!',
    descEn: 'Sliced a rival with a blazing trick-shot frisbee or caught it mid-flight!',
    icon: '🔥',
  },
]

export interface SeasonRank {
  name: string
  minXp: number
  nextXp: number
  color: string
}

export const SEASON_RANKS: SeasonRank[] = [
  { name: 'Crystal I', minXp: 0, nextXp: 250, color: '#7DD3FC' },
  { name: 'Crystal II', minXp: 250, nextXp: 600, color: '#38BDF8' },
  { name: 'Crystal III', minXp: 600, nextXp: 1100, color: '#0EA5E9' },
  { name: 'Glacier Elite', minXp: 1100, nextXp: 2000, color: '#22D3EE' },
  { name: 'Arctic Legend', minXp: 2000, nextXp: 5000, color: '#F0F9FF' },
]

export function getRankForXp(xp: number): SeasonRank {
  for (let i = SEASON_RANKS.length - 1; i >= 0; i--) {
    if (xp >= SEASON_RANKS[i].minXp) return SEASON_RANKS[i]
  }
  return SEASON_RANKS[0]
}

export interface LobbyRoomCard {
  id: string
  code: string
  world: WorldKind
  titlePl: string
  titleEn: string
  tagPl: string
  tagEn: string
  players: number
  maxPlayers: number
  rating: string
  pingMs: number
  status: 'live' | 'soon'
  gradient: string
}

export const LOBBY_ROOMS: LobbyRoomCard[] = [
  {
    id: 'PUBLIC-1',
    code: 'PUBLIC-1',
    world: 'lobby',
    titlePl: 'Lobby Główne #1 (Publiczne)',
    titleEn: 'Main Lobby #1 (Public)',
    tagPl: 'Spotkania • 3D Hangout',
    tagEn: 'Hangout • 3D Social',
    players: 18,
    maxPlayers: 32,
    rating: '99%',
    pingMs: 14,
    status: 'live',
    gradient: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 54%, #E0F2FE 100%)',
  },
  {
    id: 'OBBY-100',
    code: 'OBBY-1',
    world: 'obby',
    titlePl: 'Test Obby — 100 Leveli',
    titleEn: 'Test Obby — 100 Stages',
    tagPl: 'Parkour • 100 Stage’ów',
    tagEn: 'Parkour • 100 Stages',
    players: 14,
    maxPlayers: 40,
    rating: 'NEW',
    pingMs: 12,
    status: 'live',
    gradient: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 52%, #FDE047 100%)',
  },
  {
    id: 'CHILL-PL',
    code: 'CHILL-PL',
    world: 'lobby',
    titlePl: 'Strefa Chill (Polska)',
    titleEn: 'Chill Zone (Poland)',
    tagPl: 'Czat & Emotki',
    tagEn: 'Chat & Emotes',
    players: 11,
    maxPlayers: 24,
    rating: '98%',
    pingMs: 11,
    status: 'live',
    gradient: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 55%, #BAE6FD 100%)',
  },
  {
    id: 'ARENA-1',
    code: 'ARENA-1',
    world: 'arena',
    titlePl: 'Portal Arena — Zamknięta Komnata',
    titleEn: 'Portal Arena — Sealed Chamber',
    tagPl: 'Portale 3D • Fizyka • Trening',
    tagEn: '3D Portals • Physics • Solo Drill',
    players: 0,
    maxPlayers: 16,
    rating: 'LIVE',
    pingMs: 11,
    status: 'live',
    gradient: 'linear-gradient(135deg, #0E7490 0%, #22D3EE 48%, #F97316 100%)',
  },
  {
    id: 'FRISBEE-1',
    code: 'FRISBEE-1',
    world: 'frisbee',
    titlePl: 'Frisbee King — 3 Rundy Trików',
    titleEn: 'Frisbee King — 3-Round Trick Arena',
    tagPl: 'Ogniste Frisbee • Łapanie • Rampy',
    tagEn: 'Blazing Frisbee • Catch • Ramps',
    players: 0,
    maxPlayers: 12,
    rating: 'NEW',
    pingMs: 11,
    status: 'live',
    gradient: 'linear-gradient(135deg, #991B1B 0%, #F97316 52%, #FACC15 100%)',
  },
]
