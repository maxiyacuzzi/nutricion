// Edge Function `google`: integración con Google Calendar. Rutas (después de /functions/v1/google):
//   POST /connect     (usuario)  → devuelve la URL de consentimiento de Google
//   GET  /callback    (Google)   → intercambia el código, guarda el refresh token cifrado y vuelve a la app
//   POST /sync        (trigger)  → crea/actualiza/borra el evento de un turno   [x-webhook-secret o usuario]
//   POST /resync      (usuario)  → envía a Google todos los turnos próximos
//   POST /busy        (público)  → refresca la copia de horarios ocupados del profesional (máx. 1 vez por minuto)
//   POST /disconnect  (usuario)  → revoca el acceso y borra la conexión
//
// Se despliega con verify_jwt = false (ver supabase/config.toml): la autenticación se hace acá, ruta por ruta.
// Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, APP_URL
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase).
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildEvent, decryptToken, emailFromIdToken, encryptToken, eventId, shouldHaveEvent, signState, timingSafeEqual,
  toBusyBlocks, verifyState, type AppointmentRow, type GoogleEvent,
} from './lib.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const SUPABASE_URL = env('SUPABASE_URL')
const CLIENT_ID = env('GOOGLE_CLIENT_ID')
const CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET')
const ENC_KEY = env('TOKEN_ENCRYPTION_KEY')
const APP_URL = (env('APP_URL') || 'http://localhost:5173').replace(/\/$/, '')
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google/callback`
// calendar.events: crear/editar/borrar eventos y listarlos. Es el permiso mínimo que necesitamos.
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
const BUSY_TTL_MS = 60_000

const admin = createClient(SUPABASE_URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } })

const configured = () => Boolean(CLIENT_ID && CLIENT_SECRET && ENC_KEY)

// ---------------------------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------------------------
async function userFrom(req: Request): Promise<{ id: string; googleEmail: string | null } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const identity = data.user.identities?.find((i) => i.provider === 'google')
  const googleEmail = (identity?.identity_data?.email as string | undefined) ?? null
  return { id: data.user.id, googleEmail }
}

async function isWebhook(req: Request): Promise<boolean> {
  const got = req.headers.get('x-webhook-secret')
  if (!got) return false
  const { data } = await admin.from('app_settings').select('value').eq('key', 'webhook_secret').maybeSingle()
  return Boolean(data?.value) && timingSafeEqual(got, data!.value)
}

// ---------------------------------------------------------------------------------------------
// Google: tokens y llamadas a la API
// ---------------------------------------------------------------------------------------------
interface Connection {
  professional_id: string
  google_email: string
  refresh_token_enc: string
  calendar_id: string
  block_busy: boolean
  busy_synced_at: string | null
}

async function loadConnection(professionalId: string): Promise<Connection | null> {
  const { data } = await admin.from('google_connections').select('*').eq('professional_id', professionalId).maybeSingle()
  return data
}

async function dropConnection(professionalId: string) {
  await admin.from('external_busy').delete().eq('professional_id', professionalId)
  await admin.from('google_connections').delete().eq('professional_id', professionalId)
}

const tokenCache = new Map<string, string>()

/** Access token vigente del profesional. Si Google revocó el acceso (invalid_grant) se elimina la conexión. */
async function accessToken(conn: Connection): Promise<string | null> {
  const cached = tokenCache.get(conn.professional_id)
  if (cached) return cached
  const refresh = await decryptToken(conn.refresh_token_enc, ENC_KEY)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (body.error === 'invalid_grant') await dropConnection(conn.professional_id)
    console.error('refresh token falló', res.status, body.error)
    return null
  }
  tokenCache.set(conn.professional_id, body.access_token)
  return body.access_token
}

const gcal = (token: string, path: string, init: RequestInit = {}) =>
  fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })

// ---------------------------------------------------------------------------------------------
// app -> Google
// ---------------------------------------------------------------------------------------------
/**
 * `notify` controla si Google le avisa por email al paciente (invitado del evento): true en una reserva o un
 * cambio real (lo dispara el trigger de la base); false en la sincronización masiva, para no reenviar una
 * invitación por cada turno que ya existía al conectar la cuenta.
 */
async function syncAppointment(id: string, notify: boolean): Promise<string> {
  const { data: a } = await admin.from('appointments').select('*, professionals(timezone)').eq('id', id).maybeSingle()
  if (!a) return 'appointment_not_found'
  const conn = await loadConnection(a.professional_id)
  if (!conn) return 'no_connection'
  const token = await accessToken(conn)
  if (!token) return 'no_token'

  const cal = encodeURIComponent(conn.calendar_id)
  const evId = eventId(a.id)
  const row = a as AppointmentRow
  const sendUpdates = notify ? 'all' : 'none'

  if (!shouldHaveEvent(row.status)) {
    const res = await gcal(token, `/calendars/${cal}/events/${evId}?sendUpdates=${sendUpdates}`, { method: 'DELETE' })
    if (![200, 204, 404, 410].includes(res.status)) throw new Error(`delete ${res.status}: ${await res.text()}`)
    return 'deleted'
  }

  const event = buildEvent(row, a.professionals?.timezone ?? 'America/Argentina/Buenos_Aires', APP_URL)
  const created = await gcal(token, `/calendars/${cal}/events?sendUpdates=${sendUpdates}`, { method: 'POST', body: JSON.stringify({ id: evId, ...event }) })
  if (created.ok) return 'created'
  if (created.status !== 409) throw new Error(`insert ${created.status}: ${await created.text()}`)

  // Ya existía (o quedó como cancelado en Google): actualizar. `status: confirmed` lo restaura si estaba borrado.
  const patched = await gcal(token, `/calendars/${cal}/events/${evId}?sendUpdates=${sendUpdates}`, { method: 'PATCH', body: JSON.stringify(event) })
  if (!patched.ok) throw new Error(`patch ${patched.status}: ${await patched.text()}`)
  return 'updated'
}

async function resyncAll(professionalId: string): Promise<{ synced: number; failed: number }> {
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data } = await admin
    .from('appointments')
    .select('id')
    .eq('professional_id', professionalId)
    .gte('starts_at', since)
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(500)
  let synced = 0
  let failed = 0
  const ids = (data ?? []).map((r) => r.id as string)
  for (let i = 0; i < ids.length; i += 4) {
    // notify=false: son turnos que ya existían, el paciente no tiene por qué recibir una invitación de golpe.
    const results = await Promise.allSettled(ids.slice(i, i + 4).map((id) => syncAppointment(id, false)))
    for (const r of results) {
      if (r.status === 'fulfilled') {
        synced++
      } else {
        failed++
        console.error('resync', r.reason)
      }
    }
  }
  return { synced, failed }
}

// ---------------------------------------------------------------------------------------------
// Google -> app
// ---------------------------------------------------------------------------------------------
async function refreshBusy(slug: string): Promise<{ refreshed: boolean }> {
  const { data: pro } = await admin
    .from('professionals')
    .select('id, timezone, max_days_ahead')
    .eq('slug', slug)
    .eq('booking_enabled', true)
    .maybeSingle()
  if (!pro) return { refreshed: false }
  const conn = await loadConnection(pro.id)
  if (!conn || !conn.block_busy) return { refreshed: false }
  if (conn.busy_synced_at && Date.now() - new Date(conn.busy_synced_at).getTime() < BUSY_TTL_MS) return { refreshed: false }

  const token = await accessToken(conn)
  if (!token) return { refreshed: false }

  const events: GoogleEvent[] = []
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + (pro.max_days_ahead + 1) * 86_400_000).toISOString()
  let pageToken: string | undefined
  for (let page = 0; page < 8; page++) {
    const q = new URLSearchParams({
      timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', showDeleted: 'false',
      fields: 'nextPageToken,items(status,transparency,start,end,extendedProperties/private,attendees(self,responseStatus))',
    })
    if (pageToken) q.set('pageToken', pageToken)
    const res = await gcal(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events?${q}`)
    if (!res.ok) {
      console.error('events.list', res.status, await res.text())
      return { refreshed: false } // ante un error se conserva la copia anterior
    }
    const body = await res.json()
    events.push(...(body.items ?? []))
    pageToken = body.nextPageToken
    if (!pageToken) break
  }

  const { error } = await admin.rpc('replace_external_busy', { p_professional: pro.id, p_rows: toBusyBlocks(events, pro.timezone) })
  if (error) {
    console.error('replace_external_busy', error.message)
    return { refreshed: false }
  }
  return { refreshed: true }
}

// ---------------------------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------------------------
async function connect(req: Request) {
  if (!configured()) return json({ error: 'google_not_configured' }, 500)
  const user = await userFrom(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const { data: pro } = await admin.from('professionals').select('id').eq('id', user.id).maybeSingle()
  if (!pro) return json({ error: 'no_professional' }, 400)

  const state = await signState({ uid: user.id, exp: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() }, ENC_KEY)
  const params = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  })
  // Si el profesional inició sesión con Google, Google ofrece directamente esa misma cuenta (puede elegir otra).
  if (user.googleEmail) params.set('login_hint', user.googleEmail)
  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
}

async function callback(req: Request) {
  const back = (result: string, reason?: string) =>
    redirect(`${APP_URL}/turnos?google=${result}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`)
  const url = new URL(req.url)
  if (url.searchParams.get('error')) return back('error', url.searchParams.get('error')!)
  if (!configured()) return back('error', 'not_configured')

  const state = await verifyState(url.searchParams.get('state') ?? '', ENC_KEY)
  const code = url.searchParams.get('code')
  if (!state || !code) return back('error', 'invalid_state')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  })
  const tokens = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('intercambio de código falló', res.status, tokens.error)
    return back('error', 'token_exchange')
  }
  // El usuario puede desmarcar el permiso de calendario en la pantalla de Google.
  if (!String(tokens.scope ?? '').includes('calendar.events')) return back('error', 'missing_calendar_scope')
  if (!tokens.refresh_token) return back('error', 'no_refresh_token')

  const { error } = await admin.from('google_connections').upsert({
    professional_id: state.uid,
    google_email: emailFromIdToken(tokens.id_token) ?? 'cuenta de Google',
    refresh_token_enc: await encryptToken(tokens.refresh_token, ENC_KEY),
    calendar_id: 'primary',
    block_busy: true,
    connected_at: new Date().toISOString(),
    busy_synced_at: null,
  })
  if (error) {
    console.error('guardar conexión', error.message)
    return back('error', 'save_failed')
  }
  tokenCache.delete(state.uid)
  try {
    await resyncAll(state.uid) // los turnos que ya existían pasan a Google al conectar
  } catch (e) {
    console.error('resync inicial', e)
  }
  return back('connected')
}

async function sync(req: Request) {
  const body = await req.json().catch(() => ({}))
  const id = typeof body.appointment_id === 'string' ? body.appointment_id : null
  if (!id) return json({ error: 'appointment_id_required' }, 400)

  if (!(await isWebhook(req))) {
    const user = await userFrom(req)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const { data } = await admin.from('appointments').select('professional_id').eq('id', id).maybeSingle()
    if (data?.professional_id !== user.id) return json({ error: 'forbidden' }, 403)
  }
  try {
    return json({ result: await syncAppointment(id, true) })
  } catch (e) {
    console.error('sync', id, e)
    return json({ error: 'sync_failed' }, 502)
  }
}

async function resync(req: Request) {
  const user = await userFrom(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  if (!(await loadConnection(user.id))) return json({ error: 'not_connected' }, 400)
  return json(await resyncAll(user.id))
}

async function busy(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (typeof body.slug !== 'string' || body.slug.length > 60) return json({ error: 'slug_required' }, 400)
  try {
    return json(await refreshBusy(body.slug))
  } catch (e) {
    console.error('busy', e)
    return json({ refreshed: false }) // la reserva sigue funcionando con la copia anterior
  }
}

async function disconnect(req: Request) {
  const user = await userFrom(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const conn = await loadConnection(user.id)
  if (conn) {
    try {
      const refresh = await decryptToken(conn.refresh_token_enc, ENC_KEY)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' })
    } catch (e) {
      console.error('revocar', e) // si falla igual se elimina la conexión local
    }
    await dropConnection(user.id)
    tokenCache.delete(user.id)
  }
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const route = new URL(req.url).pathname.split('/google')[1] ?? ''
  try {
    if (req.method === 'GET' && route === '/callback') return await callback(req)
    if (req.method === 'POST') {
      if (route === '/connect') return await connect(req)
      if (route === '/sync') return await sync(req)
      if (route === '/resync') return await resync(req)
      if (route === '/busy') return await busy(req)
      if (route === '/disconnect') return await disconnect(req)
    }
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error('error no controlado', e)
    return json({ error: 'internal' }, 500)
  }
})
