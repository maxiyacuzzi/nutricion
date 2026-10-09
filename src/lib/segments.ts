import type { Measurement } from '../types'
import type { SegmentData, SegmentId } from './bodyShape'

type SegmentSource = Pick<
  Measurement,
  'fat_trunk_pct' | 'muscle_trunk_kg' | 'fat_left_arm_pct' | 'muscle_left_arm_kg' | 'fat_right_arm_pct' |
  'muscle_right_arm_kg' | 'fat_left_leg_pct' | 'muscle_left_leg_kg' | 'fat_right_leg_pct' | 'muscle_right_leg_kg'
>

/** Datos por segmento (grasa % y músculo kg) de una medición, en el formato que usa el avatar. */
export function segmentsOf(m: SegmentSource | null): Record<SegmentId, SegmentData> {
  return {
    trunk: { fatPct: m?.fat_trunk_pct ?? null, muscleKg: m?.muscle_trunk_kg ?? null },
    leftArm: { fatPct: m?.fat_left_arm_pct ?? null, muscleKg: m?.muscle_left_arm_kg ?? null },
    rightArm: { fatPct: m?.fat_right_arm_pct ?? null, muscleKg: m?.muscle_right_arm_kg ?? null },
    leftLeg: { fatPct: m?.fat_left_leg_pct ?? null, muscleKg: m?.muscle_left_leg_kg ?? null },
    rightLeg: { fatPct: m?.fat_right_leg_pct ?? null, muscleKg: m?.muscle_right_leg_kg ?? null },
  }
}
