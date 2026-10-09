import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getMyProfessional, listAppointments } from '../lib/agendaApi'
import { listPayments } from '../lib/paymentsApi'
import { countNewPatients, countPatients } from '../lib/reportsApi'
import { addDays, addMonths, appointmentLabel, longMonth, monthStart, todayIn, zonedToIso } from '../lib/time'
import { formatMoney } from '../lib/money'
import type { Appointment, AppointmentStatus, Professional } from '../types'

const AR_TZ = 'America/Argentina/Buenos_Aires'
const UPCOMING_DAYS = 60
const UPCOMING_MAX = 6

interface MonthStats {
  patientsTotal: number
  patientsNew: number
  appointments: Record<AppointmentStatus, number>
  income: number
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

export function Reports() {
  const [month, setMonth] = useState(() => monthStart(todayIn(AR_TZ)))
  const [stats, setStats] = useState<MonthStats | null>(null)
  const [upcoming, setUpcoming] = useState<Appointment[] | null>(null)
  const [professional, setProfessional] = useState<Professional | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (m: string) => {
    const fromIso = zonedToIso(m, '00:00', AR_TZ)
    const toIso = zonedToIso(addMonths(m, 1), '00:00', AR_TZ)
    try {
      const [patientsTotal, patientsNew, appts, payments] = await Promise.all([
        countPatients(),
        countNewPatients(fromIso, toIso),
        listAppointments(fromIso, toIso),
        listPayments(m, addMonths(m, 1)),
      ])
      const appointments: Record<AppointmentStatus, number> = { confirmed: 0, cancelled: 0, completed: 0, no_show: 0 }
      for (const a of appts) appointments[a.status]++
      setStats({ patientsTotal, patientsNew, appointments, income: payments.reduce((sum, p) => sum + p.amount, 0) })
    } catch {
      setError('No se pudieron cargar los datos del mes.')
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  useEffect(() => {
    getMyProfessional().then(setProfessional).catch(() => setProfessional(null))
    const now = new Date().toISOString()
    const until = addDays(now.slice(0, 10), UPCOMING_DAYS)
    listAppointments(now, `${until}T23:59:59.999Z`)
      .then((appts) => setUpcoming(appts.filter((a) => a.status === 'confirmed').sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, UPCOMING_MAX)))
      .catch(() => setError('No se pudieron cargar los próximos turnos.'))
  }, [])

  const a = stats?.appointments

  return (
    <div className="page wide">
      <div className="grid-head">
        <div><h2>Reportes</h2><small className="muted">Panorama general del consultorio</small></div>
      </div>

      <div className="agenda-head">
        <div className="weeknav">
          <button className="btn small" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">←</button>
          <strong>{longMonth(month)}</strong>
          <button className="btn small" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">→</button>
          <button className="btn small" onClick={() => setMonth(monthStart(todayIn(AR_TZ)))}>Hoy</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {professional === null && (
        <p className="notice">
          Todavía no configuraste tu agenda de turnos, así que esos datos van a estar en cero.{' '}
          <Link to="/turnos">Configurarla</Link>.
        </p>
      )}

      {!stats ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="stats-grid">
          <Stat label="Pacientes totales" value={String(stats.patientsTotal)} />
          <Stat label="Pacientes nuevos" value={String(stats.patientsNew)} tone={stats.patientsNew > 0 ? 'good' : undefined} />
          <Stat label="Turnos confirmados" value={String(a?.confirmed ?? 0)} />
          <Stat label="Turnos asistidos" value={String(a?.completed ?? 0)} tone="good" />
          <Stat label="Turnos no asistidos" value={String(a?.no_show ?? 0)} tone={a && a.no_show > 0 ? 'bad' : undefined} />
          <Stat label="Turnos cancelados" value={String(a?.cancelled ?? 0)} tone={a && a.cancelled > 0 ? 'bad' : undefined} />
          <Stat label="Ingresos del mes" value={formatMoney(stats.income)} tone="good" />
        </div>
      )}

      <section className="segmental" style={{ marginTop: 16 }}>
        <h3>Próximos turnos</h3>
        {upcoming === null ? (
          <p className="muted">Cargando…</p>
        ) : upcoming.length === 0 ? (
          <p className="muted">No hay turnos confirmados en los próximos {UPCOMING_DAYS} días.</p>
        ) : (
          <ul className="note-list">
            {upcoming.map((appt) => (
              <li className="note" key={appt.id}>
                <div className="note-head">
                  <small className="muted">{appointmentLabel(appt.starts_at, appt.ends_at, AR_TZ)}</small>
                </div>
                <p className="note-body">
                  {appt.patient_id ? <Link to={`/pacientes/${appt.patient_id}`}>{appt.patient_name}</Link> : appt.patient_name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
