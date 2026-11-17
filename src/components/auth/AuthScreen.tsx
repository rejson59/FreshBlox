import React, { useState } from 'react'
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Flag,
  Globe,
  Loader2,
  Lock,
  Moon,
  Sparkles,
  Sun,
  User,
  UserCircle2,
} from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { FreshBloxLogo, FreshBloxWordmark } from '../brand/FreshBloxBrand'
import { validateFreshBloxUsername } from '../../store/usePlayerStore'
import { sfx } from '../../lib/sfx'

interface AuthScreenProps {
  mode: ThemeMode
  lang: Lang
  pendingInviteRoom?: string | null
  onChangeMode: (next: ThemeMode) => void
  onToggleLang: () => void
  onSignIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onSignUp: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
}

function translateAuthError(code: string | undefined, lang: Lang): string {
  if (!code) {
    return lang === 'pl' ? 'Wystąpił błąd. Spróbuj ponownie.' : 'Something went wrong. Please try again.'
  }
  switch (code) {
    case 'INVALID_USERNAME':
      return lang === 'pl'
        ? 'Nazwa użytkownika musi mieć 3–20 znaków (tylko litery A-Z, cyfry 0-9, _ lub -).'
        : 'Username must be 3–20 characters (letters A-Z, numbers 0-9, _ or - only).'
    case 'SHORT_PASSWORD':
      return lang === 'pl'
        ? 'Hasło musi mieć co najmniej 6 znaków.'
        : 'Password must be at least 6 characters.'
    case 'PASSWORD_MISMATCH':
      return lang === 'pl' ? 'Hasła nie są identyczne.' : 'Passwords do not match.'
    case 'USERNAME_TAKEN':
      return lang === 'pl'
        ? 'Ta nazwa użytkownika jest już zajęta — wybierz inną lub zaloguj się.'
        : 'That username is already taken — pick another or sign in.'
    case 'INVALID_CREDENTIALS':
      return lang === 'pl'
        ? 'Nieprawidłowa nazwa użytkownika lub hasło.'
        : 'Invalid username or password.'
    case 'SUPABASE_NOT_CONFIGURED':
      return lang === 'pl'
        ? 'Usługa kont jest chwilowo niedostępna.'
        : 'Account service is temporarily unavailable.'
    default: {
      const low = code.toLowerCase()
      if (low.includes('invalid login credentials')) {
        return lang === 'pl'
          ? 'Nieprawidłowa nazwa użytkownika lub hasło.'
          : 'Invalid username or password.'
      }
      if (low.includes('already registered') || low.includes('already exists')) {
        return lang === 'pl'
          ? 'Ta nazwa użytkownika jest już zajęta.'
          : 'That username is already taken.'
      }
      if (low.includes('password should be at least')) {
        return lang === 'pl'
          ? 'Hasło musi mieć co najmniej 6 znaków.'
          : 'Password must be at least 6 characters.'
      }
      if (low.includes('rate limit')) {
        return lang === 'pl'
          ? 'Za dużo prób w krótkim czasie — odczekaj chwilę.'
          : 'Too many attempts — please wait a moment.'
      }
      return code
    }
  }
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  mode,
  lang,
  pendingInviteRoom,
  onChangeMode,
  onToggleLang,
  onSignIn,
  onSignUp,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const t = LOCALES[lang].auth
  const tokens = getThemeTokens(mode)

  const switchTab = (next: 'login' | 'register') => {
    setTab(next)
    setErrorMsg(null)
    setSuccessMsg(null)
    sfx.playClick()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const { valid, clean } = validateFreshBloxUsername(username)

    if (tab === 'register') {
      if (!valid) {
        setErrorMsg(translateAuthError('INVALID_USERNAME', lang))
        return
      }
      if (password.length < 6) {
        setErrorMsg(translateAuthError('SHORT_PASSWORD', lang))
        return
      }
      if (password !== confirmPassword) {
        setErrorMsg(translateAuthError('PASSWORD_MISMATCH', lang))
        return
      }
    } else {
      if (clean.length < 2 || password.length < 1) {
        setErrorMsg(translateAuthError('INVALID_CREDENTIALS', lang))
        return
      }
    }

    setSubmitting(true)
    try {
      const res =
        tab === 'login'
          ? await onSignIn(clean, password)
          : await onSignUp(clean, password)

      if (!res.ok) {
        setErrorMsg(translateAuthError(res.error, lang))
      } else {
        sfx.playQuestClaim()
        setSuccessMsg(
          tab === 'login'
            ? lang === 'pl'
              ? 'Zalogowano! Wchodzę do FreshBlox...'
              : 'Signed in! Entering FreshBlox...'
            : lang === 'pl'
              ? 'Konto utworzone! Witamy w FreshBlox!'
              : 'Account created! Welcome to FreshBlox!',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const features = [
    {
      icon: Box,
      title: t.featureLobbyTitle,
      desc: t.featureLobbyDesc,
      tint: ARCTIC_SKY.skyMain,
    },
    {
      icon: Flag,
      title: t.featureObbyTitle,
      desc: t.featureObbyDesc,
      tint: '#F59E0B',
    },
    {
      icon: UserCircle2,
      title: t.featureLockerTitle,
      desc: t.featureLockerDesc,
      tint: '#10B981',
    },
  ]

  return (
    <div
      className="relative flex min-h-dvh w-full max-w-full flex-col overflow-x-clip transition-colors duration-300"
      style={{ background: tokens.pageBg, color: tokens.textPrimary }}
    >
      {/* Subtle Arctic Sky ambient shapes (0% neon) */}
      <div
        className="pointer-events-none fixed -top-32 -left-24 h-80 w-80 rounded-full blur-3xl opacity-35"
        style={{ background: ARCTIC_SKY.skyMain }}
      />
      <div
        className="pointer-events-none fixed -right-28 bottom-0 h-96 w-96 rounded-full blur-3xl opacity-25"
        style={{ background: ARCTIC_SKY.skyDeep }}
      />

      {/* Top minimal bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2">
          <FreshBloxLogo size={34} />
          <FreshBloxWordmark mode={mode} size="sm" className="w-[104px] sm:w-[122px] h-auto" />
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-xl border p-0.5"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
          >
            <button
              type="button"
              onClick={() => onChangeMode('dark')}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer"
              style={{
                background: mode === 'dark' ? tokens.buttonGradient : 'transparent',
                color: mode === 'dark' ? '#FFFFFF' : tokens.textSecondary,
              }}
              aria-label="Dark mode"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('light')}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer"
              style={{
                background: mode === 'light' ? tokens.buttonGradient : 'transparent',
                color: mode === 'light' ? '#FFFFFF' : tokens.textSecondary,
              }}
              aria-label="Light mode"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition hover:scale-105 cursor-pointer"
            style={{ borderColor: tokens.cardBorder, background: tokens.cardBg, color: tokens.textPrimary }}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
            <span>{lang.toUpperCase()}</span>
          </button>
        </div>
      </header>

      {/* Main split content */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 pb-10 pt-2 sm:px-6 sm:py-6">
        <div className="grid w-full items-center gap-6 lg:grid-cols-12 lg:gap-10">
          {/* AUTH CARD — first on mobile so user can sign in immediately */}
          <div className="order-1 lg:order-2 lg:col-span-5">
            <div
              className="rounded-3xl border p-5 sm:p-7 shadow-2xl backdrop-blur-xl"
              style={{
                background: mode === 'dark' ? 'rgba(11, 22, 44, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: `${ARCTIC_SKY.skyMain}55`,
                boxShadow: `0 24px 60px ${mode === 'dark' ? 'rgba(2, 12, 30, 0.65)' : 'rgba(14, 165, 233, 0.16)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-extrabold leading-tight">
                    {tab === 'login' ? t.modalTitleLogin : t.modalTitleRegister}
                  </h2>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                    <Cloud className="h-3.5 w-3.5" />
                    <span>FreshBlox Cloud</span>
                  </div>
                </div>
                <FreshBloxLogo size={36} className="shrink-0" />
              </div>

              {pendingInviteRoom && (
                <div
                  className="mt-3.5 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold"
                  style={{
                    borderColor: `${ARCTIC_SKY.skyMain}55`,
                    background: tokens.badgeBg,
                    color: tokens.badgeText,
                  }}
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>
                    {t.inviteNotice}: <strong className="font-mono-code">{pendingInviteRoom}</strong>
                  </span>
                </div>
              )}

              {/* Tabs */}
              <div
                className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border p-1"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
              >
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer"
                  style={{
                    background: tab === 'login' ? tokens.buttonGradient : 'transparent',
                    color: tab === 'login' ? '#FFFFFF' : tokens.textSecondary,
                  }}
                >
                  {t.tabLogin}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="rounded-xl py-2.5 text-xs font-extrabold transition cursor-pointer"
                  style={{
                    background: tab === 'register' ? tokens.buttonGradient : 'transparent',
                    color: tab === 'register' ? '#FFFFFF' : tokens.textSecondary,
                  }}
                >
                  {t.tabRegister}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                {/* Username field */}
                <div className="space-y-1">
                  <label
                    htmlFor="fb-auth-username"
                    className="block text-xs font-bold"
                    style={{ color: tokens.textSecondary }}
                  >
                    {t.usernameLabel}
                  </label>
                  <div
                    className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-sky-400/50"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <User className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                    <input
                      id="fb-auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t.usernamePlaceholder}
                      maxLength={20}
                      autoComplete="username"
                      autoFocus
                      required
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                      style={{ color: tokens.textPrimary }}
                    />
                  </div>
                  {tab === 'register' && (
                    <p className="text-[11px]" style={{ color: tokens.textSecondary }}>
                      {t.usernameRule}
                    </p>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-1">
                  <label
                    htmlFor="fb-auth-password"
                    className="block text-xs font-bold"
                    style={{ color: tokens.textSecondary }}
                  >
                    {t.passwordLabel}
                  </label>
                  <div
                    className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-sky-400/50"
                    style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                  >
                    <Lock className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                    <input
                      id="fb-auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      minLength={6}
                      autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                      required
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                      style={{ color: tokens.textPrimary }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="shrink-0 opacity-70 transition hover:opacity-100 cursor-pointer"
                      style={{ color: tokens.textSecondary }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password on registration */}
                {tab === 'register' && (
                  <div className="space-y-1">
                    <label
                      htmlFor="fb-auth-confirm"
                      className="block text-xs font-bold"
                      style={{ color: tokens.textSecondary }}
                    >
                      {t.confirmPasswordLabel}
                    </label>
                    <div
                      className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-sky-400/50"
                      style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
                    >
                      <Lock className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                      <input
                        id="fb-auth-confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.confirmPasswordPlaceholder}
                        minLength={6}
                        autoComplete="new-password"
                        required
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                        style={{ color: tokens.textPrimary }}
                      />
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div
                    className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2.5 text-xs font-semibold"
                    style={{ color: mode === 'dark' ? '#FDA4AF' : '#BE123C' }}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div
                    className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold"
                    style={{ color: mode === 'dark' ? '#6EE7B7' : '#047857' }}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
                  style={{ background: tokens.buttonGradient }}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{tab === 'login' ? t.submitLogin : t.submitRegister}</span>
                </button>
              </form>

              <div className="mt-4 text-center text-xs" style={{ color: tokens.textSecondary }}>
                {tab === 'login' ? (
                  <>
                    <span>{t.noAccountYet} </span>
                    <button
                      type="button"
                      onClick={() => switchTab('register')}
                      className="font-extrabold hover:underline cursor-pointer"
                      style={{ color: ARCTIC_SKY.skyMain }}
                    >
                      {t.tabRegister}
                    </button>
                  </>
                ) : (
                  <>
                    <span>{t.haveAccountAlready} </span>
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="font-extrabold hover:underline cursor-pointer"
                      style={{ color: ARCTIC_SKY.skyMain }}
                    >
                      {t.tabLogin}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* WELCOME HERO INFO COLUMN */}
          <div className="order-2 space-y-5 lg:order-1 lg:col-span-7">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold tracking-wide"
              style={{ background: tokens.badgeBg, color: tokens.badgeText, borderColor: `${ARCTIC_SKY.skyMain}44` }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{LOCALES[lang].home.liveBadge}</span>
            </span>

            <div className="space-y-2.5">
              <h1 className="font-display text-3xl font-extrabold tracking-tight leading-tight sm:text-5xl">
                {t.gateHeadline}
              </h1>
              <p className="max-w-xl text-sm sm:text-base leading-relaxed" style={{ color: tokens.textSecondary }}>
                {t.gateSubtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map((f) => {
                const Icon = f.icon
                return (
                  <div
                    key={f.title}
                    className="rounded-2xl border p-4 backdrop-blur-md"
                    style={{ background: tokens.cardBg, borderColor: tokens.cardBorder }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: `${f.tint}22`, color: f.tint }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="mt-3 font-display text-sm font-extrabold">{f.title}</div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
                      {f.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
