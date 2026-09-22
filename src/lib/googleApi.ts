import { supabase } from './supabase'

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google`

export interface GoogleStatus {
  connected: boolean
  email?: string
  block_busy?: boolean
  connected_at?: string
}

/** Motivos con los que la Edge Function vuelve a la app (`?google=error&reason=...`). */
export const GOOGLE_ERRORS: Record<string, string> = {
  access_denied: 'Cancelaste la autorización en Google.',
  missing_calendar_scope: 'Tenés que dejar marcado el permiso de acceso al calendario para poder sincronizar.',
  no_refresh_token: 'Google no entregó el acceso permanente. Probá conectar de nuevo.',
  not_configured: 'Faltan las credenciales de Google en el servidor.',
  token_exchange: 'Google rechazó la conexión. Probá de nuevo.',
  invalid_state: 'La solicitud venció. Probá conectar de nuevo.',
  save_failed: 'No se pudo guardar la conexión. Probá de nuevo.',
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'error')
  return json as T
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const { data, error } = await supabase.rpc('get_google_status')
  if (error) throw new Error(error.message)
  return data as GoogleStatus
}

export async function setBlockBusy(block: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_google_block_busy', { p_block: block })
  if (error) throw new Error(error.message)
}

/** URL de consentimiento de Google a la que hay que redirigir al profesional. */
export async function startGoogleConnect(): Promise<string> {
  return (await call<{ url: string }>('/connect')).url
}

export const resyncGoogle = () => call<{ synced: number; failed: number }>('/resync')

export const disconnectGoogle = () => call<{ ok: true }>('/disconnect')

/**
 * Pide al servidor que actualice los horarios ocupados del calendario del profesional antes de mostrar los turnos
 * libres. Es "mejor esfuerzo": si tarda o falla, la reserva sigue con la última copia.
 */
export async function refreshBusy(slug: string): Promise<void> {
  try {
    await Promise.race([
      call('/busy', { slug }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
  } catch {
    /* sin efecto: se usa la copia anterior */
  }
}
