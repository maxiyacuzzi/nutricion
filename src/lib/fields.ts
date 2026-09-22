import type { MeasurementKey } from '../types'

export interface FieldSpec {
  key: MeasurementKey
  label: string
  placeholder: string
  step: string
}

export interface FieldGroup {
  title: string
  subtitle?: string
  fields: FieldSpec[]
}

const f = (key: MeasurementKey, label: string, placeholder: string, step = '0.1'): FieldSpec => ({
  key, label, placeholder: `Ej: ${placeholder}`, step,
})

/** Grupos del formulario de medición, en el orden en que se muestran. */
export const MEASUREMENT_GROUPS: FieldGroup[] = [
  {
    title: 'Composición corporal',
    subtitle: 'Valores generales',
    fields: [
      f('body_fat_pct', 'Grasa corporal (%)', '22.3'),
      f('body_water_pct', 'Agua corporal (%)', '55.0'),
      f('muscle_mass_kg', 'Masa muscular (kg)', '30.0'),
      f('visceral_fat', 'Grasa visceral', '9'),
      f('total_fat_pct', 'TG — Grasa total (%)', '18.5'),
    ],
  },
  {
    title: 'Composición corporal',
    subtitle: 'Grasa por segmento (%)',
    fields: [
      f('fat_trunk_pct', 'G Tronco (%)', '18.5'),
      f('fat_left_arm_pct', 'G BI — Brazo izq.', '20.1'),
      f('fat_right_arm_pct', 'G BD — Brazo der.', '19.8'),
      f('fat_left_leg_pct', 'G PI — Pierna izq.', '24.3'),
      f('fat_right_leg_pct', 'G PD — Pierna der.', '23.9'),
    ],
  },
  {
    title: 'Composición corporal',
    subtitle: 'Músculo por segmento (kg)',
    fields: [
      f('muscle_trunk_kg', 'Musc Tronco (kg)', '27.6'),
      f('muscle_left_arm_kg', 'Musc BI — Brazo izq.', '3.5'),
      f('muscle_right_arm_kg', 'Musc BD — Brazo der.', '3.7'),
      f('muscle_left_leg_kg', 'Musc PI — Pierna izq.', '9.2'),
      f('muscle_right_leg_kg', 'Musc PD — Pierna der.', '9.0'),
    ],
  },
  {
    title: 'Metabolismo',
    fields: [
      f('bmr_kcal', 'DCI / BMR (kcal)', '1750', '1'),
      f('metabolic_age', 'Edad metabólica / celular (años)', '34', '1'),
    ],
  },
]
