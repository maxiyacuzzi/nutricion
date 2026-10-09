import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { deletePayment, listPayments } from '../lib/paymentsApi'
import { addMonths, longMonth, monthStart, todayIn } from '../lib/time'
import { formatMoney } from '../lib/money'
import { NewPaymentModal } from '../components/NewPaymentModal'
import { PAYMENT_METHOD_LABEL } from '../types'
import type { PaymentWithPatient } from '../types'

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

export function Payments() {
  const [month, setMonth] = useState(() => monthStart(todayIn('America/Argentina/Buenos_Aires')))
  const [items, setItems] = useState<PaymentWithPatient[] | null>(null)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((m: string) => {
    listPayments(m, addMonths(m, 1)).then(setItems).catch(() => setError('No se pudieron cargar los pagos.'))
  }, [])

  useEffect(() => { load(month) }, [month, load])

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
  const byMethod = new Map<string, number>()
  for (const p of items ?? []) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)

  return (
    <div className="page wide">
      <div className="grid-head">
        <div>
          <h2>Pagos</h2>
          {items && <small className="muted">{items.length} {items.length === 1 ? 'pago' : 'pagos'} este mes</small>}
        </div>
        <button className="btn primary" onClick={() => setModal(true)}>＋ Nuevo pago</button>
      </div>

      <div className="agenda-head">
        <div className="weeknav">
          <button className="btn small" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">←</button>
          <strong>{longMonth(month)}</strong>
          <button className="btn small" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">→</button>
          <button className="btn small" onClick={() => setMonth(monthStart(todayIn('America/Argentina/Buenos_Aires')))}>Hoy</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="cmp-kpis">
        <div className="kpi">
          <small>Total del mes</small>
          <strong>{formatMoney(total)}</strong>
        </div>
        {[...byMethod.entries()].map(([method, amount]) => (
          <div className="kpi" key={method}>
            <small>{PAYMENT_METHOD_LABEL[method as keyof typeof PAYMENT_METHOD_LABEL]}</small>
            <strong>{formatMoney(amount)}</strong>
          </div>
        ))}
      </div>

      {items === null ? (
        <p className="muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="muted">Sin pagos registrados en {longMonth(month)}.</p>
      ) : (
        <div className="cmp-table-wrap">
          <table className="cmp-table payments-table">
            <thead>
              <tr><th>Fecha</th><th>Paciente</th><th>Concepto</th><th>Método</th><th>Monto</th><th /></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.paid_on)}</td>
                  <td className="pay-patient"><Link to={`/pacientes/${p.patient_id}`}>{p.patient_name}</Link></td>
                  <td>{p.concept ?? '—'}</td>
                  <td>{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td>{formatMoney(p.amount)}</td>
                  <td><button className="icon-btn" aria-label="Borrar pago" onClick={() => remove(p.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <NewPaymentModal
          onClose={() => setModal(false)}
          onCreated={(p) => {
            setModal(false)
            if (p.paid_on >= month && p.paid_on < addMonths(month, 1)) load(month)
            else setMonth(monthStart(p.paid_on))
          }}
        />
      )}
    </div>
  )
}
