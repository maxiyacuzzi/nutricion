import { supabase } from './supabase'

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mealplan`

/** Motivos con los que puede fallar la generación con IA. */
export function mealplanErrorMessage(code: string): string {
  switch (code) {
    case 'gemini_not_configured': return 'Falta configurar la IA en el servidor.'
    case 'gemini_failed': return 'La IA no pudo generar el plan. Probá de nuevo en un momento.'
    case 'empty_plan': return 'La IA no devolvió ningún plato válido. Probá de nuevo.'
    case 'patient_not_found': return 'No se encontró el paciente.'
    case 'save_failed': return 'Se generó el plan pero no se pudo guardar. Probá de nuevo.'
    default: return 'No se pudo generar el plan. Probá de nuevo.'
  }
}

/** Genera un plan con IA a partir de las restricciones, la última medición y las anotaciones del paciente. */
export async function generatePlanWithAI(patientId: string, goal: string): Promise<{ plan_id: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('unauthorized')
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ patient_id: patientId, goal }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'error')
  return json
}
