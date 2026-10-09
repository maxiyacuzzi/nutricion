import { jsPDF } from 'jspdf'
import type { MealPlan, MealPlanItem, MealType, Patient } from '../types'
import { WEEK_ORDER, WEEKDAYS_LONG } from './time'
import { seasonOf, seasonTheme } from './season'
import { PRACTITIONER_LICENSE, PRACTITIONER_NAME } from './branding'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'desayuno', label: 'Desayuno' },
  { type: 'almuerzo', label: 'Almuerzo' },
  { type: 'merienda', label: 'Merienda' },
  { type: 'cena', label: 'Cena' },
]

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function downloadMealPlanReport(patient: Patient, plan: MealPlan, items: MealPlanItem[]) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const theme = seasonTheme(seasonOf(plan.created_at))
  const [bgR, bgG, bgB] = hexToRgb(theme.bg)
  const [onBgR, onBgG, onBgB] = hexToRgb(theme.onBg)
  const [accR, accG, accB] = hexToRgb(theme.accent)
  const [onAccR, onAccG, onAccB] = hexToRgb(theme.onAccent)

  const left = 10
  const pageW = 297
  const bandH = 26
  const titleX = left + 50
  let y = 0

  // Banda de encabezado, coloreada según la estación del plan.
  doc.setFillColor(bgR, bgG, bgB)
  doc.rect(0, 0, pageW, bandH, 'F')
  doc.setTextColor(onBgR, onBgG, onBgB)

  // Firma del profesional, en su propia columna angosta para no pisar el título.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(PRACTITIONER_NAME, left, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(PRACTITIONER_LICENSE, left, 15.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`Menú semanal para ${patient.full_name}`, titleX, 15)

  const createdAt = new Date(plan.created_at).toLocaleDateString('es-AR')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${plan.title} — ${createdAt}${plan.source === 'ai' ? ' (borrador generado con IA, revisado)' : ''}`, titleX, 20.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(theme.label.toUpperCase(), pageW - left, 15, { align: 'right' })

  doc.setTextColor(0)
  y = bandH + 10

  if (patient.dietary_restrictions) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(150, 60, 20)
    doc.text(`Restricciones: ${patient.dietary_restrictions}`, left, y)
    doc.setTextColor(0)
    y += 6
  }
  y += 2

  const byCell = new Map(items.map((i) => [`${i.weekday}-${i.meal_type}`, i.content]))
  const labelW = 26
  const tableW = pageW - 2 * left
  const dayW = (tableW - labelW) / 7
  const headerH = 8
  const rowH = 34
  const top = y

  // Nota: doc.text() pisa el color de relleno actual (bug/particularidad de esta versión de jsPDF), así que
  // hay que reafirmar setFillColor justo antes de cada rect() con relleno, no una sola vez antes del bucle.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(onAccR, onAccG, onAccB)
  doc.setFillColor(accR, accG, accB)
  doc.rect(left, top, labelW, headerH, 'F')
  WEEK_ORDER.forEach((wd, i) => {
    const x = left + labelW + i * dayW
    doc.setFillColor(accR, accG, accB)
    doc.rect(x, top, dayW, headerH, 'F')
    doc.text(WEEKDAYS_LONG[wd].slice(0, 3), x + dayW / 2, top + headerH - 2.5, { align: 'center' })
  })
  doc.setTextColor(0)

  MEALS.forEach((meal, mi) => {
    const rowY = top + headerH + mi * rowH
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(245, 243, 237)
    doc.rect(left, rowY, labelW, rowH, 'FD')
    doc.text(meal.label, left + 2, rowY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    WEEK_ORDER.forEach((wd, i) => {
      const x = left + labelW + i * dayW
      doc.rect(x, rowY, dayW, rowH)
      const content = byCell.get(`${wd}-${meal.type}`) ?? '—'
      const lines: string[] = doc.splitTextToSize(content, dayW - 3)
      doc.text(lines.slice(0, 9), x + 1.5, rowY + 4.5)
    })
  })

  doc.save(`plan-${patient.dni}-${createdAt.replace(/\//g, '-')}.pdf`)
}
