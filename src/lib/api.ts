import { supabase } from './supabase'
import type { Measurement, MeasurementValues, Patient, PatientInput, PatientSummary, Visit } from '../types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export async function listPatientSummaries(): Promise<PatientSummary[]> {
  return unwrap(await supabase.from('patient_summaries').select('*').order('full_name'))
}

export async function getPatient(id: string): Promise<Patient | null> {
  return unwrap(await supabase.from('patients').select('*').eq('id', id).maybeSingle())
}

/** Actualiza los datos del paciente. Error `dni_taken` si el DNI ya lo usa otro paciente tuyo. */
export async function updatePatient(id: string, input: PatientInput): Promise<Patient> {
  const { data, error } = await supabase.from('patients').update(input).eq('id', id).select().single()
  if (error) throw new Error(error.code === '23505' ? 'dni_taken' : error.message)
  return data as Patient
}

export async function listVisits(patientId: string): Promise<Visit[]> {
  return unwrap(
    await supabase.from('visits').select('*').eq('patient_id', patientId).order('visited_at', { ascending: false }),
  )
}

/** Última medición de una visita, o null si todavía no tiene. */
export async function latestMeasurement(visitId: string): Promise<Measurement | null> {
  return unwrap(
    await supabase
      .from('measurements')
      .select('*')
      .eq('visit_id', visitId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

/** Todas las mediciones del paciente (de todas sus visitas), de la más vieja a la más nueva. */
export async function listMeasurements(patientId: string): Promise<Measurement[]> {
  const rows: (Measurement & { visits?: unknown })[] = unwrap(
    await supabase
      .from('measurements')
      .select('*, visits!inner(patient_id)')
      .eq('visits.patient_id', patientId)
      .order('measured_at', { ascending: true }),
  )
  return rows.map(({ visits: _visits, ...m }) => m)
}

export interface SimpleVisitInput {
  weight_kg: number | null
  waist_umbilical_cm: number | null
  waist_high_cm: number | null
  notes: string | null
}

/** Crea una visita; `simple` es la medición liviana (peso, talla, cinturas, nota) que puede llevar cualquier visita. */
export async function createVisit(patientId: string, simple?: SimpleVisitInput): Promise<Visit> {
  return unwrap(await supabase.from('visits').insert({ patient_id: patientId, ...simple }).select().single())
}

/** Edita la medición simple de una visita ya creada. */
export async function updateVisit(id: string, simple: SimpleVisitInput): Promise<Visit> {
  return unwrap(await supabase.from('visits').update(simple).eq('id', id).select().single())
}

export async function createMeasurement(visitId: string, values: MeasurementValues): Promise<Measurement> {
  return unwrap(await supabase.from('measurements').insert({ visit_id: visitId, ...values }).select().single())
}

export async function deleteMeasurement(id: string): Promise<void> {
  unwrap(await supabase.from('measurements').delete().eq('id', id))
}

/** Borra la visita entera (y su medición detallada, si tenía: la base la borra sola en cascada). */
export async function deleteVisit(id: string): Promise<void> {
  unwrap(await supabase.from('visits').delete().eq('id', id))
}

/** Crea el paciente (sólo identificación; la primera visita/medición se carga después, desde su ficha). */
export async function createPatient(input: PatientInput): Promise<Patient> {
  return unwrap(await supabase.from('patients').insert(input).select().single())
}
