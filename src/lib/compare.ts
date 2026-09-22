import type { Measurement, MeasurementKey } from '../types'

export type CompareMode = 'previous' | 'first'
export type Trend = 'good' | 'bad' | 'neutral'

export interface MetricSpec {
  key: MeasurementKey
  label: string
  unit: string
  decimals: number
  /** Sentido en que el cambio es favorable; null = no se juzga (depende del objetivo del paciente). */
  good: 'up' | 'down' | null
}

const m = (key: MeasurementKey, label: string, unit: string, decimals: number, good: MetricSpec['good']): MetricSpec => ({
  key, label, unit, decimals, good,
})

export const GENERAL_METRICS: MetricSpec[] = [
  m('weight_kg', 'Peso', 'kg', 1, null),
  m('body_fat_pct', 'Grasa corporal', '%', 1, 'down'),
  m('body_water_pct', 'Agua corporal', '%', 1, null),
  m('muscle_mass_kg', 'Masa muscular', 'kg', 1, 'up'),
  m('bone_mass_kg', 'Masa ósea', 'kg', 2, null),
  m('visceral_fat', 'Grasa visceral', '', 1, 'down'),
  m('physical_rating', 'Valoración física', '', 0, 'up'),
  m('bmr_kcal', 'DCI / BMR', 'kcal', 0, null),
  m('metabolic_age', 'Edad metabólica', 'años', 0, 'down'),
]

export const FAT_METRICS: MetricSpec[] = [
  m('fat_trunk_pct', 'Tronco', '%', 1, 'down'),
  m('fat_right_arm_pct', 'Brazo derecho', '%', 1, 'down'),
  m('fat_left_arm_pct', 'Brazo izquierdo', '%', 1, 'down'),
  m('fat_right_leg_pct', 'Pierna derecha', '%', 1, 'down'),
  m('fat_left_leg_pct', 'Pierna izquierda', '%', 1, 'down'),
]

export const MUSCLE_METRICS: MetricSpec[] = [
  m('muscle_trunk_kg', 'Tronco', 'kg', 1, 'up'),
  m('muscle_right_arm_kg', 'Brazo derecho', 'kg', 1, 'up'),
  m('muscle_left_arm_kg', 'Brazo izquierdo', 'kg', 1, 'up'),
  m('muscle_right_leg_kg', 'Pierna derecha', 'kg', 1, 'up'),
  m('muscle_left_leg_kg', 'Pierna izquierda', 'kg', 1, 'up'),
]

/** Base contra la que se compara la última medición (`ms` ordenado de la más vieja a la más nueva). */
export function pickPair(ms: Measurement[], mode: CompareMode): { base: Measurement; current: Measurement } | null {
  if (ms.length < 2) return null
  const current = ms[ms.length - 1]
  return { base: mode === 'previous' ? ms[ms.length - 2] : ms[0], current }
}

/** Diferencia redondeada a los decimales del indicador; null si falta alguno de los dos valores. */
export function delta(spec: MetricSpec, base: Measurement, current: Measurement): number | null {
  const a = base[spec.key]
  const b = current[spec.key]
  if (a === null || b === null) return null
  const d = Number((b - a).toFixed(spec.decimals))
  return d === 0 ? 0 : d
}

export function trend(spec: MetricSpec, d: number | null): Trend {
  if (d === null || d === 0 || spec.good === null) return 'neutral'
  return (d > 0) === (spec.good === 'up') ? 'good' : 'bad'
}

export function formatValue(spec: MetricSpec, v: number | null): string {
  return v === null ? '—' : v.toFixed(spec.decimals)
}

export function formatDelta(spec: MetricSpec, d: number | null): string {
  if (d === null) return '—'
  if (d === 0) return '='
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(spec.decimals)}`
}

export function elapsed(from: string, to: string): string {
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
  if (days < 14) return `${days} ${days === 1 ? 'día' : 'días'}`
  if (days < 60) return `${Math.round(days / 7)} semanas`
  return `${(days / 30.4).toFixed(1).replace(/\.0$/, '')} meses`
}
