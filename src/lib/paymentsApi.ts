import { supabase } from './supabase'
import type { Payment, PaymentInput, PaymentWithPatient } from '../types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

/** Pagos con nombre de paciente, entre `from` (incluido) y `to` (excluido), de "YYYY-MM-DD". */
export async function listPayments(from: string, to: string): Promise<PaymentWithPatient[]> {
  const rows: (Payment & { patients: { full_name: string } | null })[] = unwrap(
    await supabase
      .from('payments')
      .select('*, patients(full_name)')
      .gte('paid_on', from)
      .lt('paid_on', to)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false }),
  )
  return rows.map(({ patients, ...p }) => ({ ...p, patient_name: patients?.full_name ?? '—' }))
}

export async function listPatientPayments(patientId: string): Promise<Payment[]> {
  return unwrap(
    await supabase.from('payments').select('*').eq('patient_id', patientId).order('paid_on', { ascending: false }),
  )
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  return unwrap(await supabase.from('payments').insert(input).select().single())
}

export async function deletePayment(id: string): Promise<void> {
  unwrap(await supabase.from('payments').delete().eq('id', id))
}
