-- Link público de solo lectura por plan de alimentación (el paciente lo abre sin cuenta, como el link de turno).
-- El token es aleatorio y único: es la propia clave de acceso, no hace falta más autenticación.
alter table public.meal_plans add column share_token uuid not null default gen_random_uuid() unique;

-- Sólo expone lo que el paciente necesita ver: nunca DNI, contacto, mediciones ni anotaciones.
create function public.get_shared_meal_plan(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'title', mp.title,
    'created_at', mp.created_at,
    'patient_name', p.full_name,
    'dietary_restrictions', p.dietary_restrictions,
    'items', coalesce(
      (select jsonb_agg(jsonb_build_object('weekday', mi.weekday, 'meal_type', mi.meal_type, 'content', mi.content))
       from public.meal_plan_items mi where mi.plan_id = mp.id),
      '[]'::jsonb
    )
  )
  from public.meal_plans mp
  join public.patients p on p.id = mp.patient_id
  where mp.share_token = p_token;
$$;

revoke all on function public.get_shared_meal_plan(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_meal_plan(uuid) to anon, authenticated;
