import React, { useState } from 'react'
import { Check, Cloud, Play, ShieldCheck, UserPlus, Users, Award, Sparkles } from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { BADGE_CATALOG, getRankForXp } from '../../data/catalog'
import { PlayerProfile } from '../../store/usePlayerStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { FreshGemShard } from '../brand/FreshBloxBrand'
import { sfx } from '../../lib/sfx'

interface SocialProfileViewProps {
  profile: PlayerProfile
  mode: ThemeMode
  lang: Lang
  onChangeUsername: (name: string) => void
  onAddFriend: (name: string) => void
  onJoinRoom: (roomId: string) => void
}

export const SocialProfileView: React.FC<SocialProfileViewProps> = ({
  profile,
  mode,
  lang,
  onChangeUsername,
  onAddFriend,
  onJoinRoom,
}) => {
  const [nickInput, setNickInput] = useState(profile.username)
  const [nickSaved, setNickSaved] = useState(false)
  const [friendInput, setFriendInput] = useState('')

  const t = LOCALES[lang].social
  const tokens = getThemeTokens(mode)
  const rank = getRankForXp(profile.xp)

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickInput.trim()) return
    onChangeUsername(nickInput)
    sfx.playChatPop()
    setNickSaved(true)
    setTimeout(() => setNickSaved(false), 1800)
  }

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendInput.trim()) return
    onAddFriend(friendInput)
    setFriendInput('')
    sfx.playChatPop()
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: tokens.textPrimary }}>
          {t.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: tokens.textSecondary }}>
          {t.subtitle}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Profile Card */}
        <div
          className="space-y-4 rounded-3xl border p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              {t.profileCard}
            </h2>
            <span
              className="rounded-lg px-2.5 py-1 font-mono-code text-xs font-bold"
              style={{ background: tokens.badgeBg, color: tokens.badgeText }}
            >
              {profile.freshTag}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                FreshGems
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
                <FreshGemShard size={18} />
                {profile.freshGems}
              </div>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                Rank
              </div>
              <div className="mt-1 font-display text-base font-extrabold" style={{ color: ARCTIC_SKY.skyMain }}>
                {rank.name}
              </div>
            </div>
            <div className="rounded-2xl border p-3" style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: tokens.textSecondary }}>
                XP
              </div>
              <div className="mt-1 font-mono-code text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
                {profile.xp}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveNick} className="space-y-2 pt-2">
            <label className="block text-xs font-bold" style={{ color: tokens.textSecondary }}>
              {t.nicknameLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                maxLength={20}
                className="flex-1 rounded-xl border px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-400/50"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white cursor-pointer"
                style={{ background: tokens.buttonGradient }}
              >
                {nickSaved && <Check className="h-3.5 w-3.5" />}
                {nickSaved ? t.saved : t.saveNick}
              </button>
            </div>
          </form>
        </div>

        {/* Friends Card */}
        <div
          className="flex flex-col justify-between space-y-4 rounded-3xl border p-6 backdrop-blur-md lg:col-span-6"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
                <Users className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
                {t.friendsCard}
              </h2>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: tokens.badgeBg, color: tokens.badgeText }}>
                {profile.friends.length}
              </span>
            </div>

            <form onSubmit={handleAddFriend} className="flex gap-2">
              <input
                type="text"
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder={t.addFriendPlaceholder}
                maxLength={20}
                className="flex-1 rounded-xl border px-3.5 py-2 text-xs font-semibold outline-none"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
                style={{ background: tokens.buttonGradient }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t.addFriendBtn}
              </button>
            </form>

            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {profile.friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-2xl border px-3.5 py-2.5"
                  style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                        {f.username}
                      </div>
                      <div className="font-mono-code text-[10px]" style={{ color: tokens.textSecondary }}>
                        Lobby #{f.roomCode ?? 'PUBLIC-1'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onJoinRoom(f.roomCode ?? 'PUBLIC-1')}
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold text-white cursor-pointer"
                    style={{ background: tokens.buttonGradient }}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {LOCALES[lang].home.join}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Badges Card */}
        <div
          className="space-y-4 rounded-3xl border p-6 backdrop-blur-md lg:col-span-7"
          style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
        >
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
            <Award className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
            {t.badgesCard}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BADGE_CATALOG.map((b) => {
              const unlocked = profile.badges.includes(b.id)
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border p-3.5 transition"
                  style={{
                    background: unlocked ? tokens.heroGradient : tokens.mutedBg,
                    borderColor: unlocked ? `${ARCTIC_SKY.skyMain}66` : tokens.cardBorder,
                    opacity: unlocked ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{b.icon}</span>
                    {unlocked && (
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold" style={{ background: tokens.badgeBg, color: tokens.badgeText }}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs font-extrabold" style={{ color: tokens.textPrimary }}>
                    {lang === 'pl' ? b.namePl : b.nameEn}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug" style={{ color: tokens.textSecondary }}>
                    {lang === 'pl' ? b.descPl : b.descEn}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Supabase Cloud Status Card */}
        <div
          className="space-y-3 rounded-3xl border p-6 backdrop-blur-md lg:col-span-5"
          style={{ background: tokens.cardBg, borderColor: `${ARCTIC_SKY.skyMain}44` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: tokens.textPrimary }}>
              <Cloud className="h-5 w-5" style={{ color: ARCTIC_SKY.skyMain }} />
              {t.supabaseCard}
            </h2>
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold"
            style={{ background: tokens.badgeBg, color: tokens.badgeText }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSupabaseConfigured ? t.supabaseConnected : t.supabaseReady}
          </div>

          <p className="text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
            {t.supabaseLimitNote}
          </p>

          <div
            className="rounded-xl border p-3 font-mono-code text-[11px]"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
          >
            <div>vercel: https://freshblox.vercel.app ✓</div>
            <div>schema: supabase/schema.sql ✓</div>
            <div>realtime: Presence + Broadcast ✓</div>
            <div>fallback: Multi-Tab BroadcastChannel ✓</div>
          </div>
        </div>
      </div>
    </div>
  )
}
