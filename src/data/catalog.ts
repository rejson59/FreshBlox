export type OutfitId =
  | 'fresh-creator'
  | 'classic-remaster'
  | 'arctic-frost'
  | 'midnight-neon'
  | 'glacier-captain'
  | 'crystal-royal'

export type FaceId = 'fresh-smile' | 'wink-pro' | 'arctic-visor' | 'cool-shades' | 'star-eyes'

export type HatId = 'none' | 'fresh-cap' | 'headphones' | 'crystal-halo' | 'frost-horns' | 'arctic-crown'

export interface R6AvatarConfig {
  outfitId: OutfitId
  faceId: FaceId
  hatId: HatId
  skinColor: string
}

export interface CatalogItem<T extends string> {
  id: T
  namePl: string
  nameEn: string
  descPl: string
  descEn: string
  price: number
  accent: string
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
    price: 0,
    accent: '#FACC15',
  },
  {
    id: 'arctic-frost',
    namePl: 'Arctic Frost Pro',
    nameEn: 'Arctic Frost Pro',
    descPl: 'Lodowo-biała kurtka arktyczna ze świetlistymi błękitnymi liniami.',
    descEn: 'Crisp glacier-white jacket accented with glowing sky tech trim.',
    price: 120,
    accent: '#BAE6FD',
  },
  {
    id: 'midnight-neon',
    namePl: 'Midnight Neon',
    nameEn: 'Midnight Neon',
    descPl: 'Ciemny nocny grafit z elektryczną błękitną obwódką.',
    descEn: 'Deep midnight slate jacket framed in electric sky-blue lines.',
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
    descPl: 'Czysta klasyczna głowa R6.',
    descEn: 'Clean classic R6 head silhouette.',
    price: 0,
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
    namePl: 'Słuchawki Arctic LED',
    nameEn: 'Arctic LED Headphones',
    descPl: 'Gamingowe słuchawki nauszne ze świecącym błękitnym pierścieniem.',
    descEn: 'Pro gaming headphones with glowing arctic sky LED rings.',
    price: 140,
    accent: '#0EA5E9',
  },
  {
    id: 'crystal-halo',
    namePl: 'Kryształowa Aureola',
    nameEn: 'Crystal Halo',
    descPl: 'Lewitujący świetlisty pierścień błękitnego lodu nad głową R6.',
    descEn: 'Floating luminous sky-crystal ring hovering above your R6 head.',
    price: 190,
    accent: '#7DD3FC',
  },
  {
    id: 'frost-horns',
    namePl: 'Mroźne Rogi Cyber',
    nameEn: 'Cyber Frost Horns',
    descPl: 'Stylizowane kryształowe rogi dla fanów mocniejszego looku.',
    descEn: 'Sculpted translucent frost horns for a bold pro-gaming silhouette.',
    price: 230,
    accent: '#22D3EE',
  },
  {
    id: 'arctic-crown',
    namePl: 'Korona FreshGems',
    nameEn: 'FreshGems Crown',
    descPl: 'Prestiżowa korona z osadzonym kryształem FreshGem.',
    descEn: 'Prestigious metallic-ice crown topped with a glowing FreshGem.',
    price: 350,
    accent: '#FBBF24',
  },
]

export const FACE_CATALOG: CatalogItem<FaceId>[] = [
  {
    id: 'fresh-smile',
    namePl: 'Klasyczny Uśmiech Fresh',
    nameEn: 'Classic Fresh Smile',
    descPl: 'Przyjazne, błyszczące oczy i ikoniczny uśmiech R6.',
    descEn: 'Bright lively eyes with the iconic friendly R6 smile.',
    price: 0,
    accent: '#38BDF8',
  },
  {
    id: 'wink-pro',
    namePl: 'Pewne Mrugnięcie',
    nameEn: 'Confident Wink',
    descPl: 'Stylowe mrugnięcie z lekkim uśmiechem twórcy.',
    descEn: 'Playful creator wink with confident grin.',
    price: 0,
    accent: '#7DD3FC',
  },
  {
    id: 'arctic-visor',
    namePl: 'Wizjer Arctic Tech',
    nameEn: 'Arctic Tech Visor',
    descPl: 'Świecący błękitno-biały wizjer nowej generacji.',
    descEn: 'Glowing sky-blue next-gen panoramic visor.',
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

export interface QuestDef {
  id: 'q_gems' | 'q_chat' | 'q_emote' | 'q_tower' | 'q_jumppad'
  titlePl: string
  titleEn: string
  target: number
  rewardGems: number
  rewardXp: number
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'q_gems',
    titlePl: 'Zbierz 5 kryształów FreshGems w Lobby',
    titleEn: 'Collect 5 FreshGems in Main Lobby',
    target: 5,
    rewardGems: 75,
    rewardXp: 120,
  },
  {
    id: 'q_chat',
    titlePl: 'Przywitaj się na czacie w Lobby Głównym',
    titleEn: 'Say hello in Main Lobby chat',
    target: 1,
    rewardGems: 40,
    rewardXp: 60,
  },
  {
    id: 'q_emote',
    titlePl: 'Użyj 2 emotek R6 (klawisze 1–6)',
    titleEn: 'Use 2 R6 emotes (keys 1–6)',
    target: 2,
    rewardGems: 45,
    rewardXp: 75,
  },
  {
    id: 'q_jumppad',
    titlePl: 'Wyskocz 3 razy na błękitnym Jump-Padzie',
    titleEn: 'Bounce 3 times on a Sky Jump-Pad',
    target: 3,
    rewardGems: 50,
    rewardXp: 85,
  },
  {
    id: 'q_tower',
    titlePl: 'Wejdź na Sky Taras Widokowy',
    titleEn: 'Reach the Sky Observation Terrace',
    target: 1,
    rewardGems: 100,
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
    descPl: 'Wysłano pierwszą wiadomość w Lobby Głównym.',
    descEn: 'Sent your first chat message in Main Lobby.',
    icon: '💬',
  },
  {
    id: 'collector',
    namePl: 'Łowca Kryształów',
    nameEn: 'Crystal Hunter',
    descPl: 'Zebrano co najmniej 5 FreshGems w Lobby 3D.',
    descEn: 'Collected at least 5 FreshGems in Main Lobby.',
    icon: '💎',
  },
  {
    id: 'dancer',
    namePl: 'Król Parkietu R6',
    nameEn: 'R6 Dance Legend',
    descPl: 'Użyto emotek R6 podczas spotkania w Lobby.',
    descEn: 'Triggered R6 emotes while hanging out.',
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
    id: 'stylist',
    namePl: 'Ikona Stylu R6',
    nameEn: 'R6 Style Icon',
    descPl: 'Odblokowano nowy kosmetyk za FreshGems.',
    descEn: 'Unlocked a new cosmetic item using FreshGems.',
    icon: '✨',
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
    id: 'CHILL-PL',
    code: 'CHILL-PL',
    titlePl: 'Strefa Chill (Polska)',
    titleEn: 'Chill Zone (Poland)',
    tagPl: 'Czat & Emotki R6',
    tagEn: 'Chat & R6 Emotes',
    players: 11,
    maxPlayers: 24,
    rating: '98%',
    pingMs: 11,
    status: 'live',
    gradient: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 55%, #BAE6FD 100%)',
  },
  {
    id: 'SOON-OBBY',
    code: 'OBBY',
    titlePl: 'SkyTower Mega Obby',
    titleEn: 'SkyTower Mega Obby',
    tagPl: 'Parkour • Portal',
    tagEn: 'Parkour • Portal',
    players: 0,
    maxPlayers: 40,
    rating: '—',
    pingMs: 16,
    status: 'soon',
    gradient: 'linear-gradient(135deg, #0C4A6E 0%, #0284C7 60%, #7DD3FC 100%)',
  },
  {
    id: 'SOON-ARENA',
    code: 'ARENA',
    titlePl: 'Crystal Spleef Arena',
    titleEn: 'Crystal Spleef Arena',
    tagPl: 'Mini-Gra • Portal',
    tagEn: 'Mini-Game • Portal',
    players: 0,
    maxPlayers: 20,
    rating: '—',
    pingMs: 18,
    status: 'soon',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #93C5FD 100%)',
  },
]
