-- Nueva lógica: toda visita existe por sí sola y puede llevar una medición simple (peso, valoración física) más
-- una nota, sin necesitar el formulario completo. La medición detallada (measurements, con todos los segmentos)
-- pasa a ser algo que se agrega aparte, sobre una visita que puede o no tenerla.
alter table public.visits
  add column weight_kg numeric(5, 1) check (weight_kg > 0),
  add column physical_rating smallint check (physical_rating between 1 and 9);

-- El resumen de "última medición" de cada paciente ahora toma el peso/valoración más recientes entre la visita
-- simple y la medición detallada, lo que haya pasado último (antes sólo miraba measurements).
-- drop+create (no "or replace"): patients ganó columnas desde que se creó la vista y Postgres no permite
-- reordenar columnas de una vista existente con "or replace".
drop view public.patient_summaries;

create view public.patient_summaries
with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.visits v where v.patient_id = p.id) as visit_count,
  latest.at as last_measured_at,
  latest.weight_kg as last_weight_kg,
  latest.body_fat_pct as last_body_fat_pct,
  latest.muscle_mass_kg as last_muscle_mass_kg,
  latest.physical_rating as last_physical_rating
from public.patients p
left join lateral (
  select at, weight_kg, body_fat_pct, muscle_mass_kg, physical_rating
  from (
    -- medición detallada más reciente
    select m.measured_at as at, m.weight_kg, m.body_fat_pct, m.muscle_mass_kg, m.physical_rating
    from public.measurements m
    join public.visits v on v.id = m.visit_id
    where v.patient_id = p.id
    union all
    -- visita simple más reciente (sin grasa/músculo: eso sólo lo da la medición detallada)
    select v.visited_at as at, v.weight_kg, null::numeric, null::numeric, v.physical_rating
    from public.visits v
    where v.patient_id = p.id and v.weight_kg is not null
  ) x
  order by at desc
  limit 1
) latest on true;

revoke all on public.patient_summaries from anon;
grant select on public.patient_summaries to authenticated;
