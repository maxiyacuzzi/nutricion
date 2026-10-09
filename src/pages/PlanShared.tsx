import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getSharedPlan } from '../lib/sharedPlanApi'
import { WEEK_ORDER, WEEKDAYS_LONG, formatDay } from '../lib/time'
import { seasonOf, seasonTheme } from '../lib/season'
import { PRACTITIONER_LICENSE, PRACTITIONER_NAME } from '../lib/branding'
import { MEAL_TYPES } from '../types'
import type { MealType, SharedMealPlan } from '../types'
import { ThemeToggle } from '../components/ThemeToggle'

const MEAL_LABEL: Record<MealType, string> = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena' }
const MEAL_EMOJI: Record<MealType, string> = { desayuno: '☀️', almuerzo: '🍽️', merienda: '🍵', cena: '🌙' }

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
  const theme = plan ? seasonTheme(seasonOf(plan.created_at)) : null

  return (
    <main className="booking">
      <div className="corner no-print"><ThemeToggle /></div>
      {plan === undefined && !error ? (
        <p className="muted">Cargando…</p>
      ) : !plan || error || !theme ? (
        <div className="card booking-card">
          <h1>Plan no encontrado</h1>
          <p className="muted">{error ?? 'Este link no corresponde a ningún plan. Revisá que esté completo.'}</p>
        </div>
      ) : (
        <div className="plan-doc" style={{ '--season-bg': theme.bg, '--season-on-bg': theme.onBg, '--season-soft': theme.soft, '--season-accent': theme.accent, '--season-on-accent': theme.onAccent } as React.CSSProperties}>
          <header className="plan-doc-head">
            <div className="plan-doc-badge">
              <span aria-hidden>🍎</span>
              <div>
                <strong>{PRACTITIONER_NAME}</strong>
                <small>{PRACTITIONER_LICENSE}</small>
              </div>
            </div>
            <div className="plan-doc-title">
              <h1>Menú semanal para {plan.patient_name}</h1>
              <p>{plan.title} · {formatDay(plan.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <span className="plan-doc-season" aria-hidden>{theme.emoji} {theme.label}</span>
          </header>

          <div className="plan-doc-body">
            {plan.dietary_restrictions && <p className="notice">Restricciones: {plan.dietary_restrictions}</p>}

            <div className="plan-grid-wrap">
              <table className="plan-grid season">
                <thead>
                  <tr><th /> {WEEK_ORDER.map((wd) => <th key={wd}><span className="day-pill">{WEEKDAYS_LONG[wd]}</span></th>)}</tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((meal) => (
                    <tr key={meal}>
                      <th scope="row"><span aria-hidden>{MEAL_EMOJI[meal]}</span> {MEAL_LABEL[meal]}</th>
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
        </div>
      )}
    </main>
  )
}
