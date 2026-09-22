import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createProfessional, getMyProfessional, listAppointments, setAppointmentStatus } from '../lib/agendaApi'
import { addDays, formatDay, localDate, mondayOf, todayIn } from '../lib/time'
import { AvailabilityEditor } from '../components/AvailabilityEditor'
import { NewAppointmentModal } from '../components/NewAppointmentModal'
import { WeekBoard } from '../components/WeekBoard'
import type { GoogleFlash } from '../components/GoogleCalendarCard'
import type { Appointment, AppointmentStatus, Professional } from '../types'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** Primera vez: crear el perfil de agenda (nombre visible + link de reserva). */
function Setup({ onCreated }: { onCreated: (p: Professional) => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await createProfessional({ display_name: name.trim(), slug }))
    } catch (err) {
      setError(err instanceof Error && err.message === 'slug_taken' ? 'Ese link ya está en uso. Probá con otro.' : 'No se pudo crear la agenda.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <form className="card setup" onSubmit={submit}>
        <span className="tag">Turnos</span>
        <h2>Configurá tu agenda</h2>
        <p className="muted">
          Vas a tener un link para compartir con tus pacientes. Ellos eligen un día y horario entre los que vos habilites, sin crear cuenta.
        </p>
        <label>Tu nombre o el de tu consultorio
          <input required minLength={2} maxLength={100} placeholder="Ej: Lic. María Gómez" value={name}
            onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)) }} />
        </label>
        <label>Link de reserva
          <input required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]{2,39}" title="Minúsculas, números y guiones (3 a 40 caracteres)"
            placeholder="maria-gomez" value={slug} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()) }} />
          <small className="muted">{window.location.origin}/reservar/{slug || '…'}</small>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Creando…' : 'Crear agenda'}</button>
      </form>
    </div>
  )
}

function Agenda({ professional }: { professional: Professional }) {
  const tz = professional.timezone
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIn(tz)))
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Fecha con la que se abre el formulario de turno manual; null = cerrado.
  const [adding, setAdding] = useState<string | null>(null)
  const link = `${window.location.origin}/reservar/${professional.slug}`

  const load = useCallback(async (start: string) => {
    // Rango ampliado un día a cada lado: el filtro fino por fecha local lo hace el tablero.
    const from = new Date(`${addDays(start, -1)}T00:00:00Z`).toISOString()
    const to = new Date(`${addDays(start, 8)}T00:00:00Z`).toISOString()
    setItems(await listAppointments(from, to))
  }, [])

  useEffect(() => {
    load(weekStart).catch(() => setError('No se pudieron cargar los turnos.'))
  }, [weekStart, load])

  async function onStatus(id: string, status: AppointmentStatus) {
    try {
      await setAppointmentStatus(id, status)
      await load(weekStart)
    } catch {
      setError('No se pudo actualizar el turno.')
    }
  }

  const weekEnd = addDays(weekStart, 6)
  const inWeek = (items ?? []).filter((a) => {
    const d = localDate(a.starts_at, tz)
    return d >= weekStart && d <= weekEnd
  })
  const label = `${formatDay(weekStart, { day: 'numeric', month: 'short' })} – ${formatDay(weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <>
      <div className="agenda-head">
        <div className="weeknav">
          <button className="btn small" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior">←</button>
          <strong>{label}</strong>
          <button className="btn small" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente">→</button>
          <button className="btn small" onClick={() => setWeekStart(mondayOf(todayIn(tz)))}>Hoy</button>
        </div>
        <div className="linkbox">
          <button className="btn primary small" onClick={() => setAdding(todayIn(tz))}>＋ Nuevo turno</button>
          <code>{link}</code>
          <button
            className="btn small"
            onClick={() => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
          >
            {copied ? '¡Copiado!' : 'Copiar link'}
          </button>
        </div>
      </div>
      {!professional.booking_enabled && (
        <p className="notice">Las reservas online están desactivadas: los pacientes no pueden sacar turnos hasta que las actives en Disponibilidad.</p>
      )}
      {error && <p className="error">{error}</p>}
      {items === null ? <p className="muted">Cargando…</p> : <WeekBoard weekStart={weekStart} appointments={inWeek} tz={tz} onStatus={onStatus} onAdd={setAdding} />}
      {adding && (
        <NewAppointmentModal
          professional={professional}
          defaultDate={adding}
          onClose={() => setAdding(null)}
          onCreated={(a) => {
            setAdding(null)
            // Ir a la semana del turno recién cargado; si ya es esta, sólo recargar.
            const wk = mondayOf(localDate(a.starts_at, tz))
            if (wk === weekStart) load(weekStart).catch(() => setError('No se pudieron cargar los turnos.'))
            else setWeekStart(wk)
          }}
        />
      )}
    </>
  )
}

export function Appointments() {
  // undefined = cargando, null = todavía sin agenda.
  const [pro, setPro] = useState<Professional | null | undefined>(undefined)
  const [params, setParams] = useSearchParams()
  // Al volver del consentimiento de Google llega ?google=connected|error: se muestra el resultado en Disponibilidad.
  const [flash] = useState<GoogleFlash | null>(() => {
    const g = params.get('google')
    return g === 'connected' || g === 'error' ? { result: g, reason: params.get('reason') } : null
  })
  const [tab, setTab] = useState<'agenda' | 'availability'>(flash ? 'availability' : 'agenda')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.get('google')) setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    getMyProfessional().then(setPro).catch(() => setError('No se pudo cargar la agenda.'))
  }, [])

  if (error) return <div className="page"><p className="error">{error}</p></div>
  if (pro === undefined) return <div className="page"><p className="muted">Cargando…</p></div>
  if (pro === null) return <Setup onCreated={setPro} />

  return (
    <div className="page wide">
      <div className="grid-head">
        <div>
          <h2>Turnos</h2>
          <small className="muted">{pro.display_name}</small>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'agenda'} className={tab === 'agenda' ? 'on' : ''} onClick={() => setTab('agenda')}>Agenda</button>
        <button role="tab" aria-selected={tab === 'availability'} className={tab === 'availability' ? 'on' : ''} onClick={() => setTab('availability')}>Disponibilidad</button>
      </div>
      {tab === 'agenda' ? <Agenda professional={pro} /> : <AvailabilityEditor professional={pro} onProfessional={setPro} flash={flash} />}
    </div>
  )
}
