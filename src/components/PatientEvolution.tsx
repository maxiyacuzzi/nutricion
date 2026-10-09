import { EvolutionChart, type EvolutionPoint } from './EvolutionChart'
import type { Measurement, MeasurementKey, Visit } from '../types'

const series = (ms: Measurement[], key: MeasurementKey): EvolutionPoint[] =>
  ms.filter((m) => m[key] !== null).map((m) => ({ date: m.measured_at, value: m[key] as number }))

/** Peso: junta las visitas simples (sólo peso) con las mediciones detalladas, por fecha. */
function weightSeries(measurements: Measurement[], visits: Visit[]): EvolutionPoint[] {
  const points: EvolutionPoint[] = [
    ...measurements.map((m) => ({ date: m.measured_at, value: m.weight_kg })),
    ...visits.filter((v) => v.weight_kg !== null).map((v) => ({ date: v.visited_at, value: v.weight_kg as number })),
  ]
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

interface Props {
  measurements: Measurement[]
  visits: Visit[]
}

/** Evolución de peso, grasa y músculo a lo largo de todas las visitas (small multiples: un color por tarjeta). */
export function PatientEvolution({ measurements, visits }: Props) {
  const weight = weightSeries(measurements, visits)
  if (weight.length === 0 && measurements.length === 0) {
    return <p className="muted">Todavía no hay mediciones para graficar.</p>
  }
  return (
    <div className="evolution-grid">
      <EvolutionChart title="Peso" unit="kg" color="var(--accent)" points={weight} />
      {/* #b87700: no var(--amber) — ese token es muy claro en modo oscuro para una línea/relleno (falla el
          rango de luminosidad del método de color); este valor pasa la validación en los dos temas. */}
      <EvolutionChart title="% Grasa corporal" unit="%" color="#b87700" points={series(measurements, 'body_fat_pct')} />
      <EvolutionChart title="Masa muscular" unit="kg" color="var(--normal)" points={series(measurements, 'muscle_mass_kg')} />
    </div>
  )
}
