import { MEASUREMENT_GROUPS } from '../lib/fields'
import type { FieldGroup } from '../lib/fields'
import type { MeasurementKey } from '../types'
import type { MeasurementForm } from '../lib/measurementForm'

// Un <fieldset> por título de grupo, conservando el orden.
const SECTIONS = [
  ...MEASUREMENT_GROUPS.reduce((acc, g) => acc.set(g.title, [...(acc.get(g.title) ?? []), g]), new Map<string, FieldGroup[]>()),
]

interface Props {
  form: MeasurementForm
  onChange: (key: MeasurementKey, value: string) => void
}

export function MeasurementFields({ form, onChange }: Props) {
  return (
    <>
      <fieldset className="card">
        <legend>Antropometría</legend>
        <div className="grid g3">
          <label>
            Peso (kg) *
            <input inputMode="decimal" required placeholder="Ej: 80.5" value={form.weight_kg}
              onChange={(e) => onChange('weight_kg', e.target.value)} />
          </label>
          <label>
            Valoración física (1–9)
            <select value={form.physical_rating} onChange={(e) => onChange('physical_rating', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
      </fieldset>

      {SECTIONS.map(([title, groups]) => (
        <fieldset className="card" key={title}>
          <legend>{title}</legend>
          {groups.map((g) => (
            <div key={g.subtitle ?? g.title}>
              {g.subtitle && <h5>{g.subtitle}</h5>}
              <div className="grid g4">
                {g.fields.map((fl) => (
                  <label key={fl.key}>
                    {fl.label}
                    <input inputMode="decimal" placeholder={fl.placeholder} value={form[fl.key]}
                      onChange={(e) => onChange(fl.key, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
    </>
  )
}
