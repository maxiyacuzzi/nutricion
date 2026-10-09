import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  createMeasurement, createVisit, deleteVisit, getPatient, latestMeasurement, listMeasurements, listVisits, updateVisit,
} from '../lib/api'
import type { SimpleVisitInput } from '../lib/api'
import { ageFrom, classify, gauges, ratingLevel, type GaugeSpec } from '../lib/ranges'
import { whatsappLink, firstName } from '../lib/whatsapp'
import { Gauge } from '../components/Gauge'
import { BodyFigure, type SegmentId } from '../components/BodyFigure'
import { SegmentCard } from '../components/SegmentCard'
import { Comparison } from '../components/Comparison'
import { PatientEvolution } from '../components/PatientEvolution'
import { PatientNotes } from '../components/PatientNotes'
import { addNote } from '../lib/notesApi'
import { MealPlanEditor } from '../components/MealPlanEditor'
import { PatientPayments } from '../components/PatientPayments'
import { EditPatientModal } from '../components/EditPatientModal'
import { SimpleVisitModal } from '../components/SimpleVisitModal'
import { segmentsOf } from '../lib/segments'
import { MeasurementFields } from '../components/MeasurementFields'
import { emptyMeasurementForm, parseMeasurementForm } from '../lib/measurementForm'
import type { Measurement, Patient, Visit } from '../types'

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

function GaugePanel({ title, spec, value, decimals }: { title: string; spec: GaugeSpec; value: number | null; decimals?: number }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      <Gauge spec={spec} value={value} decimals={decimals} />
      <p className={`caption ${value === null ? '' : classify(value, spec.healthy)}`}>{spec.caption}</p>
    </div>
  )
}

function RatingPanel({ rating }: { rating: number | null }) {
  const level = rating === null ? null : ratingLevel(rating)
  return (
    <div className="panel">
      <h3>Valoración física</h3>
      <div className="rating">
        <div className={`rating-badge ${level ?? ''}`}>{rating ?? '—'}</div>
        {rating === null && <small>Sin valoración</small>}
        <div className="pills">
          {(['low', 'normal', 'high'] as const).map((l) => (
            <span key={l} className={`pill ${l} ${level === l ? 'on' : ''}`}>
              {l === 'low' ? 'Bajo' : l === 'normal' ? 'Normal' : 'Alto'}
            </span>
          ))}
        </div>
      </div>
      <p className="caption">1–3 bajo · 4–6 normal · 7–9 alto</p>
    </div>
  )
}

/** Lo que se ve cuando la visita elegida todavía no tiene medición detallada: sólo lo liviano que ya tiene. */
function SimpleVisitCard({ visit, onEdit, onAddDetailed }: { visit: Visit; onEdit: () => void; onAddDetailed: () => void }) {
  return (
    <div className="card simple-visit">
      <div className="simple-visit-head">
        <h3>Visita del {fmtDateTime(visit.visited_at)}</h3>
        <button className="btn small" onClick={onEdit}>✎ Editar</button>
      </div>
      <div className="grid g3">
        <div className="stat-block">
          <small className="muted">Peso</small>
          <strong>{visit.weight_kg ?? '—'} {visit.weight_kg !== null && <small>kg</small>}</strong>
        </div>
        <div className="stat-block">
          <small className="muted">Cintura umbilical</small>
          <strong>{visit.waist_umbilical_cm ?? '—'} {visit.waist_umbilical_cm !== null && <small>cm</small>}</strong>
        </div>
        <div className="stat-block">
          <small className="muted">Cintura alta</small>
          <strong>{visit.waist_high_cm ?? '—'} {visit.waist_high_cm !== null && <small>cm</small>}</strong>
        </div>
      </div>
      {visit.notes && (
        <div>
          <small className="muted">Notas</small>
          <p className="note-body">{visit.notes}</p>
        </div>
      )}
      <p className="muted small">Esta visita todavía no tiene la medición detallada (composición corporal completa).</p>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn primary" onClick={onAddDetailed}>＋ Agregar medición detallada</button>
      </div>
    </div>
  )
}

export function PatientDetail() {
  const { id: patientId } = useParams<{ id: string }>()
  // undefined = cargando, null = no existe (o no es tuyo).
  const [loaded, setLoaded] = useState<Patient | null | undefined>(undefined)
  const [visits, setVisits] = useState<Visit[]>([])
  const [visitId, setVisitId] = useState<string | null>(null)
  const [measurement, setMeasurement] = useState<Measurement | null>(null)
  const [hot, setHot] = useState<SegmentId | null>(null)
  // Modal de medición detallada: 'new' crea una visita nueva, 'current' la agrega a la visita elegida.
  const [measurementTarget, setMeasurementTarget] = useState<'new' | 'current' | null>(null)
  // Modal de visita simple: true = nueva, un Visit = editar esa visita.
  const [simpleModal, setSimpleModal] = useState<true | Visit | null>(null)
  const [editing, setEditing] = useState(false)
  const [view, setView] = useState<'measurement' | 'compare' | 'evolution' | 'notes' | 'plan' | 'payments'>('measurement')
  const [all, setAll] = useState<Measurement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const patient = loaded && loaded.id === patientId ? loaded : null

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Error inesperado')

  useEffect(() => {
    let cancelled = false
    if (patientId) getPatient(patientId).then((p) => !cancelled && setLoaded(p)).catch(fail)
    return () => { cancelled = true }
  }, [patientId])

  const loadVisits = useCallback(async (pid: string, select?: string) => {
    const vs = await listVisits(pid)
    setVisits(vs)
    setVisitId(select ?? vs[0]?.id ?? null)
  }, [])

  useEffect(() => {
    if (patientId) loadVisits(patientId).catch(fail)
  }, [patientId, loadVisits])

  useEffect(() => {
    let cancelled = false
    if (patientId) listMeasurements(patientId).then((ms) => !cancelled && setAll(ms)).catch(fail)
    return () => { cancelled = true }
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    if (visitId) {
      latestMeasurement(visitId).then((m) => !cancelled && setMeasurement(m)).catch(fail)
    }
    return () => { cancelled = true }
  }, [visitId])

  if (loaded === null) {
    return (
      <div className="page empty">
        <p>No se encontró el paciente.</p>
        <Link to="/pacientes" className="btn primary">Volver a Pacientes</Link>
      </div>
    )
  }

  const g = gauges(patient?.sex ?? 'M')
  // Los datos cargados pueden ser de otra visita hasta que llegue la nueva respuesta.
  const patientVisits = visits.filter((v) => v.patient_id === patientId)
  const visit = patientVisits.find((v) => v.id === visitId) ?? null
  const m = measurement && measurement.visit_id === visit?.id ? measurement : null
  const age = patient ? ageFrom(patient.birth_date) : null

  async function removeVisit() {
    if (!patient || !visit) return
    if (!window.confirm('¿Borrar esta visita? Se borra también su medición detallada, si tenía. No se puede deshacer.')) return
    try {
      await deleteVisit(visit.id)
      if (m) setAll((prev) => (prev ? prev.filter((x) => x.id !== m.id) : prev))
      await loadVisits(patient.id)
    } catch (e) { fail(e) }
  }

  async function saveSimpleVisit(input: SimpleVisitInput) {
    if (!patient) return
    if (simpleModal && simpleModal !== true) {
      const saved = await updateVisit(simpleModal.id, input)
      setVisits((prev) => prev.map((v) => (v.id === saved.id ? saved : v)))
    } else {
      const v = await createVisit(patient.id, input)
      setVisits((prev) => [v, ...prev])
      setVisitId(v.id)
      if (input.notes) await addNote(patient.id, `Visita: ${input.notes}`)
    }
    setSimpleModal(null)
  }

  const latestVisit = patientVisits[0] ?? null

  return (
    <div className="dash">
      <Link to="/pacientes" className="back">← Pacientes</Link>
      <header className="top">
        <div>
          <small className="live">Última visita: {latestVisit ? fmtDateTime(latestVisit.visited_at) : '—'}</small>
          <h1>{patient?.full_name ?? '…'}</h1>
          {patient && (
            <>
              <small className="muted">DNI: {patient.dni} | Edad: {age ?? '—'} | Altura: {patient.height_cm ?? '—'}{patient.height_cm !== null ? ' cm' : ''}</small>
              <br />
              <small className="muted">
                {patient.insurance_provider
                  ? `${patient.insurance_provider}${patient.insurance_plan ? ` (${patient.insurance_plan})` : ''}${patient.insurance_member_id ? ` · N° afiliado ${patient.insurance_member_id}` : ''}`
                  : 'Sin obra social registrada'}
              </small>
            </>
          )}
        </div>
        <div className="actions">
          <button className="btn" disabled={!patient} onClick={() => setEditing(true)}>✎ Editar</button>
          <button className="btn" disabled={!patient?.phone}
            title={patient && !patient.phone ? 'Cargá el teléfono del paciente en "Editar" para poder escribirle' : undefined}
            onClick={() => patient?.phone && window.open(whatsappLink(patient.phone, `Hola ${firstName(patient.full_name)}!`), '_blank')}>
            💬 WhatsApp
          </button>
          <button className="btn" disabled={!patient || !visit || !m}
            onClick={() => patient && visit && m && import('../lib/report').then((r) => r.downloadReport(patient, visit, m))}>
            📄 Reporte PDF
          </button>
        </div>
      </header>

      {editing && patient && (
        <EditPatientModal patient={patient} onClose={() => setEditing(false)} onSaved={(p) => { setLoaded(p); setEditing(false) }} />
      )}

      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === 'measurement'} className={view === 'measurement' ? 'on' : ''} onClick={() => setView('measurement')}>
          Medición
        </button>
        <button role="tab" aria-selected={view === 'compare'} className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')}>
          Comparar avance
        </button>
        <button role="tab" aria-selected={view === 'evolution'} className={view === 'evolution' ? 'on' : ''} onClick={() => setView('evolution')}>
          Evolución
        </button>
        <button role="tab" aria-selected={view === 'notes'} className={view === 'notes' ? 'on' : ''} onClick={() => setView('notes')}>
          Anotaciones
        </button>
        <button role="tab" aria-selected={view === 'plan'} className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}>
          Plan de alimentación
        </button>
        <button role="tab" aria-selected={view === 'payments'} className={view === 'payments' ? 'on' : ''} onClick={() => setView('payments')}>
          Pagos
        </button>
      </div>

      {view === 'compare' ? (
        patient && all && <Comparison key={patient.id} measurements={all} visits={patientVisits} sex={patient.sex} />
      ) : view === 'evolution' ? (
        all && <PatientEvolution measurements={all} visits={patientVisits} />
      ) : view === 'notes' ? (
        patient && <PatientNotes patientId={patient.id} />
      ) : view === 'plan' ? (
        patient && <MealPlanEditor patient={patient} />
      ) : view === 'payments' ? (
        patient && <PatientPayments patient={patient} />
      ) : (
        <>
      <div className="toolbar">
        <label>Visita
          <select value={visitId ?? ''} onChange={(e) => setVisitId(e.target.value)}>
            {patientVisits.map((v) => (
              <option key={v.id} value={v.id}>
                {fmtDateTime(v.visited_at)}{v.weight_kg !== null ? ` — ${v.weight_kg} kg` : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={() => setSimpleModal(true)} disabled={!patient}>＋ Nueva visita</button>
        <button className="btn" onClick={() => setMeasurementTarget('new')} disabled={!patient}>＋ Medición detallada</button>
        <button className="btn danger" onClick={removeVisit} disabled={!visit}>🗑 Borrar visita</button>
      </div>

      {visit && !m ? (
        <SimpleVisitCard visit={visit} onEdit={() => setSimpleModal(visit)} onAddDetailed={() => setMeasurementTarget('current')} />
      ) : (
        <>
      <div className="row5">
        <RatingPanel rating={m?.physical_rating ?? null} />
        <GaugePanel title="% Grasa corporal" spec={g.fat} value={m?.body_fat_pct ?? null} />
        <GaugePanel title="% Agua corporal" spec={g.water} value={m?.body_water_pct ?? null} />
        <GaugePanel title="Masa músculo" spec={g.muscle} value={m?.muscle_mass_kg ?? null} />
        <GaugePanel title="Masa ósea" spec={g.bone} value={m?.bone_mass_kg ?? null} decimals={2} />
      </div>

      <section className="segmental">
        <h3>Análisis segmental de composición corporal</h3>
        {patient && (
          <div className="body-grid">
            <SegmentCard className="a-ra" title="Brazo derecho" sex={patient.sex} leanKg={m?.muscle_right_arm_kg ?? null}
              fatPct={m?.fat_right_arm_pct ?? null} active={hot === 'rightArm'} onHover={(on) => setHot(on ? 'rightArm' : null)} />
            <SegmentCard className="a-la" title="Brazo izquierdo" sex={patient.sex} leanKg={m?.muscle_left_arm_kg ?? null}
              fatPct={m?.fat_left_arm_pct ?? null} active={hot === 'leftArm'} onHover={(on) => setHot(on ? 'leftArm' : null)} />
            <div className="a-fig">
              <BodyFigure sex={patient.sex} active={hot} onHover={setHot} segments={segmentsOf(m)} />
            </div>
            <SegmentCard className="a-tr" title="Tronco" sex={patient.sex} leanKg={m?.muscle_trunk_kg ?? null}
              fatPct={m?.fat_trunk_pct ?? null} active={hot === 'trunk'} onHover={(on) => setHot(on ? 'trunk' : null)} />
            <SegmentCard className="a-rl" title="Pierna derecha" sex={patient.sex} leanKg={m?.muscle_right_leg_kg ?? null}
              fatPct={m?.fat_right_leg_pct ?? null} active={hot === 'rightLeg'} onHover={(on) => setHot(on ? 'rightLeg' : null)} />
            <SegmentCard className="a-ll" title="Pierna izquierda" sex={patient.sex} leanKg={m?.muscle_left_leg_kg ?? null}
              fatPct={m?.fat_left_leg_pct ?? null} active={hot === 'leftLeg'} onHover={(on) => setHot(on ? 'leftLeg' : null)} />
          </div>
        )}
      </section>

      <div className="row3">
        <GaugePanel title="DCI / BMR" spec={g.bmr} value={m?.bmr_kcal ?? null} decimals={0} />
        <GaugePanel title="Edad metabólica" spec={g.metabolicAge} value={m?.metabolic_age ?? null} decimals={0} />
        <GaugePanel title="Grasa visceral" spec={g.visceral} value={m?.visceral_fat ?? null} />
      </div>
        </>
      )}
        </>
      )}

      {simpleModal && patient && (
        <SimpleVisitModal
          initial={simpleModal === true ? undefined : simpleModal}
          onClose={() => setSimpleModal(null)}
          onSave={saveSimpleVisit}
        />
      )}

      {measurementTarget && patient && (
        <MeasurementModal
          onClose={() => setMeasurementTarget(null)}
          onSave={async (values, notes) => {
            if (measurementTarget === 'current' && visit) {
              const saved = await createMeasurement(visit.id, values)
              setMeasurement(saved)
              setAll((prev) => (prev ? [...prev, saved] : prev))
            } else {
              // Medición detallada sin visita elegida (o explícitamente "nueva"): abre su propia visita.
              const v = await createVisit(patient.id)
              const saved = await createMeasurement(v.id, values)
              setVisits((prev) => [v, ...prev])
              setVisitId(v.id)
              setMeasurement(saved)
              setAll((prev) => (prev ? [...prev, saved] : prev))
            }
            if (notes) await addNote(patient.id, `Medición detallada: ${notes}`)
            setMeasurementTarget(null)
          }}
        />
      )}
    </div>
  )
}

function MeasurementModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (values: ReturnType<typeof parseMeasurementForm>, notes: string | null) => Promise<void>
}) {
  const [form, setForm] = useState(emptyMeasurementForm)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(parseMeasurementForm(form), notes.trim() || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Medición detallada</h2>
        <MeasurementFields form={form} onChange={(k, v) => setForm((s) => ({ ...s, [k]: v }))} />
        <fieldset className="card">
          <legend>Notas</legend>
          <label>Notas de esta medición <span className="tag">opcional</span>
            <textarea rows={3} placeholder="Ej: buena adherencia al plan, refiere menos hambre…"
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </fieldset>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar medición'}</button>
        </div>
      </form>
    </div>
  )
}
