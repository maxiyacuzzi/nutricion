import { assert, assertEquals } from 'jsr:@std/assert@1'
import { buildPrompt, parsePlanItems, type PatientContext } from './lib.ts'

const ctx: PatientContext = {
  full_name: 'Carlos Benítez', sex: 'M', age: 41, height_cm: 172,
  dietary_restrictions: 'hipertenso, sin sal agregada',
  measurement: { weight_kg: 142.5, body_fat_pct: 44.2, muscle_mass_kg: 58.1, bmr_kcal: 2340 },
  notes: ['Le cuesta cocinar entre semana, prefiere viandas simples.', 'Refirió reflujo con comidas muy grasas.'],
  goal: 'Bajar de peso de forma sostenida',
}

Deno.test('prompt: incluye datos del paciente, medición, restricciones, objetivo y notas', () => {
  const p = buildPrompt(ctx)
  assert(p.includes('Carlos Benítez') && p.includes('masculino') && p.includes('41 años') && p.includes('172 cm'))
  assert(p.includes('142.5 kg') && p.includes('44.2%') && p.includes('58.1 kg') && p.includes('2340 kcal'))
  assert(p.includes('hipertenso, sin sal agregada'))
  assert(p.includes('Bajar de peso de forma sostenida'))
  assert(p.includes('Le cuesta cocinar entre semana'))
  assert(p.includes('28 celdas'))
})

Deno.test('prompt: sin medición, sin restricciones, sin objetivo y sin notas no rompe ni inventa datos', () => {
  const p = buildPrompt({ ...ctx, measurement: null, dietary_restrictions: null, goal: null, notes: [], age: null })
  assert(p.includes('Todavía no tiene mediciones cargadas'))
  assert(p.includes('Sin restricciones alimenticias registradas'))
  assert(!p.includes('Objetivo indicado'))
  assert(!p.includes('Anotaciones recientes'))
  assert(!p.includes('años'))
})

Deno.test('prompt: recorta a las notas más recientes', () => {
  const many = Array.from({ length: 12 }, (_, i) => `nota ${i}`)
  const p = buildPrompt({ ...ctx, notes: many })
  assert(p.includes('nota 7') && !p.includes('nota 8'))
})

Deno.test('parsePlanItems: caso normal', () => {
  const items = parsePlanItems({ items: [{ weekday: 1, meal_type: 'desayuno', content: 'Avena con leche' }] })
  assertEquals(items, [{ weekday: 1, meal_type: 'desayuno', content: 'Avena con leche' }])
})

Deno.test('parsePlanItems: descarta filas inválidas sin tirar el resto', () => {
  const items = parsePlanItems({
    items: [
      { weekday: 1, meal_type: 'desayuno', content: 'Avena' }, // válida
      { weekday: 9, meal_type: 'desayuno', content: 'x' }, // weekday fuera de rango
      { weekday: 1, meal_type: 'brunch', content: 'x' }, // meal_type inválido
      { weekday: 1, meal_type: 'cena', content: '' }, // vacía
      { weekday: '2', meal_type: 'cena', content: 'Pollo' }, // weekday como string numérico: se acepta
      { meal_type: 'cena', content: 'x' }, // sin weekday
    ],
  })
  assertEquals(items.sort((a, b) => a.weekday - b.weekday), [
    { weekday: 1, meal_type: 'desayuno', content: 'Avena' },
    { weekday: 2, meal_type: 'cena', content: 'Pollo' },
  ])
})

Deno.test('parsePlanItems: celda repetida se queda con la última', () => {
  const items = parsePlanItems({
    items: [
      { weekday: 1, meal_type: 'desayuno', content: 'primera' },
      { weekday: 1, meal_type: 'desayuno', content: 'segunda' },
    ],
  })
  assertEquals(items, [{ weekday: 1, meal_type: 'desayuno', content: 'segunda' }])
})

Deno.test('parsePlanItems: recorta contenido demasiado largo', () => {
  const items = parsePlanItems({ items: [{ weekday: 0, meal_type: 'almuerzo', content: 'x'.repeat(900) }] })
  assertEquals(items[0].content.length, 500)
})

Deno.test('parsePlanItems: entradas no válidas devuelven lista vacía sin lanzar', () => {
  assertEquals(parsePlanItems(null), [])
  assertEquals(parsePlanItems({}), [])
  assertEquals(parsePlanItems({ items: 'no es un array' }), [])
  assertEquals(parsePlanItems({ items: ['no es un objeto'] }), [])
})
