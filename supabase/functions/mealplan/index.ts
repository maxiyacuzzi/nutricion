// Edge Function `mealplan`: genera un plan de alimentación semanal con Gemini.
//   POST /generate  (usuario)  → { patient_id, goal? } → crea un meal_plan (source: 'ai') + sus 28 celdas, devuelve su id
//
// El cliente de Supabase se autentica con el token del propio profesional (no service role): las políticas RLS son
// las que deciden qué paciente, medición y notas puede leer, así que este código nunca puede filtrar datos ajenos.
// Secreto: GEMINI_API_KEY (y opcional GEMINI_MODEL, default abajo).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildPrompt, parsePlanItems, RESPONSE_SCHEMA, type PatientContext } from './lib.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const GEMINI_API_KEY = env('GEMINI_API_KEY')
const GEMINI_MODEL = env('GEMINI_MODEL') || 'gemini-3.6-flash'
const MAX_GOAL_CHARS = 300

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

async function askGemini(prompt: string): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.6 },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`gemini ${res.status}: ${body.error?.message ?? 'error desconocido'}`)
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('gemini: respuesta sin contenido')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('gemini: la respuesta no es JSON válido')
  }
}

async function generate(req: Request): Promise<Response> {
  if (!GEMINI_API_KEY) return json({ error: 'gemini_not_configured' }, 500)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const patientId = typeof body.patient_id === 'string' ? body.patient_id : null
  const goal = typeof body.goal === 'string' ? body.goal.trim().slice(0, MAX_GOAL_CHARS) : ''
  if (!patientId) return json({ error: 'patient_id_required' }, 400)

  // Cliente "como el usuario": RLS decide qué puede leer y escribir, nunca este código.
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('full_name, sex, birth_date, height_cm, dietary_restrictions')
    .eq('id', patientId)
    .maybeSingle()
  if (pErr) return json({ error: 'db_error' }, 500)
  if (!patient) return json({ error: 'patient_not_found' }, 404)

  const { data: visits } = await supabase
    .from('visits')
    .select('id')
    .eq('patient_id', patientId)
    .order('visited_at', { ascending: false })
    .limit(1)
  let measurement: PatientContext['measurement'] = null
  if (visits?.[0]) {
    const { data: m } = await supabase
      .from('measurements')
      .select('weight_kg, body_fat_pct, muscle_mass_kg, bmr_kcal')
      .eq('visit_id', visits[0].id)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (m) measurement = m
  }

  const { data: notesRows } = await supabase
    .from('patient_notes')
    .select('body')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(8)

  const ctx: PatientContext = {
    full_name: patient.full_name,
    sex: patient.sex,
    age: ageFrom(patient.birth_date),
    height_cm: patient.height_cm,
    dietary_restrictions: patient.dietary_restrictions,
    measurement,
    notes: (notesRows ?? []).map((n) => n.body as string),
    goal: goal || null,
  }

  let items: ReturnType<typeof parsePlanItems>
  try {
    items = parsePlanItems(await askGemini(buildPrompt(ctx)))
  } catch (e) {
    console.error('gemini', e)
    return json({ error: 'gemini_failed' }, 502)
  }
  if (items.length === 0) return json({ error: 'empty_plan' }, 502)

  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .insert({ patient_id: patientId, title: 'Plan generado con IA', source: 'ai' })
    .select('id')
    .single()
  if (planErr || !plan) return json({ error: 'save_failed' }, 500)

  const { error: itemsErr } = await supabase
    .from('meal_plan_items')
    .insert(items.map((i) => ({ plan_id: plan.id, ...i })))
  if (itemsErr) {
    await supabase.from('meal_plans').delete().eq('id', plan.id) // no dejar un plan vacío
    return json({ error: 'save_failed' }, 500)
  }

  return json({ plan_id: plan.id, cells: items.length })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/mealplan')[1] ?? ''
  try {
    if (req.method === 'POST' && route === '/generate') return await generate(req)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error('error no controlado', e)
    return json({ error: 'internal' }, 500)
  }
})
