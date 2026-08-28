/**
 * Genera los íconos PNG de la PWA a partir del logotipo de SIR-Flow
 * (marca "bot" de lucide en amarillo sobre fondo negro SIRSA).
 *
 * No depende de librerías externas: rasteriza con supersampling y
 * codifica el PNG con el módulo `zlib` de Node.
 *
 *   node scripts/generate-pwa-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT_DIR, { recursive: true })

// ── Paleta SIRSA ─────────────────────────────────────────────────────────────
const BG = [0x1d, 0x1c, 0x19] // negro
const FG = [0xf8, 0xcd, 0x24] // amarillo

// ── Utilidades de geometría (SDF) ────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const sdSegment = (px, py, ax, ay, bx, by) => {
  const pax = px - ax, pay = py - ay
  const bax = bx - ax, bay = by - ay
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1)
  const dx = pax - bax * h, dy = pay - bay * h
  return Math.hypot(dx, dy)
}

// SDF de un rectángulo redondeado centrado en el origen
const sdRoundBox = (px, py, bx, by, r) => {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

/*
 * Devuelve la cobertura [0..1] del color de frente para un punto (x,y)
 * expresado en el viewBox 24×24 de lucide.
 * Reproduce el ícono "bot":
 *   - contorno de la cabeza (rect redondeado)
 *   - antena (M12 8V4H8)
 *   - orejas (M2 14h2 / M20 14h2)
 *   - ojos  (M9 13v2 / M15 13v2)
 */
const STROKE = 2 // grosor de trazo en unidades del viewBox
const half = STROKE / 2

const botDistance = (x, y) => {
  // Cabeza: rect x=4..20, y=8..20  → centro (12,14), medio-lado (8,6), r=2
  const headRing = Math.abs(sdRoundBox(x - 12, y - 14, 8, 6, 2)) - half

  // Segmentos con cap redondo → distancia al segmento menos half
  const antenna = Math.min(
    sdSegment(x, y, 12, 8, 12, 4),
    sdSegment(x, y, 12, 4, 8, 4),
  ) - half
  const earL = sdSegment(x, y, 2, 14, 4, 14) - half
  const earR = sdSegment(x, y, 20, 14, 22, 14) - half
  const eyeL = sdSegment(x, y, 9, 13, 9, 15) - half
  const eyeR = sdSegment(x, y, 15, 13, 15, 15) - half

  return Math.min(headRing, antenna, earL, earR, eyeL, eyeR)
}

// ── Rasterizado ──────────────────────────────────────────────────────────────
const SS = 4 // supersampling

const renderIcon = (size) => {
  const buf = Buffer.alloc(size * size * 4)
  // El viewBox 24 ocupa el 82% del lienzo, centrado
  const span = size * 0.82
  const scale = span / 24
  const offset = (size - span) / 2

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cov = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const cx = px + (sx + 0.5) / SS
          const cy = py + (sy + 0.5) / SS
          const vx = (cx - offset) / scale
          const vy = (cy - offset) / scale
          // antialias del borde en ~0.75px de lienzo
          const d = botDistance(vx, vy) * scale
          cov += clamp(0.5 - d / 0.9, 0, 1)
        }
      }
      cov /= SS * SS
      const i = (py * size + px) * 4
      buf[i]     = Math.round(BG[0] + (FG[0] - BG[0]) * cov)
      buf[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * cov)
      buf[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * cov)
      buf[i + 3] = 255
    }
  }
  return buf
}

// ── Codificación PNG (RGBA, sin entrelazar) ──────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const encodePNG = (size, rgba) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Salidas ──────────────────────────────────────────────────────────────────
const targets = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-icon-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
  ['pwa-64x64.png', 64],
]

for (const [name, size] of targets) {
  const png = encodePNG(size, renderIcon(size))
  writeFileSync(join(OUT_DIR, name), png)
  console.log(`✓ ${name} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`)
}
