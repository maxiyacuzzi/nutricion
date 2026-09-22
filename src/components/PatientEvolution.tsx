import { EvolutionChart, type EvolutionPoint } from './EvolutionChart'
import type { Measurement, MeasurementKey } from '../types'

const series = (ms: Measurement[], key: MeasurementKey): EvolutionPoint[] =>
  ms.filter((m) => m[key] !== null).map((m) => ({ date: m.measured_at, value: m[key] as number }))

/** Evolución de peso, grasa y músculo a lo largo de todas las visitas (small multiples: un color por tarjeta). */
export function PatientEvolution({ measurements }: { measurements: Measurement[] }) {
  if (measurements.length === 0) {
    return <p className="muted">Todavía no hay mediciones para graficar.</p>
  }
  return (
    <div className="evolution-grid">
      <EvolutionChart title="Peso" unit="kg" color="var(--accent)" points={series(measurements, 'weight_kg')} />
      {/* #b87700: no var(--amber) — ese token es muy claro en modo oscuro para una línea/relleno (falla el
          rango de luminosidad del método de color); este valor pasa la validación en los dos temas. */}
      <EvolutionChart title="% Grasa corporal" unit="%" color="#b87700" points={series(measurements, 'body_fat_pct')} />
      <EvolutionChart title="Masa muscular" unit="kg" color="var(--normal)" points={series(measurements, 'muscle_mass_kg')} />
    </div>
  )
}
