import { useEffect, useState } from 'react'
import {
  addTimeOff, deleteTimeOff, listRules, listTimeOff, replaceRules, updateProfessional,
} from '../lib/agendaApi'
import { GoogleCalendarCard, type GoogleFlash } from './GoogleCalendarCard'
import { WEEKDAYS_LONG, WEEK_ORDER, formatDay, todayIn } from '../lib/time'
import type { AvailabilityRule, Professional, TimeOff } from '../types'

const DEFAULT_RANGES: [string, string][] = [['09:00', '13:00'], ['15:00', '18:00']]
const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90]

const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** Valida las franjas de un día: fin > inicio y sin superposiciones. Devuelve un mensaje o null. */
function validateDay(ranges: AvailabilityRule[]): string | null {
  const sorted = [...ranges].sort((a, b) => a.start_time.localeCompare(b.start_time))
  for (const [i, r] of sorted.entries()) {
    if (!r.start_time || !r.end_time || r.end_time <= r.start_time) return 'El horario de fin debe ser posterior al de inicio.'
    if (i > 0 && r.start_time < sorted[i - 1].end_time) return 'Hay franjas superpuestas.'
  }
  return null
}

function useSaved() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return [msg, setMsg] as const
}

interface Props {
  professional: Professional
  onProfessional: (p: Professional) => void
}

export function AvailabilityEditor({ professional, onProfessional, flash }: Props & { flash?: GoogleFlash | null }) {
  return (
    <div className="avail">
      <GoogleCalendarCard flash={flash ?? null} />
      <BookingSettings professional={professional} onProfessional={onProfessional} />
      <WeeklyHours />
      <TimeOffList tz={professional.timezone} />
    </div>
  )
}

function BookingSettings({ professional: p, onProfessional }: Props) {
  const [form, setForm] = useState({
    display_name: p.display_name,
    slug: p.slug,
    slot_minutes: p.slot_minutes,
    min_notice_hours: p.min_notice_hours,
    max_days_ahead: p.max_days_ahead,
    booking_enabled: p.booking_enabled,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useSaved()
  const link = `${window.location.origin}/reservar/${form.slug}`

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      onProfessional(await updateProfessional(p.id, { ...form, slug: slugify(form.slug) }))
      setMsg({ ok: true, text: 'Guardado.' })
    } catch (err) {
      const m = err instanceof Error ? err.message : ''
      setMsg({ ok: false, text: m === 'slug_taken' ? 'Ese link ya está en uso. Probá con otro.' : 'No se pudo guardar. Revisá los datos.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={save}>
      <h3 className="card-title">Reserva online</h3>
      <label className="check">
        <input type="checkbox" checked={form.booking_enabled} onChange={(e) => setForm({ ...form, booking_enabled: e.target.checked })} />
        Los pacientes pueden reservar turnos por el link
      </label>
      <div className="grid g2">
        <label>Nombre que ve el paciente
          <input required minLength={2} maxLength={100} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </label>
        <label>Link de reserva
          <input required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]{2,39}" title="Minúsculas, números y guiones (3 a 40 caracteres)"
            value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
        </label>
      </div>
      <div className="linkbox">
        <code>{link}</code>
        <button type="button" className="btn small" onClick={() => navigator.clipboard?.writeText(link)}>Copiar</button>
        <a className="btn small" href={link} target="_blank" rel="noreferrer">Abrir</a>
      </div>
      <div className="grid g3">
        <label>Duración del turno
          <select value={form.slot_minutes} onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })}>
            {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} minutos</option>)}
          </select>
        </label>
        <label>Aviso mínimo (horas)
          <input type="number" min={0} max={720} value={form.min_notice_hours} onChange={(e) => setForm({ ...form, min_notice_hours: Number(e.target.value) })} />
        </label>
        <label>Reservas hasta (días)
          <input type="number" min={1} max={180} value={form.max_days_ahead} onChange={(e) => setForm({ ...form, max_days_ahead: Number(e.target.value) })} />
        </label>
      </div>
      <div className="actions">
        {msg && <span className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</span>}
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

function WeeklyHours() {
  // null = cargando. Una entrada por franja; weekday 0 = domingo.
  const [rules, setRules] = useState<AvailabilityRule[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useSaved()

  useEffect(() => {
    listRules()
      .then((r) => setRules(r.length > 0 ? r : [1, 2, 3, 4, 5].flatMap((weekday) => DEFAULT_RANGES.map(([start_time, end_time]) => ({ weekday, start_time, end_time })))))
      .catch(() => setMsg({ ok: false, text: 'No se pudieron cargar los horarios.' }))
  }, [setMsg])

  if (!rules) return <div className="card"><p className="muted">Cargando horarios…</p></div>

  const change = (i: number, patch: Partial<AvailabilityRule>) =>
    setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function save() {
    if (!rules) return
    for (const wd of WEEK_ORDER) {
      const problem = validateDay(rules.filter((r) => r.weekday === wd))
      if (problem) return setMsg({ ok: false, text: `${WEEKDAYS_LONG[wd]}: ${problem}` })
    }
    setBusy(true)
    setMsg(null)
    try {
      await replaceRules(rules)
      setMsg({ ok: true, text: 'Horarios guardados.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudieron guardar los horarios.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 className="card-title">Horarios de atención</h3>
      <p className="muted small">Los pacientes solo pueden reservar dentro de estas franjas (hora de Argentina).</p>
      <div className="weekly">
        {WEEK_ORDER.map((wd) => {
          const idx = rules.flatMap((r, i) => (r.weekday === wd ? [i] : []))
          return (
            <div key={wd} className="weekly-row">
              <span className="weekly-day">{WEEKDAYS_LONG[wd]}</span>
              <div className="weekly-ranges">
                {idx.length === 0 && <span className="muted">No atiende</span>}
                {idx.map((i) => (
                  <div key={i} className="range">
                    <input type="time" aria-label={`${WEEKDAYS_LONG[wd]}: desde`} value={rules[i].start_time} onChange={(e) => change(i, { start_time: e.target.value })} />
                    <span>a</span>
                    <input type="time" aria-label={`${WEEKDAYS_LONG[wd]}: hasta`} value={rules[i].end_time} onChange={(e) => change(i, { end_time: e.target.value })} />
                    <button type="button" className="icon-btn" aria-label="Quitar franja" onClick={() => setRules(rules.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className="btn small" onClick={() => setRules([...rules, { weekday: wd, start_time: '09:00', end_time: '13:00' }])}>
                  ＋ Franja
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="actions">
        {msg && <span className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</span>}
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar horarios'}</button>
      </div>
    </div>
  )
}

function TimeOffList({ tz }: { tz: string }) {
  const [items, setItems] = useState<TimeOff[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useSaved()

  useEffect(() => {
    listTimeOff().then(setItems).catch(() => setMsg({ ok: false, text: 'No se pudieron cargar los bloqueos.' }))
  }, [setMsg])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    try {
      const item = await addTimeOff({ starts_on: from, ends_on: to || from, reason: reason.trim() || null })
      setItems((prev) => [...prev, item].sort((a, b) => a.starts_on.localeCompare(b.starts_on)))
      setFrom(''); setTo(''); setReason('')
    } catch {
      setMsg({ ok: false, text: 'No se pudo agregar. Revisá las fechas.' })
    }
  }

  const range = (t: TimeOff) =>
    t.starts_on === t.ends_on
      ? formatDay(t.starts_on, { day: 'numeric', month: 'long', year: 'numeric' })
      : `${formatDay(t.starts_on, { day: 'numeric', month: 'short' })} – ${formatDay(t.ends_on, { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="card">
      <h3 className="card-title">Días bloqueados</h3>
      <p className="muted small">Vacaciones, feriados o cualquier día en que no querés recibir reservas.</p>
      <form className="timeoff-form" onSubmit={add}>
        <label>Desde<input type="date" required min={todayIn(tz)} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" min={from || todayIn(tz)} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="grow">Motivo (opcional)<input maxLength={80} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button className="btn">＋ Bloquear</button>
      </form>
      {msg && <p className={msg.ok ? 'ok-text' : 'error'}>{msg.text}</p>}
      {items.length === 0 ? (
        <p className="muted">No hay días bloqueados.</p>
      ) : (
        <ul className="timeoff-list">
          {items.map((t) => (
            <li key={t.id}>
              <span><strong>{range(t)}</strong>{t.reason ? ` · ${t.reason}` : ''}</span>
              <button className="icon-btn" aria-label="Quitar bloqueo"
                onClick={() => deleteTimeOff(t.id).then(() => setItems((p) => p.filter((x) => x.id !== t.id))).catch(() => setMsg({ ok: false, text: 'No se pudo quitar.' }))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
