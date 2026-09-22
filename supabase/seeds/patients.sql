-- Pacientes de prueba, cada uno con 2 visitas (para ver la evolución). Idempotente por DNI.
--   · Daniel Yacuzzi  — perfil promedio
--   · Carlos Benítez  — sobrepeso excesivo
--   · Martín Ledesma  — musculatura excesiva
-- Se asignan al primer usuario registrado; falla si todavía no hay ninguno.
do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  p jsonb;
  v jsonb;
  pid uuid;
  vid uuid;
begin
  if uid is null then
    raise exception 'No hay usuarios en auth.users: registrate en la app primero y volvé a correr el seed.';
  end if;

  for p in select * from jsonb_array_elements($json$[
    {
      "dni": "35564323", "full_name": "Daniel Yacuzzi", "email": "daniel.test@example.com",
      "sex": "M", "birth_date": "1992-03-15", "height_cm": 189, "restrictions": "intolerante a la lactosa",
      "visits": [
        { "at": "2026-07-12 16:30-03", "notes": "Primera consulta", "m": {
          "weight_kg": 91.2, "physical_rating": 4, "bone_mass_kg": 3.3,
          "body_fat_pct": 21.4, "body_water_pct": 54.1, "muscle_mass_kg": 66.8, "visceral_fat": 10, "total_fat_pct": 21.4,
          "fat_trunk_pct": 22.6, "fat_left_arm_pct": 18.9, "fat_right_arm_pct": 19.2, "fat_left_leg_pct": 22.8, "fat_right_leg_pct": 23.1,
          "muscle_trunk_kg": 29.4, "muscle_left_arm_kg": 4.4, "muscle_right_arm_kg": 4.5, "muscle_left_leg_kg": 10.9, "muscle_right_leg_kg": 10.8,
          "bmr_kcal": 1940, "metabolic_age": 36 } },
        { "at": "2026-09-14 16:30-03", "notes": "Control a las 9 semanas", "m": {
          "weight_kg": 87.6, "physical_rating": 6, "bone_mass_kg": 3.4,
          "body_fat_pct": 17.8, "body_water_pct": 57.2, "muscle_mass_kg": 68.9, "visceral_fat": 8, "total_fat_pct": 17.8,
          "fat_trunk_pct": 18.5, "fat_left_arm_pct": 15.9, "fat_right_arm_pct": 16.2, "fat_left_leg_pct": 19.6, "fat_right_leg_pct": 19.9,
          "muscle_trunk_kg": 30.2, "muscle_left_arm_kg": 4.6, "muscle_right_arm_kg": 4.7, "muscle_left_leg_kg": 11.3, "muscle_right_leg_kg": 11.2,
          "bmr_kcal": 1985, "metabolic_age": 31 } }
      ]
    },
    {
      "dni": "28457119", "full_name": "Carlos Benítez", "email": "carlos.test@example.com",
      "sex": "M", "birth_date": "1985-08-02", "height_cm": 172, "restrictions": "hipertenso, sin sal agregada",
      "visits": [
        { "at": "2026-07-08 10:00-03", "notes": "Primera consulta", "m": {
          "weight_kg": 148.9, "physical_rating": 1, "bone_mass_kg": 4.2,
          "body_fat_pct": 45.8, "body_water_pct": 37.1, "muscle_mass_kg": 57.0, "visceral_fat": 30, "total_fat_pct": 45.8,
          "fat_trunk_pct": 48.9, "fat_left_arm_pct": 39.6, "fat_right_arm_pct": 40.1, "fat_left_leg_pct": 41.5, "fat_right_leg_pct": 41.8,
          "muscle_trunk_kg": 26.1, "muscle_left_arm_kg": 3.9, "muscle_right_arm_kg": 4.0, "muscle_left_leg_kg": 10.0, "muscle_right_leg_kg": 10.1,
          "bmr_kcal": 2380, "metabolic_age": 60 } },
        { "at": "2026-09-16 10:00-03", "notes": "Control a las 10 semanas", "m": {
          "weight_kg": 142.5, "physical_rating": 1, "bone_mass_kg": 4.2,
          "body_fat_pct": 44.2, "body_water_pct": 38.4, "muscle_mass_kg": 58.1, "visceral_fat": 28, "total_fat_pct": 44.2,
          "fat_trunk_pct": 47.3, "fat_left_arm_pct": 38.2, "fat_right_arm_pct": 38.6, "fat_left_leg_pct": 40.1, "fat_right_leg_pct": 40.4,
          "muscle_trunk_kg": 26.6, "muscle_left_arm_kg": 4.0, "muscle_right_arm_kg": 4.1, "muscle_left_leg_kg": 10.2, "muscle_right_leg_kg": 10.3,
          "bmr_kcal": 2340, "metabolic_age": 58 } }
      ]
    },
    {
      "dni": "41236598", "full_name": "Martín Ledesma", "email": "martin.test@example.com",
      "sex": "M", "birth_date": "1996-11-20", "height_cm": 183, "restrictions": "alergia a los frutos secos",
      "visits": [
        { "at": "2026-07-10 18:00-03", "notes": "Primera consulta", "m": {
          "weight_kg": 105.1, "physical_rating": 8, "bone_mass_kg": 4.3,
          "body_fat_pct": 11.4, "body_water_pct": 65.2, "muscle_mass_kg": 85.3, "visceral_fat": 4, "total_fat_pct": 11.4,
          "fat_trunk_pct": 10.6, "fat_left_arm_pct": 8.4, "fat_right_arm_pct": 8.2, "fat_left_leg_pct": 11.9, "fat_right_leg_pct": 12.1,
          "muscle_trunk_kg": 36.8, "muscle_left_arm_kg": 6.1, "muscle_right_arm_kg": 6.2, "muscle_left_leg_kg": 14.9, "muscle_right_leg_kg": 15.0,
          "bmr_kcal": 2690, "metabolic_age": 24 } },
        { "at": "2026-09-16 18:00-03", "notes": "Control a las 10 semanas", "m": {
          "weight_kg": 108.4, "physical_rating": 9, "bone_mass_kg": 4.4,
          "body_fat_pct": 9.5, "body_water_pct": 66.0, "muscle_mass_kg": 88.6, "visceral_fat": 3, "total_fat_pct": 9.5,
          "fat_trunk_pct": 8.5, "fat_left_arm_pct": 7.0, "fat_right_arm_pct": 6.8, "fat_left_leg_pct": 9.7, "fat_right_leg_pct": 9.9,
          "muscle_trunk_kg": 38.2, "muscle_left_arm_kg": 6.4, "muscle_right_arm_kg": 6.5, "muscle_left_leg_kg": 15.6, "muscle_right_leg_kg": 15.7,
          "bmr_kcal": 2780, "metabolic_age": 22 } }
      ]
    }
  ]$json$::jsonb) loop
    if exists (select 1 from public.patients where owner_id = uid and dni = p->>'dni') then
      continue;
    end if;

    insert into public.patients (owner_id, dni, full_name, email, sex, birth_date, height_cm, dietary_restrictions)
    values (uid, p->>'dni', p->>'full_name', p->>'email', p->>'sex', (p->>'birth_date')::date,
            (p->>'height_cm')::numeric, p->>'restrictions')
    returning id into pid;

    for v in select * from jsonb_array_elements(p->'visits') loop
      insert into public.visits (owner_id, patient_id, visited_at, notes)
      values (uid, pid, (v->>'at')::timestamptz, v->>'notes')
      returning id into vid;

      insert into public.measurements (
        owner_id, visit_id, measured_at, weight_kg, physical_rating, bone_mass_kg,
        body_fat_pct, body_water_pct, muscle_mass_kg, visceral_fat, total_fat_pct,
        fat_trunk_pct, fat_left_arm_pct, fat_right_arm_pct, fat_left_leg_pct, fat_right_leg_pct,
        muscle_trunk_kg, muscle_left_arm_kg, muscle_right_arm_kg, muscle_left_leg_kg, muscle_right_leg_kg,
        bmr_kcal, metabolic_age
      )
      select uid, vid, (v->>'at')::timestamptz + interval '10 minutes', r.weight_kg, r.physical_rating, r.bone_mass_kg,
        r.body_fat_pct, r.body_water_pct, r.muscle_mass_kg, r.visceral_fat, r.total_fat_pct,
        r.fat_trunk_pct, r.fat_left_arm_pct, r.fat_right_arm_pct, r.fat_left_leg_pct, r.fat_right_leg_pct,
        r.muscle_trunk_kg, r.muscle_left_arm_kg, r.muscle_right_arm_kg, r.muscle_left_leg_kg, r.muscle_right_leg_kg,
        r.bmr_kcal, r.metabolic_age
      from jsonb_populate_record(null::public.measurements, v->'m') r;
    end loop;
  end loop;
end $$;
