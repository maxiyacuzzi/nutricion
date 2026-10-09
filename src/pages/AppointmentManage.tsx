import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { bookingErrorMessage, cancelAppointment, getAppointment } from '../lib/bookingApi'
import { appointmentLabel } from '../lib/time'
import { ThemeToggle } from '../components/ThemeToggle'
import type { AppointmentInfo } from '../types'

const STATUS_LABEL: Record<AppointmentInfo['status'], string> = {
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Realizado',
  no_show: 'No asististe',
}

/** Página pública: el paciente ve su turno con el link secreto y puede cancelarlo. */
export function AppointmentManage() {
  const { token = '' } = useParams<{ token: string }>()
  // undefined = cargando, null = el link no corresponde a ningún turno.
  const [info, setInfo] = useState<AppointmentInfo | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAppointment(token)
      .then((i) => !cancelled && setInfo(i))
      // Un token con formato inválido hace fallar la consulta: se trata igual que "no existe".
      .catch(() => !cancelled && setInfo(null))
    return () => { cancelled = true }
  }, [token])

  async function cancel() {
    if (!window.confirm('¿Cancelar este turno? Esta acción no se puede deshacer.')) return
    setBusy(true)
    setError(null)
    try {
      await cancelAppointment(token)
      setInfo((i) => (i ? { ...i, status: 'cancelled' } : i))
    } catch (e) {
      setError(bookingErrorMessage(e instanceof Error ? e.message : ''))
    } finally {
      setBusy(false)
    }
  }

  const upcoming = info ? info.status === 'confirmed' && new Date(info.starts_at) > new Date() : false

  return (
    <main className="booking">
      <div className="corner"><ThemeToggle /></div>
      {info === undefined ? (
        <p className="muted">Cargando…</p>
      ) : info === null ? (
        <div className="card booking-card">
          <h1>Turno no encontrado</h1>
          <p className="muted">Este link no corresponde a ningún turno. Revisá que esté completo.</p>
        </div>
      ) : (
        <div className="card booking-card">
          <span className={`tag ${info.status === 'confirmed' ? 'ok' : ''}`}>{STATUS_LABEL[info.status]}</span>
          <h1>Tu turno</h1>
          <p>
            Con <strong>{info.professional_name}</strong>
            <br />
            <strong>{appointmentLabel(info.starts_at, info.ends_at, info.timezone)}</strong>
          </p>
          <p className="muted small">A nombre de {info.patient_name}</p>
          {error && <p className="error" role="alert">{error}</p>}
          {upcoming && (
            <button className="btn danger" onClick={cancel} disabled={busy}>
              {busy ? 'Cancelando…' : 'Cancelar turno'}
            </button>
          )}
        </div>
      )}
    </main>
  )
}
