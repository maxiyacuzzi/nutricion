import type { DietaryRoutine, DietaryRoutineKey } from '../types'

export const ROUTINE_MEALS: { key: DietaryRoutineKey; label: string; timePlaceholder: string; whatPlaceholder: string; optional?: boolean }[] = [
  { key: 'desayuno', label: 'Desayuno', timePlaceholder: 'Ej: 08:00', whatPlaceholder: 'Ej: mate con tostadas' },
  { key: 'almuerzo', label: 'Almuerzo', timePlaceholder: 'Ej: 13:00', whatPlaceholder: 'Ej: milanesa con ensalada' },
  { key: 'merienda', label: 'Merienda', timePlaceholder: 'Ej: 17:30', whatPlaceholder: 'Ej: té con galletitas' },
  { key: 'cena', label: 'Cena', timePlaceholder: 'Ej: 21:00', whatPlaceholder: 'Ej: sopa' },
  {
    key: 'anxiety', label: 'Momentos de ansiedad (otras comidas)', optional: true,
    timePlaceholder: 'Ej: a la noche', whatPlaceholder: 'Ej: galletitas dulces, picoteo',
  },
]

export function emptyDietaryRoutine(): DietaryRoutine {
  return {
    desayuno: { time: null, what: null },
    almuerzo: { time: null, what: null },
    merienda: { time: null, what: null },
    cena: { time: null, what: null },
    anxiety: { time: null, what: null },
  }
}

/** null si está todo vacío (no vale la pena guardar un objeto lleno de nulls). */
export function cleanDietaryRoutine(r: DietaryRoutine): DietaryRoutine | null {
  const hasAny = Object.values(r).some((e) => e.time || e.what)
  return hasAny ? r : null
}
