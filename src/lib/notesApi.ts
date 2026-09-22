import { supabase } from './supabase'
import type { PatientNote } from '../types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export async function listNotes(patientId: string): Promise<PatientNote[]> {
  return unwrap(
    await supabase.from('patient_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
  )
}

export async function addNote(patientId: string, body: string): Promise<PatientNote> {
  return unwrap(await supabase.from('patient_notes').insert({ patient_id: patientId, body }).select().single())
}

export async function updateNote(id: string, body: string): Promise<PatientNote> {
  return unwrap(await supabase.from('patient_notes').update({ body }).eq('id', id).select().single())
}

export async function deleteNote(id: string): Promise<void> {
  unwrap(await supabase.from('patient_notes').delete().eq('id', id))
}
