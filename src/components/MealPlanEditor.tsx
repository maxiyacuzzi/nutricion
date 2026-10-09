import { useEffect, useState } from 'react'
import {
  createPlan, deletePlan, listPlanItems, listPlans, regenerateShareLink, renamePlan, saveCell,
} from '../lib/mealPlanApi'
import { generatePlanWithAI, mealplanErrorMessage } from '../lib/mealplanFunctionApi'
import { WEEK_ORDER, WEEKDAYS_LONG } from '../lib/time'
import { firstName, whatsappLink } from '../lib/whatsapp'
import { MEAL_TYPES } from '../types'
import type { MealPlan, MealPlanItem, MealType, Patient } from '../types'

const MEAL_LABEL: Record<MealType, string> = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', merienda: 'Merienda', cena: 'Cena' }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' })
const cellKey = (weekday: number, meal: MealType) => `${weekday}-${meal}`

function GenerateModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (goal: string) => void }) {
  const [goal, setGoal] = useState('')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <h2>Generar plan con IA</h2>
        <p className="muted small">
          Se va a armar un borrador de plan semanal usando las restricciones alimenticias, la última medición y las
          anotaciones del paciente. Vas a poder revisarlo y editarlo antes de usarlo.
        </p>
        <label>Objetivo (opcional)
          <input placeholder="Ej: bajar de peso, ganar masa muscular, mantenimiento…" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={() => onGenerate(goal.trim())}>Generar</button>
        </div>
      </div>
    </div>
  )
}

function Cell({ planId, weekday, meal, value, onSaved }: {
  planId: string; weekday: number; meal: MealType; value: string; onSaved: (weekday: number, meal: MealType, v: string) => void
}) {
  // El valor inicial alcanza: cuando cambia de plan, `key={plan.id}` en la tabla remonta todas las celdas.
  const [text, setText] = useState(value)
  const [saving, setSaving] = useState(false)

  async function commit() {
    if (text === value) return
    setSaving(true)
    try {
      await saveCell(planId, weekday, meal, text)
      onSaved(weekday, meal, text.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <textarea
      className={`plan-cell ${saving ? 'saving' : ''}`}
      rows={3}
      placeholder="—"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
    />
  )
}

export function MealPlanEditor({ patient }: { patient: Patient }) {
  const patientId = patient.id
  const [plans, setPlans] = useState<MealPlan[] | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, string> | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [modal, setModal] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPlans(patientId)
      .then((ps) => { setPlans(ps); setPlanId(ps[0]?.id ?? null) })
      .catch(() => setError('No se pudieron cargar los planes.'))
  }, [patientId])

  useEffect(() => {
    if (!planId) return setItems(null)
    let cancelled = false
    listPlanItems(planId)
      .then((rows) => {
        if (cancelled) return
        setItems(Object.fromEntries(rows.map((r) => [cellKey(r.weekday, r.meal_type), r.content])))
      })
      .catch(() => setError('No se pudo cargar el plan.'))
    return () => { cancelled = true }
  }, [planId])

  const plan = plans?.find((p) => p.id === planId) ?? null

  async function newPlan() {
    if (creating) return
    setError(null)
    setCreating(true)
    try {
      const p = await createPlan(patientId, `Plan del ${fmtDate(new Date().toISOString())}`)
      setPlans((prev) => [p, ...(prev ?? [])])
      setPlanId(p.id)
    } catch {
      setError('No se pudo crear el plan.')
    } finally {
      setCreating(false)
    }
  }

  async function generate(goal: string) {
    setModal(false)
    setGenerating(true)
    setError(null)
    try {
      const { plan_id } = await generatePlanWithAI(patientId, goal)
      const fresh = await listPlans(patientId)
      setPlans(fresh)
      setPlanId(plan_id)
    } catch (e) {
      setError(mealplanErrorMessage(e instanceof Error ? e.message : ''))
    } finally {
      setGenerating(false)
    }
  }

  async function rename() {
    if (!plan) return
    const title = window.prompt('Nombre del plan', plan.title)?.trim()
    if (!title || title === plan.title) return
    try {
      await renamePlan(plan.id, title)
      setPlans((prev) => (prev ?? []).map((p) => (p.id === plan.id ? { ...p, title } : p)))
    } catch {
      setError('No se pudo renombrar el plan.')
    }
  }

  async function remove() {
    if (!plan || !window.confirm(`¿Borrar "${plan.title}"? No se puede deshacer.`)) return
    try {
      await deletePlan(plan.id)
      setPlans((prev) => {
        const rest = (prev ?? []).filter((p) => p.id !== plan.id)
        setPlanId(rest[0]?.id ?? null)
        return rest
      })
    } catch {
      setError('No se pudo borrar el plan.')
    }
  }

  async function downloadPdf() {
    if (!plan || !items) return
    const rows: MealPlanItem[] = Object.entries(items)
      .filter(([, content]) => content.trim() !== '')
      .map(([key, content]) => {
        const [weekday, meal_type] = key.split('-') as [string, MealType]
        return { weekday: Number(weekday), meal_type, content }
      })
    const { downloadMealPlanReport } = await import('../lib/mealPlanReport')
    downloadMealPlanReport(patient, plan, rows)
  }

  async function regenerateLink() {
    if (!plan || !window.confirm('¿Generar un link nuevo? El link anterior deja de funcionar.')) return
    setError(null)
    try {
      const share_token = await regenerateShareLink(plan.id)
      setPlans((prev) => (prev ?? []).map((p) => (p.id === plan.id ? { ...p, share_token } : p)))
    } catch {
      setError('No se pudo generar el link nuevo.')
    }
  }

  return (
    <div className="mealplan">
      <div className="mealplan-toolbar">
        <label>Plan
          <select value={planId ?? ''} onChange={(e) => setPlanId(e.target.value || null)} disabled={!plans?.length}>
            {!plans?.length && <option value="">Sin planes todavía</option>}
            {plans?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {fmtDate(p.created_at)}{p.source === 'ai' ? ' · IA' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={newPlan} disabled={creating}>{creating ? 'Creando…' : '＋ Plan en blanco'}</button>
        <button className="btn primary" onClick={() => setModal(true)} disabled={generating}>
          {generating ? 'Generando…' : '✨ Generar con IA'}
        </button>
        {plan && (
          <>
            <button className="btn small" onClick={() => setSharing((s) => !s)}>🔗 Compartir</button>
            <button className="btn small" onClick={downloadPdf}>📄 PDF</button>
            <button className="btn small" onClick={rename}>Renombrar</button>
            <button className="btn small danger" onClick={remove}>Borrar</button>
          </>
        )}
      </div>

      {plan && sharing && (
        <div className="card share-box">
          <p className="muted small">Este link lo puede abrir cualquiera que lo tenga, sin necesitar cuenta. Siempre muestra la última versión del plan.</p>
          <div className="linkbox">
            <code>{`${window.location.origin}/plan/${plan.share_token}`}</code>
            <button
              className="btn small"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/plan/${plan.share_token}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <a className="btn small" href={`/plan/${plan.share_token}`} target="_blank" rel="noreferrer">Abrir</a>
            {patient.phone && (
              <a
                className="btn small" target="_blank" rel="noreferrer"
                href={whatsappLink(patient.phone, `Hola ${firstName(patient.full_name)}! Te comparto tu plan de alimentación: ${window.location.origin}/plan/${plan.share_token}`)}
              >
                💬 WhatsApp
              </a>
            )}
            <button className="btn small danger" onClick={regenerateLink}>Generar link nuevo</button>
          </div>
        </div>
      )}

      {plan?.source === 'ai' && <p className="notice">Este plan lo armó la IA. Revisalo antes de compartirlo: podés editar cualquier celda.</p>}
      {error && <p className="error">{error}</p>}

      {!plan ? (
        <p className="muted">Creá un plan en blanco o generá uno con IA para empezar.</p>
      ) : items === null ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="plan-grid-wrap">
          <table className="plan-grid" key={plan.id}>
            <thead>
              <tr>
                <th />
                {WEEK_ORDER.map((wd) => <th key={wd}>{WEEKDAYS_LONG[wd]}</th>)}
              </tr>
            </thead>
            <tbody>
              {MEAL_TYPES.map((meal) => (
                <tr key={meal}>
                  <th scope="row">{MEAL_LABEL[meal]}</th>
                  {WEEK_ORDER.map((wd) => (
                    <td key={wd}>
                      <Cell
                        planId={plan.id}
                        weekday={wd}
                        meal={meal}
                        value={items[cellKey(wd, meal)] ?? ''}
                        onSaved={(w, m, v) => setItems((prev) => ({ ...prev, [cellKey(w, m)]: v }))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <GenerateModal onClose={() => setModal(false)} onGenerate={generate} />}
    </div>
  )
}
