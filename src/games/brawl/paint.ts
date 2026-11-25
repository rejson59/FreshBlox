import type { Match } from './sim'

export interface Palette {
  paper: string
  card: string
  ink: string
  line: string
  hot: string
  hotDeep: string
  muted: string
  p1: string
  p2: string
}

const TAU = Math.PI * 2

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.lineTo(x + w - k, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + k)
  ctx.lineTo(x + w, y + h - k)
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h)
  ctx.lineTo(x + k, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - k)
  ctx.lineTo(x, y + k)
  ctx.quadraticCurveTo(x, y, x + k, y)
  ctx.closePath()
}

function hatch(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) {
  ctx.save()
  ctx.strokeStyle = ink
  ctx.globalAlpha = 0.1
  ctx.lineWidth = 1
  const step = 13
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + h, h)
    ctx.stroke()
  }
  ctx.restore()
}

function dots(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) {
  ctx.save()
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.055
  const step = 18
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  ring: number,
  pal: Palette,
) {
  const R = ring * scale

  // hard offset shadow under the platform
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = pal.ink
  ctx.beginPath()
  ctx.arc(cx + scale * 0.032, cy + scale * 0.038, R, 0, TAU)
  ctx.fill()
  ctx.restore()

  // body
  const g = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.08, cx, cy, R)
  g.addColorStop(0, pal.card)
  g.addColorStop(0.66, pal.card)
  g.addColorStop(0.94, pal.paper)
  g.addColorStop(1, pal.line)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.fill()

  // coloured stage rim
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = pal.hot
  ctx.lineWidth = Math.max(2, R * 0.012)
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.975, 0, TAU)
  ctx.stroke()
  ctx.restore()

  ctx.lineWidth = 2.5
  ctx.strokeStyle = pal.ink
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.stroke()

  // rim ticks
  ctx.save()
  ctx.strokeStyle = pal.ink
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 1.5
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93)
    ctx.lineTo(cx + Math.cos(a) * R * 0.965, cy + Math.sin(a) * R * 0.965)
    ctx.stroke()
  }
  ctx.restore()

  // concentric guides
  ctx.save()
  ctx.strokeStyle = pal.ink
  for (const f of [0.74, 0.48]) {
    ctx.globalAlpha = 0.13
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, R * f, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.09
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.26, 0, TAU)
  ctx.stroke()
  ctx.restore()

  // centre rosette
  ctx.save()
  ctx.strokeStyle = pal.ink
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - R * 0.035, cy)
  ctx.lineTo(cx + R * 0.035, cy)
  ctx.moveTo(cx, cy - R * 0.035)
  ctx.lineTo(cx, cy + R * 0.035)
  ctx.stroke()
  ctx.restore()
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  m: Match,
  side: 0 | 1,
  cx: number,
  cy: number,
  scale: number,
  pal: Palette,
  name: string,
) {
  const f = m.f[side]
  if (m.koSide === side && m.phase === 'ko') return
  const size = f.r * scale * 2,
    x = cx + f.x * scale,
    y = cy + f.y * scale,
    col = side === 0 ? pal.p1 : pal.p2

  // dash cooldown arc
  if (f.dashCd > 0) {
    ctx.save()
    ctx.strokeStyle = pal.ink
    ctx.globalAlpha = 0.22
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, size * 0.86, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f.dashCd / 1.5))
    ctx.stroke()
    ctx.restore()
  }

  // shadow
  ctx.save()
  ctx.globalAlpha = 0.24
  ctx.fillStyle = pal.ink
  rr(ctx, x - size / 2 + scale * 0.012, y - size / 2 + scale * 0.015, size, size, size * 0.3)
  ctx.fill()
  ctx.restore()

  // body
  ctx.save()
  rr(ctx, x - size / 2, y - size / 2, size, size, size * 0.3)
  ctx.fillStyle = f.flash > 0 ? pal.ink : col
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = pal.ink
  ctx.stroke()

  // face
  const ex = Math.cos(f.face) * size * 0.16,
    ey = Math.sin(f.face) * size * 0.16,
    er = size * 0.085
  ctx.fillStyle = pal.ink
  ctx.beginPath()
  ctx.arc(x + ex - size * 0.16, y + ey - size * 0.08, er, 0, TAU)
  ctx.arc(x + ex + size * 0.16, y + ey - size * 0.08, er, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.arc(x + ex, y + ey + size * 0.2, size * 0.11, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.strokeStyle = pal.ink
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()

  // name tag
  ctx.save()
  ctx.font = '700 10px Inter, system-ui, sans-serif'
  const tw = ctx.measureText(name).width
  const pad = 6,
    bw = tw + pad * 2,
    bh = 16
  ctx.globalAlpha = 0.92
  rr(ctx, x - bw / 2, y - size / 2 - bh - 13, bw, bh, 5)
  ctx.fillStyle = pal.ink
  ctx.fill()
  ctx.fillStyle = pal.card
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x, y - size / 2 - bh / 2 - 13)
  ctx.restore()
}

export function paintBrawl(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: Match,
  pal: Palette,
  names: [string, string],
) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = pal.paper
  ctx.fillRect(0, 0, w, h)
  dots(ctx, w, h, pal.ink)

  const cx = w / 2,
    cy = h / 2 + h * 0.02,
    scale = Math.min(w, h) * 0.355

  // the void: hatched danger field behind the platform (the opaque disc covers it)
  hatch(ctx, w, h, pal.ink)

  drawPlatform(ctx, cx, cy, scale, m.ring, pal)

  // dash ghosts
  for (const g of m.ghosts) {
    const a = (g.life / g.max) * 0.35
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = g.color
    const s = m.f[0].r * scale * 1.5
    rr(ctx, cx + g.x * scale - s / 2, cy + g.y * scale - s / 2, s, s, s * 0.3)
    ctx.fill()
    ctx.restore()
  }

  drawFighter(ctx, m, 1, cx, cy, scale, pal, names[1])
  drawFighter(ctx, m, 0, cx, cy, scale, pal, names[0])

  for (const p of m.particles) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, p.life / p.max)
    ctx.translate(cx + p.x * scale, cy + p.y * scale)
    ctx.rotate(p.spin * (1 - p.life / p.max))
    ctx.fillStyle = p.color
    const s = p.size * scale
    ctx.fillRect(-s / 2, -s / 2, s, s)
    ctx.restore()
  }

  // ring-shrink warning: a dashed circle at the current rim, pulsing when close to the minimum
  const danger = Math.min(1, m.roundT / 26)
  if (danger > 0.55) {
    ctx.save()
    ctx.globalAlpha = 0.25 + danger * 0.3
    ctx.strokeStyle = pal.hot
    ctx.lineWidth = 2
    ctx.setLineDash([7, 9])
    ctx.beginPath()
    ctx.arc(cx, cy, m.ring * scale + 5, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
}
