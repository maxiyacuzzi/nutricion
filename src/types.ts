export type Sex = 'M' | 'F'

/** Una comida de la rutina alimentaria actual del paciente (no es el plan que se le da, es lo que ya come). */
export interface DietaryRoutineEntry {
  time: string | null
  what: string | null
}

export type DietaryRoutineKey = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'anxiety'

export type DietaryRoutine = Record<DietaryRoutineKey, DietaryRoutineEntry>

export interface Patient {
  id: string
  dni: string
  full_name: string
  email: string | null
  /** Con código de país, para poder escribirle por WhatsApp (ej. "+54 9 11 5555-1234"). */
  phone: string | null
  sex: Sex
  birth_date: string | null
  /** Se completa después del alta: desde "Editar", o solo al cargar la primera visita con talla. */
  height_cm: number | null
  dietary_restrictions: string | null
  /** Obra social o prepaga (nombre libre, ej. "OSDE"). */
  insurance_provider: string | null
  /** Plan dentro de la obra social/prepaga (ej. "210", "Plan Azul"). */
  insurance_plan: string | null
  /** N° de afiliado o credencial. */
  insurance_member_id: string | null
  reason_for_visit: string | null
  medication: string | null
  dietary_routine: DietaryRoutine | null
  /** Notas generales del alta, sin un campo más específico donde ir. */
  observations: string | null
}

export interface Visit {
  id: string
  patient_id: string
  visited_at: string
  notes: string | null
  /** Medición simple: lo que se toma en cualquier consulta, independiente de la medición detallada.
   *  La talla no va acá: se registra una sola vez, al dar de alta al paciente (o editándolo después). */
  weight_kg: number | null
  waist_umbilical_cm: number | null
  waist_high_cm: number | null
}

/** Campos numéricos de una medición (todos opcionales salvo el peso). */
export interface MeasurementValues {
  weight_kg: number
  physical_rating: number | null
  bone_mass_kg: number | null
  body_fat_pct: number | null
  body_water_pct: number | null
  muscle_mass_kg: number | null
  visceral_fat: number | null
  total_fat_pct: number | null
  fat_trunk_pct: number | null
  fat_left_arm_pct: number | null
  fat_right_arm_pct: number | null
  fat_left_leg_pct: number | null
  fat_right_leg_pct: number | null
  muscle_trunk_kg: number | null
  muscle_left_arm_kg: number | null
  muscle_right_arm_kg: number | null
  muscle_left_leg_kg: number | null
  muscle_right_leg_kg: number | null
  bmr_kcal: number | null
  metabolic_age: number | null
}

export interface Measurement extends MeasurementValues {
  id: string
  visit_id: string
  measured_at: string
}

export type MeasurementKey = keyof MeasurementValues

export interface PatientInput {
  dni: string
  full_name: string
  email: string | null
  phone: string | null
  sex: Sex
  birth_date: string | null
  height_cm: number | null
  dietary_restrictions: string | null
  insurance_provider: string | null
  insurance_plan: string | null
  insurance_member_id: string | null
  reason_for_visit: string | null
  medication: string | null
  dietary_routine: DietaryRoutine | null
  /** Notas generales del alta, sin un campo más específico donde ir. */
  observations: string | null
}

/** Fila de la vista patient_summaries: paciente + resumen de su última medición. */
export interface PatientSummary extends Patient {
  visit_count: number
  last_measured_at: string | null
  last_weight_kg: number | null
  last_body_fat_pct: number | null
  last_muscle_mass_kg: number | null
  last_physical_rating: number | null
}

// ---------- Turnos ----------

export interface Professional {
  id: string
  slug: string
  display_name: string
  slot_minutes: number
  min_notice_hours: number
  max_days_ahead: number
  timezone: string
  booking_enabled: boolean
}

/** Franja semanal; weekday 0 = domingo … 6 = sábado. Las horas son "HH:MM" locales del profesional. */
export interface AvailabilityRule {
  weekday: number
  start_time: string
  end_time: string
}

export interface TimeOff {
  id: string
  starts_on: string
  ends_on: string
  reason: string | null
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export interface Appointment {
  id: string
  patient_id: string | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  patient_dni: string
  patient_name: string
  patient_email: string | null
  patient_phone: string | null
  cancelled_by: 'patient' | 'professional' | null
}

export interface Slot {
  starts_at: string
  ends_at: string
}

export interface PublicProfessional {
  display_name: string
  slot_minutes: number
  max_days_ahead: number
  timezone: string
  /** Si el profesional tiene Google Calendar conectado: al dejar su email, el paciente recibe la invitación. */
  calendar_invite: boolean
}

export interface BookingResult {
  appointment_id: string
  cancel_token: string
  starts_at: string
  ends_at: string
  professional_name: string
  timezone: string
}

export interface AppointmentInfo {
  professional_name: string
  timezone: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  patient_name: string
}

// ---------- Notas y planes de alimentación ----------

export interface PatientNote {
  id: string
  patient_id: string
  created_at: string
  body: string
}

export type MealType = 'desayuno' | 'almuerzo' | 'merienda' | 'cena'
export const MEAL_TYPES: MealType[] = ['desayuno', 'almuerzo', 'merienda', 'cena']

export interface MealPlan {
  id: string
  patient_id: string
  title: string
  source: 'manual' | 'ai'
  created_at: string
  /** Clave del link público de solo lectura: /plan/<share_token>. */
  share_token: string
}

/** weekday: 0 domingo … 6 sábado, igual que AvailabilityRule. */
export interface MealPlanItem {
  weekday: number
  meal_type: MealType
  content: string
}

/** Lo que ve el paciente en el link público del plan (sin DNI, contacto, mediciones ni anotaciones). */
export interface SharedMealPlan {
  title: string
  created_at: string
  patient_name: string
  dietary_restrictions: string | null
  items: MealPlanItem[]
}

// ---------- Pagos ----------

export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'mercado_pago' | 'otro'
export const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'debito', 'credito', 'mercado_pago', 'otro']
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro',
}

export interface Payment {
  id: string
  patient_id: string
  amount: number
  method: PaymentMethod
  concept: string | null
  paid_on: string
  notes: string | null
  created_at: string
}

export interface PaymentWithPatient extends Payment {
  patient_name: string
}

export interface PaymentInput {
  patient_id: string
  amount: number
  method: PaymentMethod
  concept: string | null
  paid_on: string
  notes: string | null
}
