import { useEffect, useState } from 'react'
import { createAppointment } from '../lib/agendaApi'
import { listPatientSummaries } from '../lib/api'
import { zonedToIso } from '../lib/time'
import type { Appointment, PatientSummary, Professional } from '../types'

const DURATIONS = [15, 20, 30, 45, 60, 90]
const onlyDigits = (s: string) => s.replace(/\D/g, '')

interface Props {
  professional: Professional
  /** Fecha inicial ("YYYY-MM-DD"), p. ej. el día en que se tocó el ＋. */
  defaultDate: string
  onClose: () => void
  onCreated: (a: Appointment) => void
}

/** Carga manual de un turno (p. ej. pedido por teléfono o en persona). */
export function NewAppointmentModal({ professional: pro, defaultDate, onClose, onCreated }: Props) {
  const [patients, setPatients] = useState<PatientSummary[] | null>(null)
  // '' = todavía sin elegir, 'other' = persona no registrada, o el id de un paciente.
  const [choice, setChoice] = useState('')
  const [dni, setDni] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(pro.slot_minutes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPatientSummaries().then(setPatients).catch(() => setPatients([]))
  }, [])

  const registered = patients?.find((p) => p.id === choice) ?? null
  const isOther = choice === 'other'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const finalDni = registered ? onlyDigits(registered.dni) : onlyDigits(dni)
    const finalName = registered ? registered.full_name : name.trim()
    if (!registered && !isOther) return setError('Elegí un paciente o cargá una persona nueva.')
    if (!/^\d{6,10}$/.test(finalDni)) return setError('El DNI debe tener entre 6 y 10 números.')
    if (finalName.length < 2) return setError('Falta el nombre.')

    const startsAt = zonedToIso(date, time, pro.timezone)
    const endsAt = new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString()

    setBusy(true)
    try {
      onCreated(
        await createAppointment({
          patient_id: registered?.id ?? null,
          starts_at: startsAt,
          ends_at: endsAt,
          patient_dni: finalDni,
          patient_name: finalName,
          patient_email: (registered ? registered.email : email.trim()) || null,
          patient_phone: phone.trim() || null,
        }),
      )
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'overlap'
          ? 'Ese horario se superpone con otro turno vigente. Elegí otro horario o cancelá el existente.'
          : 'No se pudo guardar el turno. Revisá los datos.',
      )
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal narrow form" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Nuevo turno">
        <h2>Nuevo turno</h2>

        <label>Paciente
          <select value={choice} onChange={(e) => setChoice(e.target.value)} required>
            <option value="" disabled>{patients === null ? 'Cargando…' : '— Elegir —'}</option>
            {patients?.map((p) => <option key={p.id} value={p.id}>{p.full_name} (DNI {p.dni})</option>)}
            <option value="other">Otra persona (no registrada)</option>
          </select>
        </label>

        {isOther && (
          <div className="grid g2">
            <label>DNI *
              <input required inputMode="numeric" placeholder="Ej: 37511185" value={dni} onChange={(e) => setDni(e.target.value)} />
            </label>
            <label>Nombre completo *
              <input required placeholder="Ej: Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>Email
              <input type="email" placeholder="ej@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>Teléfono
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
        )}
        {registered && (
          <label>Teléfono de contacto (opcional)
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        )}

        <div className="grid g3">
          <label>Fecha
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>Hora
            <input type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>Duración
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">Podés cargar turnos fuera de tus horarios habituales; solo no se pueden superponer con otro turno.</p>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar turno'}</button>
        </div>
      </form>
    </div>
  )
}
