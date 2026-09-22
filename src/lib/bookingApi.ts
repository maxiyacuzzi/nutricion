import { supabase } from './supabase'
import type { AppointmentInfo, BookingResult, PublicProfessional, Slot } from '../types'

/** Traduce los errores que devuelven las funciones de reserva a mensajes para el paciente. */
export function bookingErrorMessage(message: string): string {
  switch (message) {
    case 'slot_unavailable': return 'Ese horario acaba de ser tomado. Elegí otro, por favor.'
    case 'too_many_appointments': return 'Ya tenés 2 turnos pendientes con este profesional. Cancelá uno o esperá a que pase.'
    case 'invalid_input': return 'Revisá los datos: DNI (solo números), nombre completo y, si lo completás, un email válido.'
    case 'not_found': return 'Esta agenda no está disponible.'
    case 'cannot_cancel': return 'Este turno ya no se puede cancelar (ya pasó o ya estaba cancelado).'
    default: return 'No pudimos completar la operación. Intentá de nuevo en unos minutos.'
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** null si el profesional no existe o tiene la reserva desactivada. */
export async function getPublicProfessional(slug: string): Promise<PublicProfessional | null> {
  const rows = await rpc<PublicProfessional[]>('get_professional', { p_slug: slug })
  return rows[0] ?? null
}

export function listSlots(slug: string, from: string, to: string): Promise<Slot[]> {
  return rpc<Slot[]>('available_slots', { p_slug: slug, p_from: from, p_to: to })
}

export interface BookingInput {
  slug: string
  startsAt: string
  dni: string
  name: string
  email: string
  phone: string
}

export function book(i: BookingInput): Promise<BookingResult> {
  return rpc<BookingResult>('book_appointment', {
    p_slug: i.slug, p_starts_at: i.startsAt, p_dni: i.dni, p_name: i.name, p_email: i.email, p_phone: i.phone,
  })
}

export function getAppointment(token: string): Promise<AppointmentInfo | null> {
  return rpc<AppointmentInfo | null>('get_appointment_by_token', { p_token: token })
}

export async function cancelAppointment(token: string): Promise<void> {
  await rpc('cancel_appointment_by_token', { p_token: token })
}
