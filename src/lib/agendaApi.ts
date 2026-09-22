import { supabase } from './supabase'
import type { Appointment, AppointmentStatus, AvailabilityRule, Professional, TimeOff } from '../types'
import { hhmm } from './time'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (error) throw new Error(error.code === '23505' ? 'slug_taken' : error.code === '23P01' ? 'overlap' : error.message)
  return data as T
}

/** Perfil de agenda del usuario logueado, o null si todavía no lo configuró. */
export async function getMyProfessional(): Promise<Professional | null> {
  return unwrap(await supabase.from('professionals').select('*').maybeSingle())
}

export async function createProfessional(input: { slug: string; display_name: string }): Promise<Professional> {
  return unwrap(await supabase.from('professionals').insert(input).select().single())
}

export type ProfessionalSettings = Pick<
  Professional,
  'display_name' | 'slug' | 'slot_minutes' | 'min_notice_hours' | 'max_days_ahead' | 'booking_enabled'
>

export async function updateProfessional(id: string, patch: ProfessionalSettings): Promise<Professional> {
  return unwrap(await supabase.from('professionals').update(patch).eq('id', id).select().single())
}

export async function listRules(): Promise<AvailabilityRule[]> {
  const rows: AvailabilityRule[] = unwrap(
    await supabase.from('availability_rules').select('weekday, start_time, end_time').order('start_time'),
  )
  return rows.map((r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) }))
}

export async function replaceRules(rules: AvailabilityRule[]): Promise<void> {
  unwrap(await supabase.rpc('replace_availability', { p_rules: rules }))
}

export async function listTimeOff(): Promise<TimeOff[]> {
  return unwrap(await supabase.from('time_off').select('id, starts_on, ends_on, reason').order('starts_on'))
}

export async function addTimeOff(input: { starts_on: string; ends_on: string; reason: string | null }): Promise<TimeOff> {
  return unwrap(await supabase.from('time_off').insert(input).select('id, starts_on, ends_on, reason').single())
}

export async function deleteTimeOff(id: string): Promise<void> {
  unwrap(await supabase.from('time_off').delete().eq('id', id))
}

export async function listAppointments(fromIso: string, toIso: string): Promise<Appointment[]> {
  return unwrap(
    await supabase
      .from('appointments')
      .select('id, patient_id, starts_at, ends_at, status, patient_dni, patient_name, patient_email, patient_phone, cancelled_by')
      .gte('starts_at', fromIso)
      .lt('starts_at', toIso)
      .order('starts_at'),
  )
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const patch = status === 'cancelled' ? { status, cancelled_by: 'professional' } : { status }
  unwrap(await supabase.from('appointments').update(patch).eq('id', id))
}

export interface NewAppointment {
  patient_id: string | null
  starts_at: string
  ends_at: string
  patient_dni: string
  patient_name: string
  patient_email: string | null
  patient_phone: string | null
}

/** Turno cargado por el profesional: puede quedar fuera de sus franjas, pero nunca superponerse con otro vigente. */
export async function createAppointment(input: NewAppointment): Promise<Appointment> {
  return unwrap(
    await supabase
      .from('appointments')
      .insert(input)
      .select('id, patient_id, starts_at, ends_at, status, patient_dni, patient_name, patient_email, patient_phone, cancelled_by')
      .single(),
  )
}
