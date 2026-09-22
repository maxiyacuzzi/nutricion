import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedPlan } from '../lib/sharedPlanApi'
import { WEEK_ORDER, WEEKDAYS_LONG, formatDay } from '../lib/time'
import { MEAL_TYPES } from '../types'
import type { MealType, SharedMealPlan } from '../types'
import { ThemeToggle } from '../components/ThemeToggle'

const MEAL_LABEL: Record<MealType, string> = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena' }

/** Página pública (sin login): lo que el paciente ve al abrir el link de su plan de alimentación. */
export function PlanShared() {
  const { token = '' } = useParams<{ token: string }>()
  // undefined = cargando, null = el link no corresponde a ningún plan.
  const [plan, setPlan] = useState<SharedMealPlan | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSharedPlan(token)
      .then((p) => !cancelled && setPlan(p))
      .catch(() => !cancelled && setError('No se pudo cargar el plan.'))
    return () => { cancelled = true }
  }, [token])

  const byCell = new Map((plan?.items ?? []).map((i) => [`${i.weekday}-${i.meal_type}`, i.content]))

  return (
    <main className="booking">
      <div className="corner no-print"><ThemeToggle /></div>
      {plan === undefined && !error ? (
        <p className="muted">Cargando…</p>
      ) : !plan || error ? (
        <div className="card booking-card">
          <h1>Plan no encontrado</h1>
          <p className="muted">{error ?? 'Este link no corresponde a ningún plan. Revisá que esté completo.'}</p>
        </div>
      ) : (
        <div className="card booking-card wide">
          <div>
            <span className="tag">Plan de alimentación</span>
            <h1>{plan.patient_name}</h1>
            <p className="muted small">{plan.title} · {formatDay(plan.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {plan.dietary_restrictions && <p className="notice">Restricciones: {plan.dietary_restrictions}</p>}
          </div>

          <div className="plan-grid-wrap">
            <table className="plan-grid">
              <thead>
                <tr><th />{WEEK_ORDER.map((wd) => <th key={wd}>{WEEKDAYS_LONG[wd]}</th>)}</tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map((meal) => (
                  <tr key={meal}>
                    <th scope="row">{MEAL_LABEL[meal]}</th>
                    {WEEK_ORDER.map((wd) => (
                      <td key={wd}><p className="plan-cell readonly">{byCell.get(`${wd}-${meal}`) ?? '—'}</p></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions no-print">
            <button type="button" className="btn" onClick={() => window.print()}>🖨 Imprimir</button>
          </div>
        </div>
      )}
    </main>
  )
}
