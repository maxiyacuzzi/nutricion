import { jsPDF } from 'jspdf'
import type { Measurement, Patient, Visit } from '../types'
import { ageFrom, fatRange, waterRange } from './ranges'

const dash = (v: number | null, unit = '') => (v === null ? '—' : `${v}${unit ? ` ${unit}` : ''}`)

export function downloadReport(patient: Patient, visit: Visit, m: Measurement) {
  const doc = new jsPDF()
  const left = 16
  let y = 20

  const line = (text: string, size = 11, bold = false, gap = 7) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(text, left, y)
    y += gap
  }
  const row = (label: string, value: string, hint = '') => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(label, left, y)
    doc.text(value, left + 70, y)
    if (hint) {
      doc.setTextColor(120)
      doc.text(hint, left + 110, y)
      doc.setTextColor(0)
    }
    y += 6.5
  }

  line('Reporte de composición corporal', 18, true, 10)
  line(patient.full_name, 14, true)
  const age = ageFrom(patient.birth_date)
  line(`DNI ${patient.dni}  |  Edad: ${age ?? '—'}  |  Altura: ${patient.height_cm} cm`, 10, false, 5)
  line(`Visita: ${new Date(visit.visited_at).toLocaleString('es-AR')}`, 10, false, 10)

  const [fLo, fHi] = fatRange(patient.sex)
  const [wLo, wHi] = waterRange(patient.sex)

  line('Valores generales', 13, true)
  row('Peso', dash(m.weight_kg, 'kg'))
  row('Valoración física', dash(m.physical_rating), '1-3 bajo · 4-6 normal · 7-9 alto')
  row('Grasa corporal', dash(m.body_fat_pct, '%'), `saludable ${fLo}-${fHi}%`)
  row('Agua corporal', dash(m.body_water_pct, '%'), `rango ${wLo}-${wHi}%`)
  row('Masa muscular', dash(m.muscle_mass_kg, 'kg'))
  row('Masa ósea', dash(m.bone_mass_kg, 'kg'), 'normal >= 2.95 kg')
  row('Grasa visceral', dash(m.visceral_fat), 'saludable 1-12')
  y += 4

  line('Análisis segmental', 13, true)
  const seg: [string, number | null, number | null][] = [
    ['Tronco', m.muscle_trunk_kg, m.fat_trunk_pct],
    ['Brazo derecho', m.muscle_right_arm_kg, m.fat_right_arm_pct],
    ['Brazo izquierdo', m.muscle_left_arm_kg, m.fat_left_arm_pct],
    ['Pierna derecha', m.muscle_right_leg_kg, m.fat_right_leg_pct],
    ['Pierna izquierda', m.muscle_left_leg_kg, m.fat_left_leg_pct],
  ]
  for (const [name, kg, fat] of seg) row(name, `${dash(kg, 'kg')} magra`, `grasa ${dash(fat, '%')}`)
  y += 4

  line('Metabolismo', 13, true)
  row('DCI / BMR', dash(m.bmr_kcal, 'kcal'))
  row('Edad metabólica', dash(m.metabolic_age, 'años'))

  if (patient.dietary_restrictions) {
    y += 4
    line('Restricciones alimenticias', 13, true)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(patient.dietary_restrictions, 180), left, y)
  }

  doc.save(`reporte-${patient.dni}-${visit.visited_at.slice(0, 10)}.pdf`)
}
