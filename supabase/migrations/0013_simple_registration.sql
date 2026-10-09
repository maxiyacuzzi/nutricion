-- El alta de un paciente pasa a pedir sólo datos de identificación. Altura y obra social se completan después
-- (desde "Editar"), y se suman motivo de consulta, medicación/suplementos y la rutina alimentaria actual.
alter table public.patients
  alter column height_cm drop not null,
  add column reason_for_visit text,
  add column medication text,
  -- { desayuno|almuerzo|merienda|cena|anxiety: { time: text|null, what: text|null } }
  add column dietary_routine jsonb;
