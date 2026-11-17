import React, { useState } from 'react'
import { AlertCircle, CheckCircle2, Cloud, Loader2, Lock, Mail, User, X } from 'lucide-react'
import { ARCTIC_SKY, getThemeTokens, ThemeMode } from '../../data/brandTheme'
import { Lang, LOCALES } from '../../data/locales'
import { FreshBloxLogo } from '../brand/FreshBloxBrand'
import { sfx } from '../../lib/sfx'

interface AuthModalProps {
  open: boolean
  initialTab?: 'login' | 'register'
  mode: ThemeMode
  lang: Lang
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onSignUp: (email: string, password: string, username: string) => Promise<{ ok: boolean; error?: string }>
}

function translateAuthError(raw: string | undefined, lang: Lang): string {
  if (!raw) return lang === 'pl' ? 'Wystąpił błąd. Spróbuj ponownie.' : 'Something went wrong. Please try again.'
  const low = raw.toLowerCase()
  if (low.includes('invalid login credentials')) {
    return lang === 'pl' ? 'Nieprawidłowy e-mail lub hasło.' : 'Invalid email or password.'
  }
  if (low.includes('user already registered') || low.includes('already exists')) {
    return lang === 'pl' ? 'Konto z tym adresem e-mail już istnieje — zaloguj się!' : 'An account with this email already exists — try signing in!'
  }
  if (low.includes('password should be at least')) {
    return lang === 'pl' ? 'Hasło musi mieć co najmniej 6 znaków.' : 'Password must be at least 6 characters.'
  }
  if (low.includes('unable to validate email') || low.includes('invalid email')) {
    return lang === 'pl' ? 'Podaj poprawny adres e-mail.' : 'Please enter a valid email address.'
  }
  return raw
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialTab = 'login',
  mode,
  lang,
  onClose,
  onSignIn,
  onSignUp,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!open) return null

  const t = LOCALES[lang].auth
  const tokens = getThemeTokens(mode)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email.trim() || password.length < 6) {
      setErrorMsg(
        lang === 'pl'
          ? 'Wpisz poprawny e-mail i hasło (min. 6 znaków).'
          : 'Enter a valid email and a password (min. 6 chars).',
      )
      return
    }
    if (tab === 'register' && username.trim().length < 2) {
      setErrorMsg(lang === 'pl' ? 'Wpisz nazwę gracza (min. 2 znaki).' : 'Enter a display name (min. 2 chars).')
      return
    }

    setSubmitting(true)
    try {
      const res =
        tab === 'login'
          ? await onSignIn(email, password)
          : await onSignUp(email, password, username)

      if (!res.ok) {
        setErrorMsg(translateAuthError(res.error, lang))
      } else {
        sfx.playQuestClaim()
        setSuccessMsg(
          tab === 'login'
            ? lang === 'pl'
              ? 'Zalogowano! Wczytuję Twój profil...'
              : 'Signed in! Loading your profile...'
            : lang === 'pl'
              ? 'Konto utworzone! Witamy w FreshBlox!'
              : 'Account created! Welcome to FreshBlox!',
        )
        setTimeout(() => {
          setSuccessMsg(null)
          onClose()
        }, 650)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border p-5 sm:p-6 shadow-2xl"
        style={{
          background: mode === 'dark' ? '#0B162C' : '#F4FAFF',
          borderColor: `${ARCTIC_SKY.skyMain}55`,
          color: tokens.textPrimary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FreshBloxLogo size={32} />
            <div>
              <h2 className="font-display text-lg font-extrabold leading-tight">
                {tab === 'login' ? t.modalTitleLogin : t.modalTitleRegister}
              </h2>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <Cloud className="h-3 w-3" />
                <span>Supabase Cloud Auth</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:opacity-80 cursor-pointer"
            style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg, color: tokens.textPrimary }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border p-1"
          style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('login')
              setErrorMsg(null)
              sfx.playClick()
            }}
            className="rounded-xl py-2 text-xs font-extrabold transition cursor-pointer"
            style={{
              background: tab === 'login' ? tokens.buttonGradient : 'transparent',
              color: tab === 'login' ? '#FFFFFF' : tokens.textSecondary,
            }}
          >
            {t.tabLogin}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register')
              setErrorMsg(null)
              sfx.playClick()
            }}
            className="rounded-xl py-2 text-xs font-extrabold transition cursor-pointer"
            style={{
              background: tab === 'register' ? tokens.buttonGradient : 'transparent',
              color: tab === 'register' ? '#FFFFFF' : tokens.textSecondary,
            }}
          >
            {t.tabRegister}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {tab === 'register' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
                {t.usernameLabel}
              </label>
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
              >
                <User className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  maxLength={18}
                  autoComplete="username"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                  style={{ color: tokens.textPrimary }}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
              {t.emailLabel}
            </label>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
            >
              <Mail className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                autoComplete="email"
                required
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                style={{ color: tokens.textPrimary }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold" style={{ color: tokens.textSecondary }}>
              {t.passwordLabel}
            </label>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
              style={{ borderColor: tokens.cardBorder, background: tokens.mutedBg }}
            >
              <Lock className="h-4 w-4 shrink-0" style={{ color: ARCTIC_SKY.skyMain }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                style={{ color: tokens.textPrimary }}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
            style={{ background: tokens.buttonGradient }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{tab === 'login' ? t.submitLogin : t.submitRegister}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2 text-xs font-bold transition hover:opacity-80 cursor-pointer"
            style={{ color: tokens.textSecondary }}
          >
            {t.continueGuest}
          </button>
        </form>
      </div>
    </div>
  )
}
