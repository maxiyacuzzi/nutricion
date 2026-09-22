import { useEffect, useState } from 'react'
import { createPayment } from '../lib/paymentsApi'
import { listPatientSummaries } from '../lib/api'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '../types'
import type { Payment, PatientSummary, PaymentMethod } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  /** Si se pasa, el paciente queda fijo (se usa desde la ficha del paciente); si no, hay que elegirlo. */
  patient?: { id: string; full_name: string }
  onClose: () => void
  onCreated: (p: Payment) => void
}

export function NewPaymentModal({ patient, onClose, onCreated }: Props) {
  const [patients, setPatients] = useState<PatientSummary[] | null>(null)
  const [patientId, setPatientId] = useState(patient?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [concept, setConcept] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patient) listPatientSummaries().then(setPatients).catch(() => setPatients([]))
  }, [patient])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(amount.replace(',', '.'))
    if (!patientId) return setError('Elegí un paciente.')
    if (!Number.isFinite(value) || value <= 0) return setError('El monto tiene que ser mayor a 0.')

    setBusy(true)
    try {
      const saved = await createPayment({
        patient_id: patientId, amount: value, method, concept: concept.trim() || null, paid_on: paidOn, notes: notes.trim() || null,
      })
      onCreated(saved)
    } catch {
      setError('No se pudo guardar el pago.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal narrow form" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Nuevo pago">
        <h2>Nuevo pago</h2>

        {patient ? (
          <p className="muted small">Paciente: <strong>{patient.full_name}</strong></p>
        ) : (
          <label>Paciente
            <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="" disabled>{patients === null ? 'Cargando…' : '— Elegir —'}</option>
              {patients?.map((p) => <option key={p.id} value={p.id}>{p.full_name} (DNI {p.dni})</option>)}
            </select>
          </label>
        )}

        <div className="grid g3">
          <label>Monto (ARS) *
            <input required inputMode="decimal" placeholder="Ej: 15000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>Método *
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
            </select>
          </label>
          <label>Fecha
            <input type="date" required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
        </div>

        <label>Concepto (opcional)
          <input placeholder="Ej: Consulta, plan alimentario, pack de 4 sesiones…" value={concept} onChange={(e) => setConcept(e.target.value)} />
        </label>
        <label>Notas (opcional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar pago'}</button>
        </div>
      </form>
    </div>
  )
}
