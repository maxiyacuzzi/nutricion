-- Sincronización con Google Calendar.
--   app -> Google : un trigger avisa a la Edge Function `google` cuando un turno se crea o cambia.
--   Google -> app : la función guarda en `external_busy` los horarios ocupados del calendario del profesional,
--                   y `available_slots` deja de ofrecerlos a los pacientes.
--
-- Seguridad: los tokens de Google viven cifrados en `google_connections`, que ningún cliente (anon/authenticated) puede
-- leer ni escribir: sólo la Edge Function con la service role. La app consulta el estado mediante RPCs con security definer.

create extension if not exists pg_net;

-- Conexión de Google del profesional (1 por profesional). El refresh token va cifrado por la Edge Function (AES-GCM).
create table public.google_connections (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  calendar_id text not null default 'primary',
  block_busy boolean not null default true,
  connected_at timestamptz not null default now(),
  busy_synced_at timestamptz
);

-- Copia de los horarios ocupados en Google (sin detalles del evento: sólo el intervalo).
create table public.external_busy (
  id bigint generated always as identity primary key,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create index external_busy_prof_time_idx on public.external_busy (professional_id, starts_at, ends_at);

-- Configuración interna: URL de las funciones y secreto compartido del trigger con la Edge Function.
create table public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings (key, value)
values ('webhook_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

alter table public.google_connections enable row level security;
alter table public.external_busy enable row level security;
alter table public.app_settings enable row level security;
-- Sin políticas + sin permisos: sólo la service role (que ignora RLS) y las funciones security definer llegan a estas tablas.
revoke all on public.google_connections, public.external_busy, public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- app -> Google: avisar a la Edge Function cuando cambia un turno
-- ---------------------------------------------------------------------------------------------
create function public.notify_google_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.google_connections where professional_id = new.professional_id) then
    return new;
  end if;
  select value into v_url from public.app_settings where key = 'functions_url';
  select value into v_secret from public.app_settings where key = 'webhook_secret';
  if v_url is null or v_secret is null then return new; end if;

  perform net.http_post(
    url := v_url || '/google/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('appointment_id', new.id)
  );
  return new;
exception when others then
  -- Un problema con el calendario nunca debe impedir que se guarde o se reserve un turno.
  raise warning 'notify_google_sync: %', sqlerrm;
  return new;
end;
$$;

create trigger appointments_google_sync
after insert or update of status, starts_at, ends_at, patient_name, patient_dni, patient_phone, patient_email
on public.appointments
for each row execute function public.notify_google_sync();

-- ---------------------------------------------------------------------------------------------
-- Google -> app: los horarios ocupados dejan de ofrecerse
-- ---------------------------------------------------------------------------------------------
-- Igual que en 0003 más la exclusión de `external_busy`.
create or replace function public.available_slots(p_slug text, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select distinct s.starts_at, s.ends_at
  from public.professionals pr
  cross join lateral generate_series(
    greatest(p_from, (now() at time zone pr.timezone)::date),
    least(p_to, p_from + 62, (now() at time zone pr.timezone)::date + pr.max_days_ahead),
    interval '1 day'
  ) as d(day)
  join public.availability_rules r on r.professional_id = pr.id and r.weekday = extract(dow from d.day)::int
  cross join lateral generate_series(
    d.day::date + r.start_time,
    d.day::date + r.end_time - make_interval(mins => pr.slot_minutes),
    make_interval(mins => pr.slot_minutes)
  ) as t(local_start)
  cross join lateral (
    select t.local_start at time zone pr.timezone as starts_at,
           t.local_start at time zone pr.timezone + make_interval(mins => pr.slot_minutes) as ends_at
  ) s
  where pr.slug = p_slug
    and pr.booking_enabled
    and s.starts_at >= now() + make_interval(hours => pr.min_notice_hours)
    and not exists (
      select 1 from public.time_off o
      where o.professional_id = pr.id and d.day::date between o.starts_on and o.ends_on
    )
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = pr.id and a.status <> 'cancelled'
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(s.starts_at, s.ends_at)
    )
    and not exists (
      select 1 from public.external_busy b
      where b.professional_id = pr.id
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(s.starts_at, s.ends_at)
    )
  order by s.starts_at;
$$;

-- Reemplaza de forma atómica los horarios ocupados de un profesional (la llama la Edge Function con la service role).
create function public.replace_external_busy(p_professional uuid, p_rows jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.external_busy where professional_id = p_professional;
  insert into public.external_busy (professional_id, starts_at, ends_at)
  select p_professional, (r->>'starts_at')::timestamptz, (r->>'ends_at')::timestamptz
  from jsonb_array_elements(p_rows) r
  where (r->>'ends_at')::timestamptz > (r->>'starts_at')::timestamptz;
  update public.google_connections set busy_synced_at = now() where professional_id = p_professional;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs de la app (usuario logueado)
-- ---------------------------------------------------------------------------------------------
create function public.get_google_status()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('connected', true, 'email', google_email, 'block_busy', block_busy, 'connected_at', connected_at)
     from public.google_connections where professional_id = auth.uid()),
    jsonb_build_object('connected', false)
  );
$$;

create function public.set_google_block_busy(p_block boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.google_connections set block_busy = p_block, busy_synced_at = null where professional_id = auth.uid();
  if not p_block then
    delete from public.external_busy where professional_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.replace_external_busy(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_google_status() from public, anon, authenticated;
revoke all on function public.set_google_block_busy(boolean) from public, anon, authenticated;
revoke all on function public.notify_google_sync() from public, anon, authenticated;
grant execute on function public.replace_external_busy(uuid, jsonb) to service_role;
grant execute on function public.get_google_status() to authenticated;
grant execute on function public.set_google_block_busy(boolean) to authenticated;
