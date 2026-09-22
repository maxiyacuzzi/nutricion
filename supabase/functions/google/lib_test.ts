import { assert, assertEquals, assertNotEquals, assertRejects } from 'jsr:@std/assert@1'
import {
  buildEvent, decryptToken, emailFromIdToken, encryptToken, eventId, shouldHaveEvent, signState, timingSafeEqual,
  toBusyBlocks, verifyState, zonedToIso, type AppointmentRow,
} from './lib.ts'

const KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
const OTHER_KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
const TZ = 'America/Argentina/Buenos_Aires'

Deno.test('cifrado: ida y vuelta, IV distinto cada vez y clave equivocada falla', async () => {
  const a = await encryptToken('1//refresh-token', KEY)
  const b = await encryptToken('1//refresh-token', KEY)
  assertEquals(await decryptToken(a, KEY), '1//refresh-token')
  assertNotEquals(a, b)
  assert(!a.includes('refresh-token'))
  await assertRejects(() => decryptToken(a, OTHER_KEY))
  await assertRejects(() => decryptToken(a.slice(0, -3) + 'AAA', KEY)) // texto alterado
  await assertRejects(() => encryptToken('x', btoa('corta')))
})

Deno.test('state OAuth: válido, alterado, vencido y con otra clave', async () => {
  const now = 1_000_000
  const s = await signState({ uid: 'u1', exp: now + 600_000, nonce: 'n' }, KEY)
  assertEquals((await verifyState(s, KEY, now))?.uid, 'u1')
  assertEquals(await verifyState(s, KEY, now + 700_000), null) // vencido
  assertEquals(await verifyState(s, OTHER_KEY, now), null)
  const [body, sig] = s.split('.')
  const forged = btoa(JSON.stringify({ uid: 'otro', exp: now + 600_000, nonce: 'n' })).replace(/=+$/, '')
  assertEquals(await verifyState(`${forged}.${sig}`, KEY, now), null) // payload cambiado con la firma vieja
  assertEquals(await verifyState(`${body}.`, KEY, now), null)
  assertEquals(await verifyState('basura', KEY, now), null)
})

Deno.test('timingSafeEqual', () => {
  assert(timingSafeEqual('abc123', 'abc123'))
  assert(!timingSafeEqual('abc123', 'abc124'))
  assert(!timingSafeEqual('abc', 'abc123'))
  assert(!timingSafeEqual('', 'x'))
})

Deno.test('email desde id_token', () => {
  const payload = btoa(JSON.stringify({ email: 'pro@gmail.com' })).replace(/=+$/, '')
  assertEquals(emailFromIdToken(`h.${payload}.s`), 'pro@gmail.com')
  assertEquals(emailFromIdToken(undefined), null)
  assertEquals(emailFromIdToken('roto'), null)
})

const appt: AppointmentRow = {
  id: '3f2c9a10-1b2d-4e5f-8a9b-0c1d2e3f4a5b', patient_id: 'p-1', starts_at: '2026-09-22T13:30:00+00:00',
  ends_at: '2026-09-22T14:00:00+00:00', status: 'confirmed', patient_dni: '28457119', patient_name: 'Carlos Benítez',
  patient_email: 'c@x.com', patient_phone: '11 5555 0101',
}

Deno.test('evento: id válido para Google, contenido y marca propia', () => {
  const id = eventId(appt.id)
  assertEquals(id, '3f2c9a101b2d4e5f8a9b0c1d2e3f4a5b')
  assert(/^[0-9a-v]{5,1024}$/.test(id)) // base32hex que exige Google
  const ev = buildEvent(appt, TZ, 'https://app.example')
  assertEquals(ev.summary, 'Turno: Carlos Benítez')
  assertEquals(ev.start, { dateTime: '2026-09-22T13:30:00+00:00', timeZone: TZ })
  assert(ev.description.includes('DNI: 28457119') && ev.description.includes('Tel: 11 5555 0101'))
  assert(ev.description.includes('https://app.example/pacientes/p-1'))
  assertEquals(ev.extendedProperties.private.nutricion, '1')
  assertEquals(ev.attendees, [{ email: 'c@x.com', displayName: 'Carlos Benítez' }])
  // sin datos opcionales no deja líneas vacías con etiqueta, y sin email no hay invitado
  const bare = buildEvent({ ...appt, patient_email: null, patient_phone: null, patient_id: null }, TZ, 'https://app.example')
  assert(!bare.description.includes('Tel:') && !bare.description.includes('Email:') && !bare.description.includes('Ficha:'))
  assertEquals('attendees' in bare, false)
})

Deno.test('qué estados tienen evento', () => {
  assert(shouldHaveEvent('confirmed') && shouldHaveEvent('completed') && shouldHaveEvent('no_show'))
  assert(!shouldHaveEvent('cancelled'))
})

Deno.test('zonedToIso', () => {
  assertEquals(zonedToIso('2026-09-22', '10:30', TZ), '2026-09-22T13:30:00.000Z')
  assertEquals(zonedToIso('2026-07-01', '09:00', 'Europe/Madrid'), '2026-07-01T07:00:00.000Z')
})

Deno.test('ocupados: filtra libres, cancelados, rechazados y eventos propios; convierte día completo', () => {
  const blocks = toBusyBlocks(
    [
      { start: { dateTime: '2026-09-22T10:00:00-03:00' }, end: { dateTime: '2026-09-22T11:00:00-03:00' } }, // ocupa
      { transparency: 'transparent', start: { dateTime: '2026-09-22T12:00:00-03:00' }, end: { dateTime: '2026-09-22T13:00:00-03:00' } }, // libre
      { status: 'cancelled', start: { dateTime: '2026-09-22T14:00:00-03:00' }, end: { dateTime: '2026-09-22T15:00:00-03:00' } },
      { attendees: [{ self: true, responseStatus: 'declined' }], start: { dateTime: '2026-09-22T16:00:00-03:00' }, end: { dateTime: '2026-09-22T17:00:00-03:00' } },
      { extendedProperties: { private: { nutricion: '1' } }, start: { dateTime: '2026-09-22T18:00:00-03:00' }, end: { dateTime: '2026-09-22T18:30:00-03:00' } }, // propio
      { start: { date: '2026-09-24' }, end: { date: '2026-09-25' } }, // día completo "Ocupado"
      { transparency: 'transparent', start: { date: '2026-09-26' }, end: { date: '2026-09-27' } }, // día completo "Libre"
      { start: {}, end: {} }, // sin fechas
    ],
    TZ,
  )
  assertEquals(blocks, [
    { starts_at: '2026-09-22T13:00:00.000Z', ends_at: '2026-09-22T14:00:00.000Z' },
    { starts_at: '2026-09-24T03:00:00.000Z', ends_at: '2026-09-25T03:00:00.000Z' },
  ])
})
