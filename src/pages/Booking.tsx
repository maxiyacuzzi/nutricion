import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { book, bookingErrorMessage, getPublicProfessional, listSlots } from '../lib/bookingApi'
import { refreshBusy } from '../lib/googleApi'
import { addDays, appointmentLabel, todayIn } from '../lib/time'
import { SlotPicker } from '../components/SlotPicker'
import { ThemeToggle } from '../components/ThemeToggle'
import type { BookingResult, PublicProfessional, Slot } from '../types'

/** Página pública (sin login) donde el paciente reserva un turno con el profesional dueño del link. */
export function Booking() {
  const { slug = '' } = useParams<{ slug: string }>()
  // undefined = cargando, null = no existe / reservas desactivadas.
  const [pro, setPro] = useState<PublicProfessional | null | undefined>(undefined)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [dni, setDni] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<BookingResult | null>(null)

  async function loadSlots(p: PublicProfessional) {
    await refreshBusy(slug)
    const today = todayIn(p.timezone)
    setSlots(await listSlots(slug, today, addDays(today, p.max_days_ahead)))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = await getPublicProfessional(slug)
        if (cancelled) return
        setPro(p)
        if (p) {
          await refreshBusy(slug) // trae los horarios ocupados de Google Calendar (si está conectado)
          const today = todayIn(p.timezone)
          const s = await listSlots(slug, today, addDays(today, p.max_days_ahead))
          if (!cancelled) setSlots(s)
        }
      } catch (e) {
        if (!cancelled) setError(bookingErrorMessage(e instanceof Error ? e.message : ''))
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pro || !selected) return
    setBusy(true)
    setError(null)
    try {
      setDone(await book({ slug, startsAt: selected, dni, name, email, phone }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(bookingErrorMessage(msg))
      if (msg === 'slot_unavailable') {
        // Otro paciente tomó el horario: refrescar la lista y pedir que elija de nuevo.
        setSelected(null)
        await loadSlots(pro).catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="booking">
      <div className="corner"><ThemeToggle /></div>
      {children}
    </main>
  )

  if (pro === undefined && !error) return shell(<p className="muted">Cargando…</p>)
  if (pro === null || (pro === undefined && error)) {
    return shell(
      <div className="card booking-card">
        <h1>Agenda no disponible</h1>
        <p className="muted">{error ?? 'Este link de reserva no existe o las reservas están desactivadas.'}</p>
      </div>,
    )
  }
  if (!pro) return null

  if (done) {
    const manage = `${window.location.origin}/turno/${done.cancel_token}`
    return shell(
      <div className="card booking-card">
        <span className="tag ok">Turno confirmado</span>
        <h1>¡Listo, {name.split(' ')[0]}!</h1>
        <p>
          Tu turno con <strong>{done.professional_name}</strong> es el{' '}
          <strong>{appointmentLabel(done.starts_at, done.ends_at, done.timezone)}</strong>.
        </p>
        {pro.calendar_invite && email.trim() && (
          <p className="muted small">
            En unos minutos te llega una invitación a <strong>{email.trim()}</strong> con el turno para agregar a tu calendario.
          </p>
        )}
        <div className="manage">
          <p className="muted small">
            Guardá este link: es la única forma de ver o cancelar tu turno. No lo compartas con otras personas.
          </p>
          <input readOnly value={manage} onFocus={(e) => e.currentTarget.select()} aria-label="Link de tu turno" />
          <Link to={`/turno/${done.cancel_token}`} className="btn">Ver o cancelar mi turno</Link>
        </div>
      </div>,
    )
  }

  return shell(
    <form className="card booking-card" onSubmit={submit}>
      <div>
        <span className="tag">Reservar turno</span>
        <h1>{pro.display_name}</h1>
        <p className="muted small">
          Turnos de {pro.slot_minutes} minutos. Los horarios se muestran en hora de Argentina.
        </p>
      </div>

      <SlotPicker slots={slots} tz={pro.timezone} selected={selected} onSelect={setSelected} />

      {selected && (
        <>
          <h3 className="step-title">Tus datos</h3>
          <p className="muted small">
            Turno elegido: <strong>{appointmentLabel(selected, new Date(new Date(selected).getTime() + pro.slot_minutes * 60000).toISOString(), pro.timezone)}</strong>
          </p>
          <div className="grid g2">
            <label>DNI *
              <input required inputMode="numeric" autoComplete="off" placeholder="Ej: 37511185" value={dni} onChange={(e) => setDni(e.target.value)} />
            </label>
            <label>Nombre completo *
              <input required autoComplete="name" placeholder="Ej: Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>Teléfono
              <input type="tel" autoComplete="tel" placeholder="Ej: 11 5555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>Email
              <input type="email" autoComplete="email" placeholder="ej@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          {pro.calendar_invite && (
            <p className="muted small">Si dejás tu email, te va a llegar una invitación con el turno a tu calendario.</p>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Reservando…' : 'Confirmar turno'}</button>
        </>
      )}
      {!selected && error && <p className="error" role="alert">{error}</p>}
    </form>,
  )
}
