import { useEffect, useState } from 'react'
import { deletePayment, listPatientPayments } from '../lib/paymentsApi'
import { formatMoney } from '../lib/money'
import { NewPaymentModal } from './NewPaymentModal'
import { PAYMENT_METHOD_LABEL } from '../types'
import type { Payment } from '../types'

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { dateStyle: 'medium' })

export function PatientPayments({ patient }: { patient: { id: string; full_name: string } }) {
  const [items, setItems] = useState<Payment[] | null>(null)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPatientPayments(patient.id).then(setItems).catch(() => setError('No se pudieron cargar los pagos.'))
  }, [patient.id])

  async function remove(id: string) {
    if (!window.confirm('¿Borrar este pago? No se puede deshacer.')) return
    try {
      await deletePayment(id)
      setItems((prev) => (prev ?? []).filter((p) => p.id !== id))
    } catch {
      setError('No se pudo borrar el pago.')
    }
  }

  const total = (items ?? []).reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="notes">
      <div className="grid-head">
        <div>
          <strong>{formatMoney(total)}</strong> <span className="muted small">cobrado en total</span>
        </div>
        <button className="btn primary" onClick={() => setModal(true)}>＋ Nuevo pago</button>
      </div>

      {error && <p className="error">{error}</p>}

      {items === null ? (
        <p className="muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="muted">Todavía no hay pagos registrados para este paciente.</p>
      ) : (
        <ul className="note-list">
          {items.map((p) => (
            <li key={p.id} className="note">
              <div className="note-head">
                <small className="muted">{fmtDate(p.paid_on)} · {PAYMENT_METHOD_LABEL[p.method]}</small>
                <button className="icon-btn" aria-label="Borrar pago" onClick={() => remove(p.id)}>🗑</button>
              </div>
              <p className="note-body"><strong>{formatMoney(p.amount)}</strong>{p.concept ? ` — ${p.concept}` : ''}</p>
              {p.notes && <p className="muted small">{p.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <NewPaymentModal
          patient={patient}
          onClose={() => setModal(false)}
          onCreated={(p) => { setItems((prev) => [p, ...(prev ?? [])].sort((a, b) => b.paid_on.localeCompare(a.paid_on))); setModal(false) }}
        />
      )}
    </div>
  )
}
