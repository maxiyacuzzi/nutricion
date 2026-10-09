import type { Measurement, MeasurementValues, Visit } from '../types'

export type Trend = 'good' | 'bad' | 'neutral'

/** Lo que se puede comparar de una visita: su peso/cintura (si fue simple) y su composición corporal (si tuvo medición detallada). */
export interface ComparisonValues extends Omit<MeasurementValues, 'weight_kg'> {
  weight_kg: number | null
  waist_umbilical_cm: number | null
  waist_high_cm: number | null
}

export type ComparisonKey = keyof ComparisonValues

export interface ComparisonEntry extends ComparisonValues {
  id: string
  visit_id: string
  measured_at: string
}

export interface MetricSpec {
  key: ComparisonKey
  label: string
  unit: string
  decimals: number
  /** Sentido en que el cambio es favorable; null = no se juzga (depende del objetivo del paciente). */
  good: 'up' | 'down' | null
}

const m = (key: ComparisonKey, label: string, unit: string, decimals: number, good: MetricSpec['good']): MetricSpec => ({
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

export const WAIST_METRICS: MetricSpec[] = [
  m('waist_umbilical_cm', 'Cintura umbilical', 'cm', 1, null),
  m('waist_high_cm', 'Cintura alta', 'cm', 1, null),
]

/** Composición corporal nula: lo que tiene una visita que sólo registró medición simple. */
const EMPTY_DETAIL: Omit<MeasurementValues, 'weight_kg'> = {
  physical_rating: null, bone_mass_kg: null, body_fat_pct: null, body_water_pct: null, muscle_mass_kg: null,
  visceral_fat: null, total_fat_pct: null, fat_trunk_pct: null, fat_left_arm_pct: null, fat_right_arm_pct: null,
  fat_left_leg_pct: null, fat_right_leg_pct: null, muscle_trunk_kg: null, muscle_left_arm_kg: null,
  muscle_right_arm_kg: null, muscle_left_leg_kg: null, muscle_right_leg_kg: null, bmr_kcal: null, metabolic_age: null,
}

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

/** Un punto comparable por visita: su peso/cintura (medición simple) combinado con su composición corporal
 *  (medición detallada), si la tuvo. Así un paciente que sólo hace mediciones simples también puede comparar. */
export function buildComparisonEntries(visits: Visit[], measurements: Measurement[]): ComparisonEntry[] {
  const detailedByVisit = new Map(measurements.map((meas) => [meas.visit_id, meas]))
  return visits
    .map((v): ComparisonEntry => {
      const det = detailedByVisit.get(v.id)
      return {
        ...(det ?? EMPTY_DETAIL),
        id: v.id,
        visit_id: v.id,
        measured_at: v.visited_at,
        weight_kg: det?.weight_kg ?? v.weight_kg,
        waist_umbilical_cm: v.waist_umbilical_cm,
        waist_high_cm: v.waist_high_cm,
      }
    })
    .filter((e) => Object.entries(e).some(([k, val]) => !['id', 'visit_id', 'measured_at'].includes(k) && val !== null))
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
}

/** Par a comparar, ordenado cronológicamente (la más vieja de las dos elegidas queda como base). */
export function pickPair(entries: ComparisonEntry[], baseId: string, currentId: string): { base: ComparisonEntry; current: ComparisonEntry } | null {
  if (entries.length < 2) return null
  const a = entries.find((x) => x.id === baseId) ?? entries[entries.length - 2]
  const b = entries.find((x) => x.id === currentId) ?? entries[entries.length - 1]
  return new Date(a.measured_at) <= new Date(b.measured_at) ? { base: a, current: b } : { base: b, current: a }
}

/** Diferencia redondeada a los decimales del indicador; null si falta alguno de los dos valores. */
export function delta(spec: MetricSpec, base: ComparisonEntry, current: ComparisonEntry): number | null {
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
