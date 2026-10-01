import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createPatient } from '../lib/api'
import { MeasurementFields } from '../components/MeasurementFields'
import { InsuranceFields } from '../components/InsuranceFields'
import { emptyMeasurementForm, parseMeasurementForm } from '../lib/measurementForm'
import type { Sex } from '../types'

export function PatientForm() {
  const navigate = useNavigate()
  const [dni, setDni] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sex, setSex] = useState<Sex>('M')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [insuranceProvider, setInsuranceProvider] = useState('')
  const [insurancePlan, setInsurancePlan] = useState('')
  const [insuranceMemberId, setInsuranceMemberId] = useState('')
  const [measurement, setMeasurement] = useState(emptyMeasurementForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const values = parseMeasurementForm(measurement)
      const heightCm = Number(height.replace(',', '.'))
      if (!Number.isFinite(heightCm) || heightCm <= 0) throw new Error('Altura inválida')
      const patient = await createPatient(
        {
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
        },
        values,
      )
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
        DNI, Nombre, Sexo, Altura y Peso son <b>obligatorios</b>. Los demás campos son opcionales. Se crea
        automáticamente la primera visita y medición.
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
          <label>Altura (cm) *
            <input required inputMode="decimal" placeholder="Ej: 175" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <MeasurementFields form={measurement} onChange={(k, v) => setMeasurement((s) => ({ ...s, [k]: v }))} />

      <InsuranceFields
        provider={insuranceProvider} plan={insurancePlan} memberId={insuranceMemberId}
        onProvider={setInsuranceProvider} onPlan={setInsurancePlan} onMemberId={setInsuranceMemberId}
      />

      <fieldset className="card">
        <legend>Restricciones alimenticias</legend>
        <label>Alimentos que no puede consumir (celiaco, intolerante lactosa, sin mariscos, etc.)
          <input placeholder="Ej: celiaco, intolerante a la lactosa, sin mariscos" value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)} />
        </label>
        <p className="muted small">Este dato se usa para generar el plan de alimentación personalizado.</p>
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <Link to="/pacientes" className="btn">Cancelar</Link>
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar paciente'}</button>
      </div>
    </form>
  )
}
