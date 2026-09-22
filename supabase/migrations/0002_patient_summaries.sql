-- Un paciente por fila con el resumen de su última medición, para la grilla de pacientes.
-- security_invoker: la vista respeta el RLS de las tablas de origen (cada usuario ve sólo lo suyo).
create view public.patient_summaries
with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.visits v where v.patient_id = p.id) as visit_count,
  m.measured_at as last_measured_at,
  m.weight_kg as last_weight_kg,
  m.body_fat_pct as last_body_fat_pct,
  m.muscle_mass_kg as last_muscle_mass_kg,
  m.physical_rating as last_physical_rating
from public.patients p
left join lateral (
  select m.*
  from public.measurements m
  join public.visits v on v.id = m.visit_id
  where v.patient_id = p.id
  order by m.measured_at desc
  limit 1
) m on true;

revoke all on public.patient_summaries from anon;
grant select on public.patient_summaries to authenticated;
