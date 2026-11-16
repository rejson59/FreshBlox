import React, { useId } from 'react'
import { ARCTIC_SKY, ThemeMode } from '../../data/brandTheme'

/**
 * Official Locked-In FreshBlox Logo: F-03 (Studio Bevel Extrude, 0% Aura)
 * Crisp architectural 3D beveled "F" in Arctic Sky gradient (White → Sky → Deep Sky)
 */
export const FreshBloxLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '')
  const { skyDeep, skyMain, skyBright, iceWhite } = ARCTIC_SKY

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-label="FreshBlox"
    >
      <defs>
        <linearGradient id={`${uid}-front`} x1="28" y1="20" x2="90" y2="98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={iceWhite} />
          <stop offset="32%" stopColor={skyBright} />
          <stop offset="68%" stopColor={skyMain} />
          <stop offset="100%" stopColor={skyDeep} />
        </linearGradient>
        <linearGradient id={`${uid}-mid`} x1="34" y1="24" x2="92" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={skyMain} />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
      </defs>

      {/* Deep 3D Extrude Layer */}
      <path d="M42 29 H90 L86 45 H58 V57 H82 L78 72 H58 V101 H42 V29 Z" fill={skyDeep} opacity="0.92" />
      {/* Mid Bevel Layer */}
      <path d="M38 25 H88 L84 41 H55 V54 H80 L76 69 H55 V98 H38 V25 Z" fill={`url(#${uid}-mid)`} />
      {/* Front Illuminated Beveled Face */}
      <path
        d="M34 21 H85 L81 38 H52 V51 H77 L73 66 H52 V95 H34 V21 Z"
        fill={`url(#${uid}-front)`}
        stroke={iceWhite}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Subtle Crystal Inner Facet Rim (homage to F-09) */}
      <path
        d="M38 25 H80.5 L78.5 34 H48 V55 H72.5 L70.5 62 H48 V91 H38 V25 Z"
        fill="none"
        stroke={iceWhite}
        strokeWidth="1.15"
        opacity="0.65"
      />
    </svg>
  )
}

/**
 * Official Locked-In FreshBlox Wordmark: T-03 (Glacier Flow Italic — Custom SVG)
 */
export const FreshBloxWordmark: React.FC<{
  mode: ThemeMode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ mode, size = 'md', className = '' }) => {
  const uid = useId().replace(/:/g, '')
  const { skyDeep, skyMain, skyBright, iceWhite } = ARCTIC_SKY
  const h = size === 'sm' ? 24 : size === 'lg' ? 42 : 32
  const w = Math.round(h * 4.8)

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 218 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none overflow-visible ${className}`}
      aria-label="FreshBlox"
    >
      <defs>
        <linearGradient id={`${uid}-w`} x1="0" y1="6" x2="210" y2="42" gradientUnits="userSpaceOnUse">
          {mode === 'dark' ? (
            <>
              <stop offset="0%" stopColor={iceWhite} />
              <stop offset="48%" stopColor={skyBright} />
              <stop offset="85%" stopColor={skyMain} />
              <stop offset="100%" stopColor={skyDeep} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#0A2342" />
              <stop offset="46%" stopColor={skyDeep} />
              <stop offset="82%" stopColor={skyMain} />
              <stop offset="100%" stopColor="#0284C7" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${uid}-u`} x1="0" y1="44" x2="205" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={skyMain} />
          <stop offset="60%" stopColor={skyBright} />
          <stop offset="100%" stopColor={mode === 'dark' ? iceWhite : skyDeep} />
        </linearGradient>
      </defs>

      <text
        x="4"
        y="35"
        fill={`url(#${uid}-w)`}
        style={{
          fontFamily: "'Exo 2', sans-serif",
          fontWeight: 800,
          fontStyle: 'italic',
          fontSize: '37px',
          letterSpacing: '-0.015em',
        }}
      >
        FreshBlox
      </text>
      <path d="M4 42 H174 L165 45.5 H0 L4 42 Z" fill={`url(#${uid}-u)`} opacity="0.9" />
      <path d="M180 42 H200 L195 45.5 H175 L180 42 Z" fill={skyMain} opacity="0.85" />
    </svg>
  )
}

/**
 * Official Locked-In FreshGems Icon: G-02 (Kryształowy Romb / Crystal Shard)
 */
export const FreshGemShard: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '')
  const { skyDeep, skyMain, skyBright, iceWhite } = ARCTIC_SKY

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-label="FreshGems"
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={iceWhite} />
          <stop offset="36%" stopColor={skyBright} />
          <stop offset="72%" stopColor={skyMain} />
          <stop offset="100%" stopColor={skyDeep} />
        </linearGradient>
      </defs>
      <polygon
        points="32,5 50,30 32,59 14,30"
        fill={`url(#${uid}-g)`}
        stroke={iceWhite}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <polygon points="32,5 32,59 14,30" fill={iceWhite} opacity="0.34" />
      <polygon points="32,5 42,30 32,34 22,30" fill={iceWhite} opacity="0.76" />
      <polygon points="32,34 50,30 32,59" fill={skyDeep} opacity="0.45" />
    </svg>
  )
}
