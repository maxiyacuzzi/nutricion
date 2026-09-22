import { useState } from 'react'
import { updatePatient } from '../lib/api'
import { InsuranceFields } from './InsuranceFields'
import type { Patient, Sex } from '../types'

interface Props {
  patient: Patient
  onClose: () => void
  onSaved: (patient: Patient) => void
}

/** Edición de los datos del paciente (no de sus mediciones): identificación, restricciones y obra social. */
export function EditPatientModal({ patient, onClose, onSaved }: Props) {
  const [dni, setDni] = useState(patient.dni)
  const [fullName, setFullName] = useState(patient.full_name)
  const [email, setEmail] = useState(patient.email ?? '')
  const [phone, setPhone] = useState(patient.phone ?? '')
  const [sex, setSex] = useState<Sex>(patient.sex)
  const [birthDate, setBirthDate] = useState(patient.birth_date ?? '')
  const [height, setHeight] = useState(String(patient.height_cm))
  const [restrictions, setRestrictions] = useState(patient.dietary_restrictions ?? '')
  const [insuranceProvider, setInsuranceProvider] = useState(patient.insurance_provider ?? '')
  const [insurancePlan, setInsurancePlan] = useState(patient.insurance_plan ?? '')
  const [insuranceMemberId, setInsuranceMemberId] = useState(patient.insurance_member_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const heightCm = Number(height.replace(',', '.'))
    if (!Number.isFinite(heightCm) || heightCm <= 0) return setError('Altura inválida')
    setBusy(true)
    try {
      const saved = await updatePatient(patient.id, {
        dni: dni.trim(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        sex,
        birth_date: birthDate || null,
        height_cm: heightCm,
        dietary_restrictions: restrictions.trim() || null,
        insurance_provider: insuranceProvider.trim() || null,
        insurance_plan: insurancePlan.trim() || null,
        insurance_member_id: insuranceMemberId.trim() || null,
      })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error && err.message === 'dni_taken' ? 'Ya tenés otro paciente con ese DNI.' : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal form" onClick={(e) => e.stopPropagation()} onSubmit={submit} aria-label="Editar paciente">
        <h2>Editar paciente</h2>

        <fieldset className="card">
          <legend>Identificación</legend>
          <div className="grid g3">
            <label>DNI *
              <input required value={dni} onChange={(e) => setDni(e.target.value)} />
            </label>
            <label>Nombre completo *
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>Teléfono <span className="tag">para WhatsApp</span>
              <input type="tel" placeholder="Ej: +54 9 11 5555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>Sexo *
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </label>
            <label>Fecha de nacimiento
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </label>
            <label>Altura (cm) *
              <input required inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <InsuranceFields
          provider={insuranceProvider} plan={insurancePlan} memberId={insuranceMemberId}
          onProvider={setInsuranceProvider} onPlan={setInsurancePlan} onMemberId={setInsuranceMemberId}
        />

        <fieldset className="card">
          <legend>Restricciones alimenticias</legend>
          <label>Alimentos que no puede consumir
            <input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
          </label>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  )
}
