-- Bitácora de anotaciones por paciente, y planes de alimentación semanales (grilla de comidas x días).
-- Mismo patrón de seguridad que patients/visits/measurements: cada fila es del profesional que la creó.

create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  created_at timestamptz not null default now(),
  body text not null check (char_length(body) between 1 and 5000)
);
create index patient_notes_patient_idx on public.patient_notes (patient_id, created_at desc);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null default 'Plan de alimentación' check (char_length(title) between 1 and 100),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now()
);
create index meal_plans_patient_idx on public.meal_plans (patient_id, created_at desc);

-- Una celda de la grilla (weekday x comida). weekday: 0 domingo … 6 sábado, igual que availability_rules.
create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  meal_type text not null check (meal_type in ('desayuno', 'almuerzo', 'merienda', 'cena')),
  content text not null default '' check (char_length(content) <= 1000),
  unique (plan_id, weekday, meal_type)
);

alter table public.patient_notes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

create policy "patient_notes: owner" on public.patient_notes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "meal_plans: owner" on public.meal_plans
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "meal_plan_items: owner" on public.meal_plan_items
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.meal_plans mp where mp.id = plan_id and mp.owner_id = (select auth.uid()))
  );
