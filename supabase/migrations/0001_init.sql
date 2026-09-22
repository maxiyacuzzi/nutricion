-- Pacientes, visitas y mediciones de composición corporal.
-- Cada fila pertenece al profesional (auth.users) que la creó; RLS aísla los datos.

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dni text not null,
  full_name text not null,
  email text,
  sex text not null check (sex in ('M', 'F')),
  birth_date date,
  height_cm numeric(5, 1) not null check (height_cm between 50 and 250),
  dietary_restrictions text,
  created_at timestamptz not null default now(),
  unique (owner_id, dni)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  visited_at timestamptz not null default now(),
  notes text
);
create index visits_patient_idx on public.visits (patient_id, visited_at desc);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visit_id uuid not null references public.visits (id) on delete cascade,
  measured_at timestamptz not null default now(),

  -- antropometría
  weight_kg numeric(5, 1) not null check (weight_kg > 0),
  physical_rating smallint check (physical_rating between 1 and 9),
  bone_mass_kg numeric(4, 2),

  -- valores generales
  body_fat_pct numeric(4, 1) check (body_fat_pct between 0 and 100),
  body_water_pct numeric(4, 1) check (body_water_pct between 0 and 100),
  muscle_mass_kg numeric(5, 1),
  visceral_fat numeric(4, 1),
  total_fat_pct numeric(4, 1) check (total_fat_pct between 0 and 100),

  -- grasa por segmento (%)
  fat_trunk_pct numeric(4, 1),
  fat_left_arm_pct numeric(4, 1),
  fat_right_arm_pct numeric(4, 1),
  fat_left_leg_pct numeric(4, 1),
  fat_right_leg_pct numeric(4, 1),

  -- músculo por segmento (kg)
  muscle_trunk_kg numeric(5, 1),
  muscle_left_arm_kg numeric(5, 1),
  muscle_right_arm_kg numeric(5, 1),
  muscle_left_leg_kg numeric(5, 1),
  muscle_right_leg_kg numeric(5, 1),

  -- metabolismo
  bmr_kcal integer check (bmr_kcal > 0),
  metabolic_age smallint check (metabolic_age between 0 and 120)
);
create index measurements_visit_idx on public.measurements (visit_id, measured_at desc);

alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.measurements enable row level security;

create policy "patients: owner" on public.patients
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- visits/measurements además exigen que el padre sea del mismo dueño.
create policy "visits: owner" on public.visits
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "measurements: owner" on public.measurements
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.visits v where v.id = visit_id and v.owner_id = (select auth.uid()))
  );
