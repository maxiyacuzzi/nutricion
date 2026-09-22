import { supabase } from './supabase'
import type { MealPlan, MealPlanItem, MealType } from '../types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export async function listPlans(patientId: string): Promise<MealPlan[]> {
  return unwrap(
    await supabase.from('meal_plans').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
  )
}

export async function createPlan(patientId: string, title: string): Promise<MealPlan> {
  return unwrap(await supabase.from('meal_plans').insert({ patient_id: patientId, title }).select().single())
}

export async function renamePlan(id: string, title: string): Promise<void> {
  unwrap(await supabase.from('meal_plans').update({ title }).eq('id', id))
}

export async function deletePlan(id: string): Promise<void> {
  unwrap(await supabase.from('meal_plans').delete().eq('id', id))
}

/** Invalida el link público anterior del plan y devuelve el token nuevo. */
export async function regenerateShareLink(id: string): Promise<string> {
  const row: { share_token: string } = unwrap(
    await supabase.from('meal_plans').update({ share_token: crypto.randomUUID() }).eq('id', id).select('share_token').single(),
  )
  return row.share_token
}

export async function listPlanItems(planId: string): Promise<MealPlanItem[]> {
  return unwrap(await supabase.from('meal_plan_items').select('weekday, meal_type, content').eq('plan_id', planId))
}

/** Guarda una celda de la grilla (día × comida); si queda vacía, se borra en vez de dejar una fila vacía. */
export async function saveCell(planId: string, weekday: number, mealType: MealType, content: string): Promise<void> {
  const text = content.trim()
  if (text === '') {
    unwrap(await supabase.from('meal_plan_items').delete().match({ plan_id: planId, weekday, meal_type: mealType }))
    return
  }
  unwrap(
    await supabase
      .from('meal_plan_items')
      .upsert({ plan_id: planId, weekday, meal_type: mealType, content: text }, { onConflict: 'plan_id,weekday,meal_type' }),
  )
}
