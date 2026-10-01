import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listPatientSummaries } from '../lib/api'
import { ageFrom, classify, fatRange, ratingLevel } from '../lib/ranges'
import type { PatientSummary } from '../types'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short' })

function PatientCard({ p }: { p: PatientSummary }) {
  const age = ageFrom(p.birth_date)
  const fatLevel = p.last_body_fat_pct === null ? null : classify(p.last_body_fat_pct, fatRange(p.sex))
  return (
    <Link to={`/pacientes/${p.id}`} className="pcard">
      <div className="pcard-head">
        <span className="avatar" aria-hidden>{initials(p.full_name)}</span>
        <div className="pcard-id">
          <h3>{p.full_name}</h3>
          <small className="muted">DNI {p.dni}</small>
          <small className="muted">
            {age !== null ? `${age} años · ` : ''}{p.sex === 'M' ? 'Masc.' : 'Fem.'} · {p.height_cm} cm
          </small>
        </div>
        {p.last_physical_rating !== null && (
          <span className={`pill on ${ratingLevel(p.last_physical_rating)}`} title="Valoración física">
            Val. {p.last_physical_rating}
          </span>
        )}
      </div>

      {p.last_measured_at ? (
        <dl className="pstats">
          <div><dt>Peso</dt><dd>{p.last_weight_kg ?? '—'} <small>kg</small></dd></div>
          <div>
            <dt>% Grasa</dt>
            <dd className={fatLevel ? `lvl-${fatLevel}` : undefined}>{p.last_body_fat_pct ?? '—'} <small>%</small></dd>
          </div>
          <div><dt>Músculo</dt><dd>{p.last_muscle_mass_kg ?? '—'} <small>kg</small></dd></div>
        </dl>
      ) : (
        <p className="muted pcard-empty">Sin mediciones todavía</p>
      )}

      <footer className="pcard-foot">
        <span>{p.last_measured_at ? `Última: ${fmtDate(p.last_measured_at)}` : 'Sin medir'}</span>
        <span>{p.visit_count} {p.visit_count === 1 ? 'visita' : 'visitas'}</span>
      </footer>
    </Link>
  )
}

export function PatientsGrid() {
  const [patients, setPatients] = useState<PatientSummary[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPatientSummaries()
      .then(setPatients)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado'))
  }, [])

  const q = normalize(query.trim())
  const shown = (patients ?? []).filter((p) => normalize(p.full_name).includes(q) || p.dni.includes(query.trim()))

  return (
    <div className="page">
      <div className="grid-head">
        <div>
          <h2>Pacientes</h2>
          {patients && <small className="muted">{patients.length} en total</small>}
        </div>
        <input
          type="search"
          className="search"
          placeholder="Buscar por nombre o DNI"
          aria-label="Buscar paciente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Link to="/pacientes/nuevo" className="btn primary">＋ Nuevo paciente</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {patients && patients.length === 0 && (
        <div className="empty-state">
          <p>Todavía no hay pacientes.</p>
          <Link to="/pacientes/nuevo" className="btn primary">Registrar el primero</Link>
        </div>
      )}

      {patients && patients.length > 0 && shown.length === 0 && (
        <p className="muted">Ningún paciente coincide con “{query}”.</p>
      )}

      <div className="pgrid">
        {shown.map((p) => <PatientCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}
