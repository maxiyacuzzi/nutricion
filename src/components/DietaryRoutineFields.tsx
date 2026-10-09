import { ROUTINE_MEALS } from '../lib/dietaryRoutine'
import type { DietaryRoutine } from '../types'

interface Props {
  value: DietaryRoutine
  onChange: (next: DietaryRoutine) => void
}

/** Grilla de la rutina alimentaria actual del paciente: horario y qué come en cada comida. No es el plan que se le da. */
export function DietaryRoutineFields({ value, onChange }: Props) {
  const set = (key: keyof DietaryRoutine, field: 'time' | 'what', v: string) =>
    onChange({ ...value, [key]: { ...value[key], [field]: v } })

  return (
    <fieldset className="card">
      <legend>Rutina alimentaria actual</legend>
      <p className="muted small">Lo que el paciente ya come hoy (no el plan que le vas a dar). Todo es opcional.</p>
      <div className="routine-grid">
        <div className="routine-head"><span /><span>Horario</span><span>Qué come</span></div>
        {ROUTINE_MEALS.map(({ key, label, optional, timePlaceholder, whatPlaceholder }) => (
          <div className="routine-row" key={key}>
            <span className="routine-label">{label}{optional && <small className="muted"> (opcional)</small>}</span>
            <input placeholder={timePlaceholder} value={value[key].time ?? ''} onChange={(e) => set(key, 'time', e.target.value)} />
            <input placeholder={whatPlaceholder} value={value[key].what ?? ''} onChange={(e) => set(key, 'what', e.target.value)} />
          </div>
        ))}
      </div>
    </fieldset>
  )
}
