import { useState } from 'react'
import {
  delta, elapsed, formatDelta, formatValue, pickPair, trend,
  FAT_METRICS, GENERAL_METRICS, MUSCLE_METRICS, type CompareMode, type MetricSpec,
} from '../lib/compare'
import { segmentsOf } from '../lib/segments'
import { BodyFigure } from './BodyFigure'
import type { Measurement, Sex } from '../types'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' })

const MODES: { id: CompareMode; label: string }[] = [
  { id: 'previous', label: 'Última vs. anterior' },
  { id: 'first', label: 'Última vs. primera' },
]

const KPI_KEYS = ['weight_kg', 'body_fat_pct', 'muscle_mass_kg'] as const

function Section({ title, specs, base, current }: { title: string; specs: MetricSpec[]; base: Measurement; current: Measurement }) {
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
  /** Mediciones del paciente, de la más vieja a la más nueva. */
  measurements: Measurement[]
  sex: Sex
}

export function Comparison({ measurements, sex }: Props) {
  const [mode, setMode] = useState<CompareMode>('previous')
  const pair = pickPair(measurements, mode)

  if (!pair) {
    return (
      <div className="card compare-empty">
        <h3>Todavía no hay con qué comparar</h3>
        <p className="muted">
          Se necesitan al menos 2 mediciones. Este paciente tiene {measurements.length}.
          Cargá una nueva medición en su próxima visita y acá vas a ver el avance.
        </p>
      </div>
    )
  }

  const { base, current } = pair
  const baseLabel = mode === 'previous' ? 'Anterior' : 'Primera'

  return (
    <section className="compare">
      <div className="seg-toggle" role="group" aria-label="Medición de referencia">
        {MODES.map((o) => (
          <button key={o.id} type="button" className={mode === o.id ? 'on' : ''} aria-pressed={mode === o.id} onClick={() => setMode(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="cmp-dates">
        <div className="cmp-date">
          <small>{mode === 'previous' ? 'Medición anterior' : 'Primera medición'}</small>
          <strong>{fmtDate(base.measured_at)}</strong>
        </div>
        <div className="cmp-span">
          <span>→</span>
          <small>{elapsed(base.measured_at, current.measured_at)}</small>
        </div>
        <div className="cmp-date now">
          <small>Última medición</small>
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
          <figcaption>{baseLabel} · {fmtDate(base.measured_at)}</figcaption>
        </figure>
        <figure>
          <BodyFigure sex={sex} segments={segmentsOf(current)} active={null} />
          <figcaption>Última · {fmtDate(current.measured_at)}</figcaption>
        </figure>
      </div>

      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            <tr><th>Indicador</th><th>{baseLabel}</th><th>Última</th><th>Cambio</th></tr>
          </thead>
          <tbody>
            <Section title="General" specs={GENERAL_METRICS} base={base} current={current} />
            <Section title="Grasa por segmento" specs={FAT_METRICS} base={base} current={current} />
            <Section title="Músculo por segmento" specs={MUSCLE_METRICS} base={base} current={current} />
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Verde: cambio favorable (menos grasa, más músculo, etc.). Rojo: desfavorable. Gris: no se juzga (peso, agua, masa ósea, BMR),
        porque depende del objetivo del paciente.
      </p>
    </section>
  )
}
