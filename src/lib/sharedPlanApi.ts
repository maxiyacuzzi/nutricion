import { supabase } from './supabase'
import type { SharedMealPlan } from '../types'

/** Lectura pública (sin sesión) del plan a partir de su link para compartir. null si el token no existe. */
export async function getSharedPlan(token: string): Promise<SharedMealPlan | null> {
  const { data, error } = await supabase.rpc('get_shared_meal_plan', { p_token: token })
  if (error) throw new Error(error.message)
  return (data as SharedMealPlan | null) ?? null
}
