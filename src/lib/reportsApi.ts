import { supabase } from './supabase'

export async function countPatients(): Promise<number> {
  const { count, error } = await supabase.from('patients').select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Pacientes creados entre `fromIso` (incluido) y `toIso` (excluido). */
export async function countNewPatients(fromIso: string, toIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
  if (error) throw new Error(error.message)
  return count ?? 0
}
