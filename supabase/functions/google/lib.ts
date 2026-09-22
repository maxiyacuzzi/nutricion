// Helpers puros de la integración con Google Calendar (sin red ni acceso a Deno.*), para poder probarlos.

const enc = new TextEncoder()
const dec = new TextDecoder()

// ---------- base64 ----------
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

// ---------- cifrado de tokens (AES-GCM 256) ----------
async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64)
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY debe ser de 32 bytes en base64')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Devuelve `v1.<iv>.<ciphertext>` (base64). Cada cifrado usa un IV aleatorio nuevo. */
export async function encryptToken(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(plain)))
  return `v1.${b64(iv)}.${b64(ct)}`
}

export async function decryptToken(blob: string, keyB64: string): Promise<string> {
  const [version, iv, ct] = blob.split('.')
  if (version !== 'v1' || !iv || !ct) throw new Error('Formato de token inválido')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(keyB64), unb64(ct))
  return dec.decode(plain)
}

// ---------- "state" firmado del flujo OAuth ----------
export interface OAuthState {
  uid: string
  exp: number // epoch ms
  nonce: string
}

const hmacKey = (keyB64: string) =>
  crypto.subtle.importKey('raw', enc.encode(`state:${keyB64}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export async function signState(payload: OAuthState, keyB64: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(keyB64), enc.encode(body)))
  return `${body}.${b64url(sig)}`
}

/** null si la firma no coincide, el formato es inválido o ya venció. */
export async function verifyState(state: string, keyB64: string, now = Date.now()): Promise<OAuthState | null> {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(keyB64), unb64url(sig), enc.encode(body))
    if (!ok) return null
    const payload = JSON.parse(dec.decode(unb64url(body))) as OAuthState
    return payload.exp > now && typeof payload.uid === 'string' ? payload : null
  } catch {
    return null
  }
}

/** Comparación de strings en tiempo constante (para el secreto del webhook). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Email del `id_token` de Google (llega directo desde Google por TLS, por eso no se revalida la firma). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(dec.decode(unb64url(idToken!.split('.')[1])))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

// ---------- zonas horarias ----------
function tzOffsetMs(ts: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  )
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000
}

/** "2026-09-22" + "10:30" en `tz` → instante ISO (UTC). */
export function zonedToIso(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let ts = guess - tzOffsetMs(guess, tz)
  const fixed = guess - tzOffsetMs(ts, tz)
  if (fixed !== ts) ts = fixed
  return new Date(ts).toISOString()
}

// ---------- app -> Google: armado del evento ----------
export interface AppointmentRow {
  id: string
  patient_id: string | null
  starts_at: string
  ends_at: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  patient_dni: string
  patient_name: string
  patient_email: string | null
  patient_phone: string | null
}

/** Google acepta ids propios de 5–1024 caracteres en base32hex (0-9 a-v): el UUID sin guiones sirve y es estable. */
export const eventId = (appointmentId: string) => appointmentId.replace(/-/g, '').toLowerCase()

/** Un turno cancelado no tiene evento; los demás estados sí (asistió / no vino quedan como registro). */
export const shouldHaveEvent = (status: AppointmentRow['status']) => status !== 'cancelled'

export function buildEvent(a: AppointmentRow, tz: string, appUrl: string) {
  const lines = [`DNI: ${a.patient_dni}`]
  if (a.patient_phone) lines.push(`Tel: ${a.patient_phone}`)
  if (a.patient_email) lines.push(`Email: ${a.patient_email}`)
  if (a.patient_id) lines.push(`Ficha: ${appUrl}/pacientes/${a.patient_id}`)
  lines.push('', 'Sincronizado desde Nutrición')
  return {
    summary: `Turno: ${a.patient_name}`,
    description: lines.join('\n'),
    start: { dateTime: a.starts_at, timeZone: tz },
    end: { dateTime: a.ends_at, timeZone: tz },
    status: 'confirmed',
    transparency: 'opaque',
    reminders: { useDefault: true },
    // Con email, el paciente queda como invitado: Google le manda la invitación (y el aviso si se cancela).
    ...(a.patient_email ? { attendees: [{ email: a.patient_email, displayName: a.patient_name }] } : {}),
    // Marca para reconocer nuestros propios eventos al leer el calendario (ya están en `appointments`).
    extendedProperties: { private: { nutricion: '1', appointment_id: a.id } },
  }
}

// ---------- Google -> app: horarios ocupados ----------
export interface GoogleEvent {
  status?: string
  transparency?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

export interface BusyBlock {
  starts_at: string
  ends_at: string
}

/**
 * Eventos de Google que ocupan al profesional. Se ignoran: cancelados, marcados como "Libre", rechazados por el
 * profesional y los que creó esta misma app (esos ya bloquean vía `appointments`). Los de día completo bloquean
 * el día entero (hora local del profesional) sólo si están marcados como "Ocupado".
 */
export function toBusyBlocks(events: GoogleEvent[], tz: string): BusyBlock[] {
  const out: BusyBlock[] = []
  for (const e of events) {
    if (e.status === 'cancelled' || e.transparency === 'transparent') continue
    if (e.extendedProperties?.private?.nutricion === '1') continue
    if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue

    if (e.start?.dateTime && e.end?.dateTime) {
      out.push({ starts_at: new Date(e.start.dateTime).toISOString(), ends_at: new Date(e.end.dateTime).toISOString() })
    } else if (e.start?.date && e.end?.date) {
      out.push({ starts_at: zonedToIso(e.start.date, '00:00', tz), ends_at: zonedToIso(e.end.date, '00:00', tz) })
    }
  }
  return out
}
