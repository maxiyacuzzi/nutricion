// Helpers puros de la generación de planes con Gemini (sin red ni acceso a Deno.*), para poder probarlos.

export const MEAL_TYPES = ['desayuno', 'almuerzo', 'merienda', 'cena'] as const
export type MealType = (typeof MEAL_TYPES)[number]

/** weekday: 0 domingo … 6 sábado, igual que el resto de la app. */
export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export interface PlanItem {
  weekday: number
  meal_type: MealType
  content: string
}

export interface PatientContext {
  full_name: string
  sex: 'M' | 'F'
  age: number | null
  height_cm: number
  dietary_restrictions: string | null
  /** Última medición, si tiene alguna. */
  measurement: {
    weight_kg: number
    body_fat_pct: number | null
    muscle_mass_kg: number | null
    bmr_kcal: number | null
  } | null
  /** Anotaciones recientes, de la más nueva a la más vieja. */
  notes: string[]
  /** Objetivo que cargó el profesional al pedir el plan (opcional). */
  goal: string | null
}

const MAX_NOTES = 8
const MAX_NOTE_CHARS = 400

/** El prompt para Gemini, en texto. Es determinístico y no toca la red: se puede snapshot-testear. */
export function buildPrompt(ctx: PatientContext): string {
  const lines: string[] = [
    'Sos un asistente que arma planes de alimentación semanales para un profesional de nutrición humano, que va a',
    'revisar y editar el resultado antes de dárselo a su paciente. No sos vos quien atiende al paciente.',
    '',
    `Paciente: ${ctx.full_name}, sexo ${ctx.sex === 'M' ? 'masculino' : 'femenino'}${ctx.age !== null ? `, ${ctx.age} años` : ''}, ${ctx.height_cm} cm.`,
  ]

  if (ctx.measurement) {
    const m = ctx.measurement
    const extra = [
      m.body_fat_pct !== null ? `grasa corporal ${m.body_fat_pct}%` : null,
      m.muscle_mass_kg !== null ? `masa muscular ${m.muscle_mass_kg} kg` : null,
      m.bmr_kcal !== null ? `metabolismo basal ${m.bmr_kcal} kcal` : null,
    ].filter((x): x is string => x !== null)
    lines.push(`Última medición: peso ${m.weight_kg} kg${extra.length ? `, ${extra.join(', ')}` : ''}.`)
  } else {
    lines.push('Todavía no tiene mediciones cargadas.')
  }

  lines.push(
    ctx.dietary_restrictions
      ? `Restricciones alimenticias (excluir siempre): ${ctx.dietary_restrictions}.`
      : 'Sin restricciones alimenticias registradas.',
  )

  if (ctx.goal) lines.push(`Objetivo indicado por el profesional: ${ctx.goal}.`)

  if (ctx.notes.length > 0) {
    lines.push('', 'Anotaciones recientes del profesional sobre este paciente (más nueva primero):')
    for (const note of ctx.notes.slice(0, MAX_NOTES)) {
      lines.push(`- ${note.length > MAX_NOTE_CHARS ? `${note.slice(0, MAX_NOTE_CHARS)}…` : note}`)
    }
  }

  lines.push(
    '',
    'Armá un plan semanal completo: las 4 comidas (desayuno, almuerzo, merienda, cena) para los 7 días de la semana',
    '(28 celdas en total, ninguna vacía). Cada celda es una descripción breve y concreta de qué comer, con cantidades',
    'aproximadas cuando tenga sentido (ej. "Avena (40g) con leche descremada y una banana"). Evitá estrictamente',
    'cualquier alimento de las restricciones. Variá las comidas entre días. No agregues explicaciones fuera del plan.',
  )

  return lines.join('\n')
}

/** Esquema de salida que se le pide a Gemini (generationConfig.responseSchema). */
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          weekday: { type: 'INTEGER' },
          meal_type: { type: 'STRING', enum: MEAL_TYPES as unknown as string[] },
          content: { type: 'STRING' },
        },
        required: ['weekday', 'meal_type', 'content'],
      },
    },
  },
  required: ['items'],
}

const MAX_CONTENT_CHARS = 500

/**
 * Normaliza la respuesta cruda del modelo a filas válidas de la grilla: descarta lo que no cumple el formato,
 * recorta el texto largo y, si hay dos filas para la misma celda, se queda con la última. Nunca lanza.
 */
export function parsePlanItems(raw: unknown): PlanItem[] {
  const arr = (raw as { items?: unknown })?.items
  if (!Array.isArray(arr)) return []

  const byCell = new Map<string, PlanItem>()
  for (const row of arr) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const weekday = Number(r.weekday)
    const mealType = typeof r.meal_type === 'string' ? r.meal_type.trim().toLowerCase() : ''
    const content = typeof r.content === 'string' ? r.content.trim() : ''
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue
    if (!MEAL_TYPES.includes(mealType as MealType)) continue
    if (content === '') continue
    const key = `${weekday}-${mealType}`
    byCell.set(key, { weekday, meal_type: mealType as MealType, content: content.slice(0, MAX_CONTENT_CHARS) })
  }
  return [...byCell.values()]
}
