-- Medición intermedia para Daniel Yacuzzi (12/07 → 13/08 → 14/09) y poder ver "anterior" distinta de "primera".
-- Idempotente: no hace nada si ya existe la visita del 13/08 o si falta el paciente.
do $$
declare
  pid uuid := (select id from public.patients where dni = '35564323' order by created_at limit 1);
  uid uuid;
  vid uuid;
begin
  if pid is null then return; end if;
  select owner_id into uid from public.patients where id = pid;

  if exists (select 1 from public.visits where patient_id = pid and visited_at = '2026-08-13 16:30-03') then return; end if;

  insert into public.visits (owner_id, patient_id, visited_at, notes)
  values (uid, pid, '2026-08-13 16:30-03', 'Control al mes')
  returning id into vid;

  insert into public.measurements (
    owner_id, visit_id, measured_at, weight_kg, physical_rating, bone_mass_kg,
    body_fat_pct, body_water_pct, muscle_mass_kg, visceral_fat, total_fat_pct,
    fat_trunk_pct, fat_left_arm_pct, fat_right_arm_pct, fat_left_leg_pct, fat_right_leg_pct,
    muscle_trunk_kg, muscle_left_arm_kg, muscle_right_arm_kg, muscle_left_leg_kg, muscle_right_leg_kg,
    bmr_kcal, metabolic_age
  ) values (
    uid, vid, '2026-08-13 16:40-03', 89.6, 5, 3.3,
    19.7, 55.8, 67.8, 9, 19.7,
    20.6, 17.4, 17.7, 21.2, 21.5,
    29.8, 4.5, 4.6, 11.1, 11.0,
    1962, 34
  );
end $$;
