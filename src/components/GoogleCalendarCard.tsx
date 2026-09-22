import { useEffect, useState } from 'react'
import {
  disconnectGoogle, getGoogleStatus, GOOGLE_ERRORS, resyncGoogle, setBlockBusy, startGoogleConnect, type GoogleStatus,
} from '../lib/googleApi'

export interface GoogleFlash {
  result: 'connected' | 'error'
  reason: string | null
}

/** Conexión con Google Calendar: los turnos se copian al calendario y los horarios ocupados se dejan de ofrecer. */
export function GoogleCalendarCard({ flash }: { flash: GoogleFlash | null }) {
  // undefined = cargando.
  const [status, setStatus] = useState<GoogleStatus | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    flash?.result === 'connected'
      ? { ok: true, text: 'Google Calendar conectado. Tus turnos próximos ya se están enviando al calendario.' }
      : flash
        ? { ok: false, text: GOOGLE_ERRORS[flash.reason ?? ''] ?? 'No se pudo conectar con Google.' }
        : null,
  )

  useEffect(() => {
    getGoogleStatus().then(setStatus).catch(() => setMsg({ ok: false, text: 'No se pudo consultar el estado de Google Calendar.' }))
  }, [])

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setMsg(null)
    try {
      await action()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      setMsg({ ok: false, text: code === 'google_not_configured' ? GOOGLE_ERRORS.not_configured : failure })
    } finally {
      setBusy(false)
    }
  }

  const connect = () => run(async () => { window.location.href = await startGoogleConnect() }, 'No se pudo iniciar la conexión con Google.')

  const resync = () =>
    run(async () => {
      const r = await resyncGoogle()
      setMsg({ ok: r.failed === 0, text: `${r.synced} ${r.synced === 1 ? 'turno enviado' : 'turnos enviados'} a Google Calendar${r.failed ? `; ${r.failed} fallaron` : ''}.` })
    }, 'No se pudieron sincronizar los turnos.')

  const disconnect = () =>
    window.confirm('¿Desconectar Google Calendar? Los eventos ya creados quedan en tu calendario, pero dejan de actualizarse.')
      ? run(async () => {
          await disconnectGoogle()
          setStatus({ connected: false })
          setMsg({ ok: true, text: 'Google Calendar desconectado.' })
        }, 'No se pudo desconectar.')
      : undefined

  const toggleBlock = (block: boolean) =>
    run(async () => {
      await setBlockBusy(block)
      setStatus((s) => (s ? { ...s, block_busy: block } : s))
    }, 'No se pudo guardar el cambio.')

  return (
    <div className="card gcal">
      <h3 className="card-title">Google Calendar</h3>

      {status === undefined ? (
        <p className="muted">Cargando…</p>
      ) : status.connected ? (
        <>
          <p>
            <span className="tag ok">Conectado</span> <strong>{status.email}</strong>
          </p>
          <ul className="gcal-list muted small">
            <li>Cada turno nuevo, modificado o cancelado se refleja en tu calendario en segundos.</li>
            <li>Si el paciente dejó su email al reservar, Google le manda la invitación (y el aviso si se cancela).</li>
            <li>Los eventos que creaste en Google no se modifican ni se borran: solo los que crea esta app.</li>
          </ul>
          <label className="check">
            <input
              type="checkbox"
              checked={status.block_busy ?? true}
              disabled={busy}
              onChange={(e) => toggleBlock(e.target.checked)}
            />
            No ofrecer a los pacientes los horarios en que estoy ocupado en Google Calendar
          </label>
          <div className="actions gcal-actions">
            <button className="btn small" onClick={resync} disabled={busy}>Sincronizar turnos ahora</button>
            <button className="btn small danger" onClick={disconnect} disabled={busy}>Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Conectá tu cuenta de Google para que los turnos aparezcan en tu calendario y para que tus pacientes no puedan
            reservar en horarios en los que ya estás ocupado.
          </p>
          <ul className="gcal-list muted small">
            <li>Pedimos un único permiso: ver y editar eventos de tu calendario.</li>
            <li>Podés desconectarlo cuando quieras, desde acá o desde tu cuenta de Google.</li>
          </ul>
          <div className="actions gcal-actions">
            <button className="btn primary" onClick={connect} disabled={busy}>{busy ? 'Redirigiendo…' : 'Conectar Google Calendar'}</button>
          </div>
        </>
      )}

      {msg && <p className={msg.ok ? 'ok-text' : 'error'} role="status">{msg.text}</p>}
    </div>
  )
}
