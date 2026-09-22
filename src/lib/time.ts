/** Helpers de fecha/hora en la zona horaria del profesional (los turnos se muestran siempre en su hora local). */

export const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
/** Orden de visualización: lunes primero. Los valores son weekday 0–6 (0 = domingo). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** "YYYY-MM-DD" de un instante, en la zona `tz`. */
export function localDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** "HH:mm" de un instante, en la zona `tz`. */
export function localTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function todayIn(tz: string): string {
  return localDate(new Date().toISOString(), tz)
}

/** Suma días a un "YYYY-MM-DD" (aritmética de calendario, sin problemas de husos). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado, de un "YYYY-MM-DD". */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

/** Lunes de la semana que contiene `date`. */
export function mondayOf(date: string): string {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function formatDay(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...opts }).format(new Date(`${date}T12:00:00Z`))
}

/** "lunes 22 de septiembre" */
export const longDay = (date: string) => formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })

/** Rango de un turno: "lun 22 sept · 10:00–10:30". */
export function appointmentLabel(startsAt: string, endsAt: string, tz: string): string {
  const day = formatDay(localDate(startsAt, tz), { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day} · ${localTime(startsAt, tz)}–${localTime(endsAt, tz)}`
}

/** "09:00:00" → "09:00" */
export const hhmm = (t: string) => t.slice(0, 5)

/** Diferencia (ms) entre la hora local de `tz` y UTC en el instante `ts`. */
function tzOffsetMs(ts: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  )
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000
}

/** "2026-09-22" + "10:30" en la zona `tz` → instante ISO (UTC). */
export function zonedToIso(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let ts = guess - tzOffsetMs(guess, tz)
  const fixed = guess - tzOffsetMs(ts, tz) // segunda pasada: bordes de horario de verano
  if (fixed !== ts) ts = fixed
  return new Date(ts).toISOString()
}

/** Primer día del mes de `date` ("YYYY-MM-DD" → "YYYY-MM-01"). */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** Suma meses a un "YYYY-MM-01" (aritmética de calendario, sin problemas de husos). */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** "Septiembre de 2026" (con la primera letra en mayúscula, el resto tal cual da Intl). */
export function longMonth(date: string): string {
  const s = formatDay(date, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
