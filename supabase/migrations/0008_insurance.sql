-- Datos de obra social / prepaga del paciente. Igual que email o dietary_restrictions: texto libre, opcional.
alter table public.patients
  add column insurance_provider text,
  add column insurance_plan text,
  add column insurance_member_id text;
