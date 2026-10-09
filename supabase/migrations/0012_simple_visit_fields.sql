-- La vista depende de visits.physical_rating: hay que sacarla de en medio antes de poder borrar la columna.
drop view public.patient_summaries;

-- Corrige qué es "la medición simple" de una visita: peso, talla y las dos circunferencias de cintura
-- (umbilical y alta). La valoración física no es parte de esto (queda sólo en la medición detallada).
alter table public.visits
  drop column physical_rating,
  add column height_cm numeric(5, 1) check (height_cm between 50 and 250),
  add column waist_umbilical_cm numeric(5, 1) check (waist_umbilical_cm > 0),
  add column waist_high_cm numeric(5, 1) check (waist_high_cm > 0);

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
    -- medición detallada más reciente (es la única que tiene valoración física, grasa y músculo)
    select m.measured_at as at, m.weight_kg, m.body_fat_pct, m.muscle_mass_kg, m.physical_rating
    from public.measurements m
    join public.visits v on v.id = m.visit_id
    where v.patient_id = p.id
    union all
    -- visita simple más reciente
    select v.visited_at as at, v.weight_kg, null::numeric, null::numeric, null::smallint
    from public.visits v
    where v.patient_id = p.id and v.weight_kg is not null
  ) x
  order by at desc
  limit 1
) latest on true;

revoke all on public.patient_summaries from anon;
grant select on public.patient_summaries to authenticated;
