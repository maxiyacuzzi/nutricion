import type { MeasurementKey, MeasurementValues } from '../types'

/** Estado del formulario: todo como texto para poder dejar campos vacíos. */
export type MeasurementForm = Record<MeasurementKey, string>

export function emptyMeasurementForm(): MeasurementForm {
  const keys: MeasurementKey[] = [
    'weight_kg', 'physical_rating', 'bone_mass_kg', 'body_fat_pct', 'body_water_pct', 'muscle_mass_kg',
    'visceral_fat', 'total_fat_pct', 'fat_trunk_pct', 'fat_left_arm_pct', 'fat_right_arm_pct',
    'fat_left_leg_pct', 'fat_right_leg_pct', 'muscle_trunk_kg', 'muscle_left_arm_kg', 'muscle_right_arm_kg',
    'muscle_left_leg_kg', 'muscle_right_leg_kg', 'bmr_kcal', 'metabolic_age',
  ]
  return Object.fromEntries(keys.map((k) => [k, ''])) as MeasurementForm
}

export function parseMeasurementForm(form: MeasurementForm): MeasurementValues {
  const out: Record<string, number | null> = {}
  for (const [key, raw] of Object.entries(form)) {
    const text = raw.trim().replace(',', '.')
    if (text === '') {
      out[key] = null
      continue
    }
    const n = Number(text)
    if (!Number.isFinite(n)) throw new Error(`Valor inválido en "${key}": ${raw}`)
    out[key] = n
  }
  if (out.weight_kg === null || out.weight_kg <= 0) throw new Error('El peso es obligatorio')
  return out as unknown as MeasurementValues
}
