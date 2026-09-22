-- Registro simple de cobros: cada pago pertenece a un paciente del profesional. Sin conceptos de precio ni
-- saldo pendiente todavía; sólo lo que efectivamente se cobró.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('efectivo', 'transferencia', 'debito', 'credito', 'mercado_pago', 'otro')),
  concept text,
  paid_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index payments_owner_date_idx on public.payments (owner_id, paid_on desc);
create index payments_patient_idx on public.payments (patient_id, paid_on desc);

alter table public.payments enable row level security;

create policy "payments: owner" on public.payments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );
