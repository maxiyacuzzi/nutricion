import { jsPDF } from 'jspdf'
import type { MealPlan, MealPlanItem, MealType, Patient } from '../types'
import { WEEK_ORDER, WEEKDAYS_LONG } from './time'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'desayuno', label: 'Desayuno' },
  { type: 'almuerzo', label: 'Almuerzo' },
  { type: 'merienda', label: 'Merienda' },
  { type: 'cena', label: 'Cena' },
]

export function downloadMealPlanReport(patient: Patient, plan: MealPlan, items: MealPlanItem[]) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const left = 10
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Plan de alimentación', left, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`${patient.full_name}  |  DNI ${patient.dni}`, left, y)
  y += 6
  const createdAt = new Date(plan.created_at).toLocaleDateString('es-AR')
  doc.text(`${plan.title} — ${createdAt}${plan.source === 'ai' ? ' (borrador generado con IA, revisado)' : ''}`, left, y)
  y += 6

  if (patient.dietary_restrictions) {
    doc.setTextColor(150, 60, 20)
    doc.text(`Restricciones: ${patient.dietary_restrictions}`, left, y)
    doc.setTextColor(0)
    y += 6
  }
  y += 4

  const byCell = new Map(items.map((i) => [`${i.weekday}-${i.meal_type}`, i.content]))
  const labelW = 26
  const tableW = 277 // ancho de página A4 apaisada (297mm) menos 2×10mm de margen
  const dayW = (tableW - labelW) / 7
  const headerH = 8
  const rowH = 34
  const top = y

  // Nota: doc.text() pisa el color de relleno actual (bug/particularidad de esta versión de jsPDF), así que
  // hay que reafirmar setFillColor justo antes de cada rect() con relleno, no una sola vez antes del bucle.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(230, 230, 230)
  doc.rect(left, top, labelW, headerH, 'FD')
  WEEK_ORDER.forEach((wd, i) => {
    const x = left + labelW + i * dayW
    doc.setFillColor(230, 230, 230)
    doc.rect(x, top, dayW, headerH, 'FD')
    doc.text(WEEKDAYS_LONG[wd].slice(0, 3), x + dayW / 2, top + headerH - 2.5, { align: 'center' })
  })

  MEALS.forEach((meal, mi) => {
    const rowY = top + headerH + mi * rowH
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(245, 245, 245)
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
