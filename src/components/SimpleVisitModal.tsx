import { useState } from 'react'
import type { SimpleVisitInput } from '../lib/api'
import type { Visit } from '../types'

interface Props {
  /** Si se pasa, edita esa visita en vez de crear una nueva. */
  initial?: Visit
  onClose: () => void
  onSave: (input: SimpleVisitInput) => Promise<void>
}

const numField = (v: number | null | undefined) => (v !== null && v !== undefined ? String(v) : '')

/** Visita liviana: lo que se toma en cualquier consulta (peso, cintura umbilical y cintura alta) y una nota.
 *  La talla no va acá: se registra al dar de alta al paciente, no se vuelve a tomar en cada visita. */
export function SimpleVisitModal({ initial, onClose, onSave }: Props) {
  const [weight, setWeight] = useState(numField(initial?.weight_kg))
  const [waistUmbilical, setWaistUmbilical] = useState(numField(initial?.waist_umbilical_cm))
  const [waistHigh, setWaistHigh] = useState(numField(initial?.waist_high_cm))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function num(raw: string, label: string): number | null {
    const text = raw.trim().replace(',', '.')
    if (text === '') return null
    const n = Number(text)
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} no es válido.`)
    return n
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    let input: SimpleVisitInput
    try {
      input = {
        weight_kg: num(weight, 'El peso'),
        waist_umbilical_cm: num(waistUmbilical, 'La cintura umbilical'),
        waist_high_cm: num(waistHigh, 'La cintura alta'),
        notes: notes.trim() || null,
      }
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Dato inválido.')
    }

    setBusy(true)
    try {
      await onSave(input)
    } catch {
      setError('No se pudo guardar.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal narrow form" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Visita">
        <h2>{initial ? 'Editar visita' : 'Nueva visita'}</h2>
        <p className="muted small">Lo que se toma en cualquier consulta. Si hoy corresponde, después podés sumarle la medición detallada.</p>
        <div className="grid g2">
          <label>Peso (kg)
            <input inputMode="decimal" placeholder="Ej: 80.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label>Cintura umbilical (cm)
            <input inputMode="decimal" placeholder="Ej: 92.5" value={waistUmbilical} onChange={(e) => setWaistUmbilical(e.target.value)} />
          </label>
          <label>Cintura alta (cm)
            <input inputMode="decimal" placeholder="Ej: 88" value={waistHigh} onChange={(e) => setWaistHigh(e.target.value)} />
          </label>
        </div>
        <label>Notas
          <textarea rows={3} placeholder="Ej: buena adherencia al plan, refiere menos hambre…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar visita'}</button>
        </div>
      </form>
    </div>
  )
}
