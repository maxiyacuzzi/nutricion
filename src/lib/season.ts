export type Season = 'verano' | 'otono' | 'invierno' | 'primavera'

export interface SeasonTheme {
  label: string
  emoji: string
  /** Color fuerte: banda de encabezado. */
  bg: string
  /** Color sobre `bg`. */
  onBg: string
  /** Fondo suave: tarjeta del plan. */
  soft: string
  /** Acento: header de la tabla, pills de día. */
  accent: string
  /** Texto sobre `accent`. */
  onAccent: string
}

// Estaciones del hemisferio sur.
const THEMES: Record<Season, SeasonTheme> = {
  verano: { label: 'Verano', emoji: '☀️', bg: '#e3a53a', onBg: '#3a2707', soft: '#fdf3e2', accent: '#c98a1f', onAccent: '#fffaf0' },
  otono: { label: 'Otoño', emoji: '🍂', bg: '#bd6a35', onBg: '#391f0d', soft: '#faeee2', accent: '#a2551f', onAccent: '#fff6ee' },
  invierno: { label: 'Invierno', emoji: '❄️', bg: '#4f7fa3', onBg: '#f3f9ff', soft: '#eaf3fa', accent: '#3d6586', onAccent: '#f3f9ff' },
  primavera: { label: 'Primavera', emoji: '🌸', bg: '#7fa263', onBg: '#f4f9ef', soft: '#f1f6ea', accent: '#5f7f47', onAccent: '#f4f9ef' },
}

/** Estación a la que corresponde una fecha, usando el hemisferio sur (verano = dic-feb, etc.). */
export function seasonOf(iso: string): Season {
  const month = new Date(iso).getMonth() + 1
  if (month === 12 || month <= 2) return 'verano'
  if (month <= 5) return 'otono'
  if (month <= 8) return 'invierno'
  return 'primavera'
}

export function seasonTheme(season: Season): SeasonTheme {
  return THEMES[season]
}
