import type { Sex } from '../types'

export type Level = 'low' | 'normal' | 'high'

export interface GaugeSpec {
  min: number
  mid: number
  max: number
  unit: string
  /** Rango saludable [desde, hasta]; null = sin tope. */
  healthy: [number | null, number | null]
  caption: string
}

export function classify(value: number, [lo, hi]: [number | null, number | null]): Level {
  if (lo !== null && value < lo) return 'low'
  if (hi !== null && value > hi) return 'high'
  return 'normal'
}

export function fatRange(sex: Sex): [number, number] {
  return sex === 'M' ? [8, 20] : [21, 33]
}

export function waterRange(sex: Sex): [number, number] {
  return sex === 'M' ? [50, 65] : [45, 60]
}

export function gauges(sex: Sex) {
  const fat = fatRange(sex)
  const water = waterRange(sex)
  return {
    fat: {
      min: 0, mid: 25, max: 50, unit: '%', healthy: fat,
      caption: `Saludable ${sex === 'M' ? '♂' : '♀'} ${fat[0]}–${fat[1]}%`,
    },
    water: {
      min: 30, mid: 55, max: 80, unit: '%', healthy: water,
      caption: `Rango ${water[0]}–${water[1]}%`,
    },
    muscle: {
      min: 50, mid: 72.5, max: 95, unit: 'kg', healthy: [null, null],
      caption: 'Masa muscular total',
    },
    bone: {
      min: 2, mid: 3.5, max: 5, unit: 'kg', healthy: [2.95, null],
      caption: 'Normal ≥ 2.95 kg',
    },
    bmr: {
      min: 1500, mid: 2150, max: 2800, unit: 'kcal', healthy: [null, null],
      caption: 'Gasto metabólico basal',
    },
    metabolicAge: {
      min: 10, mid: 35, max: 60, unit: 'años', healthy: [null, null],
      caption: 'Edad metabólica / celular',
    },
    visceral: {
      min: 1, mid: 30, max: 59, unit: '', healthy: [1, 12],
      caption: 'Saludable 1–12',
    },
  } satisfies Record<string, GaugeSpec>
}

/** Valoración física 1–9: 1–3 bajo, 4–6 normal, 7–9 alto. */
export function ratingLevel(rating: number): Level {
  return rating <= 3 ? 'low' : rating <= 6 ? 'normal' : 'high'
}

export function ageFrom(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}
