import { useState } from 'react'
import {
  buildComparisonEntries, delta, elapsed, formatDelta, formatValue, pickPair, trend,
  FAT_METRICS, GENERAL_METRICS, MUSCLE_METRICS, WAIST_METRICS, type ComparisonEntry, type MetricSpec,
} from '../lib/compare'
import { segmentsOf } from '../lib/segments'
import { BodyFigure } from './BodyFigure'
import type { Measurement, Sex, Visit } from '../types'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' })
const fmtOption = (e: ComparisonEntry) => `${fmtDate(e.measured_at)}${e.weight_kg !== null ? ` — ${e.weight_kg} kg` : ''}`

const KPI_KEYS = ['weight_kg', 'body_fat_pct', 'muscle_mass_kg'] as const

function Section({ title, specs, base, current }: { title: string; specs: MetricSpec[]; base: ComparisonEntry; current: ComparisonEntry }) {
  return (
    <>
      <tr className="cmp-section"><th colSpan={4}>{title}</th></tr>
      {specs.map((spec) => {
        const d = delta(spec, base, current)
        const unit = spec.unit && <small>{spec.unit}</small>
        return (
          <tr key={spec.key}>
            <th scope="row">{spec.label}</th>
            <td>{formatValue(spec, base[spec.key])} {unit}</td>
            <td>{formatValue(spec, current[spec.key])} {unit}</td>
            <td className={`delta ${trend(spec, d)}`}>
              {d !== null && d !== 0 && <span aria-hidden>{d > 0 ? '▲' : '▼'} </span>}
              {formatDelta(spec, d)} {d !== null && d !== 0 && unit}
            </td>
          </tr>
        )
      })}
    </>
  )
}

interface Props {
  /** Mediciones detalladas del paciente, de la más vieja a la más nueva. */
  measurements: Measurement[]
  /** Visitas del paciente: aportan peso/cintura de las que no tuvieron medición detallada. */
  visits: Visit[]
  sex: Sex
}

export function Comparison({ measurements, visits, sex }: Props) {
  const entries = buildComparisonEntries(visits, measurements)
  // null = sin elegir todavía, usa el default (última vs. anteúltima), que se actualiza solo si llegan visitas nuevas.
  const [baseId, setBaseId] = useState<string | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const effectiveBaseId = baseId ?? entries[entries.length - 2]?.id ?? ''
  const effectiveCurrentId = currentId ?? entries[entries.length - 1]?.id ?? ''
  const pair = pickPair(entries, effectiveBaseId, effectiveCurrentId)

  if (!pair) {
    return (
      <div className="card compare-empty">
        <h3>Todavía no hay con qué comparar</h3>
        <p className="muted">
          Se necesitan al menos 2 visitas con datos cargados (peso, cintura o medición detallada). Este paciente tiene {entries.length}.
          Cargá una nueva visita o medición y acá vas a ver el avance.
        </p>
      </div>
    )
  }

  const { base, current } = pair

  return (
    <section className="compare">
      <div className="toolbar cmp-picker">
        <label>Comparar
          <select value={effectiveBaseId} onChange={(e) => setBaseId(e.target.value)}>
            {entries.map((en) => <option key={en.id} value={en.id}>{fmtOption(en)}</option>)}
          </select>
        </label>
        <span className="cmp-vs" aria-hidden>→</span>
        <label>con
          <select value={effectiveCurrentId} onChange={(e) => setCurrentId(e.target.value)}>
            {entries.map((en) => <option key={en.id} value={en.id}>{fmtOption(en)}</option>)}
          </select>
        </label>
      </div>

      <div className="cmp-dates">
        <div className="cmp-date">
          <small>Medición base</small>
          <strong>{fmtDate(base.measured_at)}</strong>
        </div>
        <div className="cmp-span">
          <span>→</span>
          <small>{elapsed(base.measured_at, current.measured_at)}</small>
        </div>
        <div className="cmp-date now">
          <small>Medición comparada</small>
          <strong>{fmtDate(current.measured_at)}</strong>
        </div>
      </div>

      <div className="cmp-kpis">
        {KPI_KEYS.map((key) => {
          const spec = GENERAL_METRICS.find((s) => s.key === key)!
          const d = delta(spec, base, current)
          return (
            <div key={key} className={`kpi ${trend(spec, d)}`}>
              <small>{spec.label}</small>
              <strong>{formatDelta(spec, d)} {d !== null && d !== 0 && <span className="u">{spec.unit}</span>}</strong>
              <span className="kpi-range">
                {formatValue(spec, base[key])} → {formatValue(spec, current[key])} {spec.unit}
              </span>
            </div>
          )
        })}
      </div>

      <div className="cmp-figures">
        <figure>
          <BodyFigure sex={sex} segments={segmentsOf(base)} active={null} />
          <figcaption>{fmtDate(base.measured_at)}</figcaption>
        </figure>
        <figure>
          <BodyFigure sex={sex} segments={segmentsOf(current)} active={null} />
          <figcaption>{fmtDate(current.measured_at)}</figcaption>
        </figure>
      </div>

      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            <tr><th>Indicador</th><th>{fmtDate(base.measured_at)}</th><th>{fmtDate(current.measured_at)}</th><th>Cambio</th></tr>
          </thead>
          <tbody>
            <Section title="General" specs={GENERAL_METRICS} base={base} current={current} />
            <Section title="Cintura" specs={WAIST_METRICS} base={base} current={current} />
            <Section title="Grasa por segmento" specs={FAT_METRICS} base={base} current={current} />
            <Section title="Músculo por segmento" specs={MUSCLE_METRICS} base={base} current={current} />
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Verde: cambio favorable (menos grasa, más músculo, etc.). Rojo: desfavorable. Gris: no se juzga (peso, cintura, agua, masa ósea, BMR),
        porque depende del objetivo del paciente.
      </p>
    </section>
  )
}
