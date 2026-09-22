import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Appointment, AppointmentStatus } from '../types'
import { addDays, formatDay, localDate, localTime, longDay, todayIn } from '../lib/time'
import { firstName, whatsappLink } from '../lib/whatsapp'

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Asistió',
  no_show: 'No vino',
}

interface Props {
  /** Lunes de la semana a mostrar ("YYYY-MM-DD"). */
  weekStart: string
  appointments: Appointment[]
  tz: string
  onStatus: (id: string, status: AppointmentStatus) => void
  /** Si se pasa, cada día muestra un ＋ para cargar un turno manual en esa fecha. */
  onAdd?: (date: string) => void
}

function Card({ a, tz, isPast, onStatus }: { a: Appointment; tz: string; isPast: boolean; onStatus: Props['onStatus'] }) {
  const cancelled = a.status === 'cancelled'
  return (
    <li className={`appt ${a.status}`}>
      <div className="appt-time">
        {localTime(a.starts_at, tz)}–{localTime(a.ends_at, tz)}
        <span className={`status ${a.status}`}>{STATUS_LABEL[a.status]}</span>
      </div>
      <div className="appt-name">
        {a.patient_id ? <Link to={`/pacientes/${a.patient_id}`}>{a.patient_name}</Link> : a.patient_name}
        {!a.patient_id && !cancelled && <span className="tag" title="El DNI no corresponde a un paciente registrado">Nuevo</span>}
      </div>
      <small className="muted">
        DNI {a.patient_dni}
        {a.patient_phone ? ` · ${a.patient_phone}` : ''}
      </small>
      {a.patient_email && <small className="muted">{a.patient_email}</small>}
      {a.status === 'confirmed' && (
        <div className="appt-actions">
          {isPast && <button className="btn small" onClick={() => onStatus(a.id, 'completed')}>Asistió</button>}
          {isPast && <button className="btn small" onClick={() => onStatus(a.id, 'no_show')}>No vino</button>}
          {!isPast && a.patient_phone && (
            <a
              className="btn small" target="_blank" rel="noreferrer"
              href={whatsappLink(a.patient_phone, `Hola ${firstName(a.patient_name)}! Te escribo para recordarte tu turno del ${longDay(localDate(a.starts_at, tz))} a las ${localTime(a.starts_at, tz)}.`)}
            >
              💬 Recordar
            </a>
          )}
          {!isPast && (
            <button
              className="btn small danger"
              onClick={() => window.confirm(`¿Cancelar el turno de ${a.patient_name}?`) && onStatus(a.id, 'cancelled')}
            >
              Cancelar
            </button>
          )}
        </div>
      )}
      {cancelled && a.cancelled_by && (
        <small className="muted">Cancelado por {a.cancelled_by === 'patient' ? 'el paciente' : 'vos'}</small>
      )}
    </li>
  )
}

/** Semana de lunes a domingo con los turnos de cada día. */
export function WeekBoard({ weekStart, appointments, tz, onStatus, onAdd }: Props) {
  const today = todayIn(tz)
  const [now] = useState(() => Date.now())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const byDay = new Map<string, Appointment[]>()
  for (const a of appointments) {
    const d = localDate(a.starts_at, tz)
    byDay.set(d, [...(byDay.get(d) ?? []), a])
  }

  return (
    <div className="weekboard">
      {days.map((d) => {
        const list = byDay.get(d) ?? []
        const active = list.filter((a) => a.status !== 'cancelled').length
        return (
          <section key={d} className={d === today ? 'wday today' : 'wday'}>
            <header>
              <small>{formatDay(d, { weekday: 'short' })}</small>
              <strong>{formatDay(d, { day: 'numeric' })}</strong>
              <small className="muted">{active > 0 ? `${active} ${active === 1 ? 'turno' : 'turnos'}` : ''}</small>
              {onAdd && (
                <button type="button" className="icon-btn add" aria-label={`Agregar turno el ${formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}`} onClick={() => onAdd(d)}>＋</button>
              )}
            </header>
            {list.length === 0 ? (
              <p className="wday-empty">—</p>
            ) : (
              <ul>
                {list.map((a) => (
                  <Card key={a.id} a={a} tz={tz} isPast={new Date(a.ends_at).getTime() < now} onStatus={onStatus} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
