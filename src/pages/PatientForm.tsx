import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPatient } from '../lib/api'
import { addNote } from '../lib/notesApi'
import { InsuranceFields } from '../components/InsuranceFields'
import { DietaryRoutineFields } from '../components/DietaryRoutineFields'
import { cleanDietaryRoutine, emptyDietaryRoutine } from '../lib/dietaryRoutine'
import type { DietaryRoutine, Sex } from '../types'

export function PatientForm() {
  const navigate = useNavigate()
  const [dni, setDni] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sex, setSex] = useState<Sex>('M')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [insurancePlan, setInsurancePlan] = useState('')
  const [insuranceMemberId, setInsuranceMemberId] = useState('')
  const [reason, setReason] = useState('')
  const [medication, setMedication] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [routine, setRoutine] = useState<DietaryRoutine>(emptyDietaryRoutine)
  const [observations, setObservations] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const text = height.trim().replace(',', '.')
    const heightCm = text === '' ? null : Number(text)
    if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 0)) return setError('Altura inválida')
    setBusy(true)
    try {
      const patient = await createPatient({
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
        reason_for_visit: reason.trim() || null,
        medication: medication.trim() || null,
        dietary_routine: cleanDietaryRoutine(routine),
        observations: observations.trim() || null,
      })
      const intake = [
        reason.trim() && `Motivo de la consulta: ${reason.trim()}`,
        medication.trim() && `Medicación o suplementos: ${medication.trim()}`,
        restrictions.trim() && `Restricciones: ${restrictions.trim()}`,
      ].filter(Boolean)
      if (intake.length > 0) await addNote(patient.id, `Registro del paciente:\n${intake.join('\n')}`)
      navigate(`/pacientes/${patient.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="page form" onSubmit={submit}>
      <h2>📝 Registro de Paciente</h2>
      <p className="muted">
        DNI, Nombre y Sexo son <b>obligatorios</b>. Los demás campos son opcionales. Las mediciones se cargan
        después, desde la ficha del paciente.
      </p>

      <fieldset className="card">
        <legend>Identificación</legend>
        <div className="grid g3">
          <label>DNI *
            <input required placeholder="Ej: 37511185" value={dni} onChange={(e) => setDni(e.target.value)} />
          </label>
          <label>Nombre completo *
            <input required placeholder="Ej: Juan Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>Email
            <input type="email" placeholder="ej@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <label>Fecha de nacimiento <span className="tag">edad auto-calculada</span>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          <label>Altura (cm) <span className="tag">opcional</span>
            <input inputMode="decimal" placeholder="Ej: 175" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <InsuranceFields
        provider={insuranceProvider} plan={insurancePlan} memberId={insuranceMemberId}
        onProvider={setInsuranceProvider} onPlan={setInsurancePlan} onMemberId={setInsuranceMemberId}
      />

      <fieldset className="card">
        <legend>Consulta</legend>
        <div className="grid g2">
          <label>Motivo de la consulta
            <input placeholder="Ej: quiere bajar de peso antes del verano" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label>Medicación o suplementos <span className="tag">opcional</span>
            <input placeholder="Ej: levotiroxina, omega 3…" value={medication} onChange={(e) => setMedication(e.target.value)} />
          </label>
        </div>
        <label>Alergias o intolerancias <span className="tag">opcional</span>
          <input placeholder="Ej: celiaco, intolerante a la lactosa, sin mariscos" value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)} />
          <p className="muted small">Este dato se usa para generar el plan de alimentación personalizado.</p>
        </label>
      </fieldset>

      <DietaryRoutineFields value={routine} onChange={setRoutine} />

      <fieldset className="card">
        <legend>Observaciones</legend>
        <label>Notas generales <span className="tag">opcional</span>
          <textarea rows={3} placeholder="Cualquier otro dato que no entre en los campos de arriba…"
            value={observations} onChange={(e) => setObservations(e.target.value)} />
        </label>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <Link to="/pacientes" className="btn">Cancelar</Link>
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar paciente'}</button>
      </div>
    </form>
  )
}
