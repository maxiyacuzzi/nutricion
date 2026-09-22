import type { Sex } from '../types'

export type SegmentId = 'trunk' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg'

export interface SegmentData {
  fatPct: number | null
  muscleKg: number | null
}

type Pt = [number, number]

/** Kg de músculo de referencia por segmento (hombre); mujer ≈ 72 %. */
const MUSCLE_REF: Record<'trunk' | 'arm' | 'leg', number> = { trunk: 28, arm: 4.2, leg: 10.5 }
const FAT_SCALE_MAX = 45
const MAX_FAT_THICKNESS = 11 // px de la capa de grasa a 45 %

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Curva cerrada suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
function smoothClosed(pts: Pt[]): string {
  const n = pts.length
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + ' Z'
}

/** Cuerpo simétrico respecto al eje x=0: estaciones [y, semiancho] → contorno cerrado. */
function symmetric(stations: [number, number][], top: number, bottom: number): string {
  const right = stations.map(([y, h]): Pt => [h, y])
  const left = [...stations].reverse().map(([y, h]): Pt => [-h, y])
  return smoothClosed([[0, top], ...right, [0, bottom], ...left])
}

// [posición relativa 0–1 (o y en tronco), semiancho base, factor de grasa]
type Profile = [number, number, number][]

const TRUNK: Profile = [
  [0, 16, 0.3], [10, 30, 0.4], [32, 29, 0.7], [72, 24, 1.6], [100, 25, 1.3], [124, 24, 0.9], [136, 17, 0.5],
]
const ARM: Profile = [[0, 9, 0.6], [0.28, 10.5, 0.8], [0.55, 8, 0.7], [0.8, 6.5, 0.6], [1, 5.5, 0.5]]
const LEG: Profile = [[0, 14.5, 0.8], [0.25, 14, 1], [0.5, 10, 0.8], [0.62, 10.5, 0.8], [0.85, 7, 0.6], [1, 5.5, 0.5]]

export const LAYOUT = {
  cx: 100,
  shoulderY: 68,
  trunkLen: 138,
  armLen: 132,
  hipY: 178,
  legLen: 200,
}

export interface Layers {
  /** Contorno exterior (músculo + grasa). */
  outer: string
  /** Núcleo muscular. */
  core: string
  /** Opacidad de la capa de grasa, 0–1. */
  fatOpacity: number
  /** Semiancho exterior en el hombro/cadera (para ubicar las extremidades). */
  edge: number
}

function build(
  profile: Profile,
  len: number,
  muscleScale: number,
  fatT: number,
  scaleY = (v: number) => v,
): Layers {
  const mk = (extra: (f: number) => number) =>
    profile.map(([t, w, f]): [number, number] => [scaleY(t) , w * muscleScale + extra(f)])
  const core = mk(() => 0)
  const outer = mk((f) => fatT * f)
  const shape = (st: [number, number][]) => symmetric(st, -2, len + 6)
  return { core: shape(core), outer: shape(outer), fatOpacity: 0, edge: outer[1][1] }
}

export function segmentLayers(id: SegmentId, sex: Sex, data: SegmentData): Layers {
  const kind = id === 'trunk' ? 'trunk' : id.endsWith('Arm') ? 'arm' : 'leg'
  const ref = MUSCLE_REF[kind] * (sex === 'M' ? 1 : 0.72)
  const ratio = data.muscleKg === null ? 1 : clamp(data.muscleKg / ref, 0.7, 1.3)
  const fat = data.fatPct === null ? 15 : clamp(data.fatPct, 0, FAT_SCALE_MAX)
  const fatT = 1.5 + (fat / FAT_SCALE_MAX) * MAX_FAT_THICKNESS

  const profile = kind === 'trunk' ? TRUNK : kind === 'arm' ? ARM : LEG
  const len = kind === 'trunk' ? LAYOUT.trunkLen : kind === 'arm' ? LAYOUT.armLen : LAYOUT.legLen
  // En arm/leg las posiciones son relativas (0–1); en el tronco ya son y absolutas.
  const scaleY = kind === 'trunk' ? (v: number) => v : (v: number) => v * len
  const layers = build(profile, len, ratio, fatT, scaleY)
  layers.fatOpacity = data.fatPct === null ? 0.12 : 0.18 + 0.5 * (fat / 40)
  return layers
}
