import { useEffect, useState } from 'react'
import { addNote, deleteNote, listNotes, updateNote } from '../lib/notesApi'
import type { PatientNote } from '../types'

const fmt = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })

function Entry({ note, onSaved, onDeleted }: { note: PatientNote; onSaved: (n: PatientNote) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const [busy, setBusy] = useState(false)

  async function save() {
    const text = body.trim()
    if (!text || text === note.body) return setEditing(false)
    setBusy(true)
    try {
      onSaved(await updateNote(note.id, text))
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="note">
      <div className="note-head">
        <small className="muted">{fmt(note.created_at)}</small>
        <div className="note-actions">
          {editing ? (
            <>
              <button className="icon-btn" disabled={busy} onClick={save} aria-label="Guardar nota">✓</button>
              <button className="icon-btn" disabled={busy} onClick={() => { setBody(note.body); setEditing(false) }} aria-label="Cancelar edición">✕</button>
            </>
          ) : (
            <>
              <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar nota">✎</button>
              <button className="icon-btn" onClick={() => window.confirm('¿Borrar esta nota?') && onDeleted()} aria-label="Borrar nota">🗑</button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
      ) : (
        <p className="note-body">{note.body}</p>
      )}
    </li>
  )
}

export function PatientNotes({ patientId }: { patientId: string }) {
  const [notes, setNotes] = useState<PatientNote[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listNotes(patientId).then(setNotes).catch(() => setError('No se pudieron cargar las anotaciones.'))
  }, [patientId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    try {
      const note = await addNote(patientId, text)
      setNotes((prev) => [note, ...(prev ?? [])])
      setDraft('')
    } catch {
      setError('No se pudo guardar la anotación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="notes">
      <form className="card note-form" onSubmit={submit}>
        <label>Nueva anotación
          <textarea rows={3} placeholder="Ej: refiere menos hambre a la tarde, buena adherencia al plan…"
            value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <div className="actions">
          <button className="btn primary" disabled={busy || !draft.trim()}>{busy ? 'Guardando…' : 'Agregar anotación'}</button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {notes === null ? (
        <p className="muted">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="muted">Todavía no hay anotaciones para este paciente.</p>
      ) : (
        <ul className="note-list">
          {notes.map((n) => (
            <Entry
              key={n.id}
              note={n}
              onSaved={(updated) => setNotes((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={() => {
                deleteNote(n.id)
                  .then(() => setNotes((prev) => (prev ?? []).filter((x) => x.id !== n.id)))
                  .catch(() => setError('No se pudo borrar la anotación.'))
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
