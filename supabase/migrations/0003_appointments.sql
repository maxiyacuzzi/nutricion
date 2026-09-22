-- Agenda de turnos: disponibilidad del profesional + reserva pública por link.
--
-- Seguridad: las tablas sólo las lee/escribe el profesional dueño (RLS). Los pacientes NO tienen cuenta ni acceso
-- a las tablas: reservan mediante funciones SECURITY DEFINER que validan todo (horario ofrecido, datos, límites).

create extension if not exists btree_gist with schema extensions;

-- Perfil público del profesional (1 por usuario). El slug es el link de reserva: /reservar/<slug>
create table public.professionals (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  display_name text not null check (char_length(display_name) between 2 and 100),
  slot_minutes int not null default 30 check (slot_minutes in (15, 20, 30, 45, 60, 90)),
  min_notice_hours int not null default 2 check (min_notice_hours between 0 and 720),
  max_days_ahead int not null default 30 check (max_days_ahead between 1 and 180),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  booking_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Franjas semanales en hora local del profesional. weekday: 0 = domingo … 6 = sábado (como extract(dow)).
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index availability_rules_prof_idx on public.availability_rules (professional_id, weekday);

-- Días bloqueados (vacaciones, feriados), ambos extremos incluidos.
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  check (ends_on >= starts_on)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.professionals (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  patient_dni text not null,
  patient_name text not null,
  patient_email text,
  patient_phone text,
  notes text,
  cancel_token uuid not null default gen_random_uuid() unique,
  cancelled_by text check (cancelled_by in ('patient', 'professional')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Imposible superponer dos turnos vigentes del mismo profesional, aunque reserven a la vez.
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'cancelled')
);
create index appointments_prof_time_idx on public.appointments (professional_id, starts_at);
create index appointments_dni_idx on public.appointments (professional_id, patient_dni);

alter table public.professionals enable row level security;
alter table public.availability_rules enable row level security;
alter table public.time_off enable row level security;
alter table public.appointments enable row level security;

create policy "professionals: owner" on public.professionals
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "availability_rules: owner" on public.availability_rules
  for all to authenticated
  using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));

create policy "time_off: owner" on public.time_off
  for all to authenticated
  using (professional_id = (select auth.uid())) with check (professional_id = (select auth.uid()));

create policy "appointments: owner" on public.appointments
  for all to authenticated
  using (professional_id = (select auth.uid()))
  with check (
    professional_id = (select auth.uid())
    and (patient_id is null or exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------------------------
-- Funciones públicas (las usan los pacientes sin sesión)
-- ---------------------------------------------------------------------------------------------

-- Datos mínimos para mostrar la página de reserva.
create function public.get_professional(p_slug text)
returns table (display_name text, slot_minutes int, max_days_ahead int, timezone text)
language sql stable security definer set search_path = public
as $$
  select pr.display_name, pr.slot_minutes, pr.max_days_ahead, pr.timezone
  from public.professionals pr
  where pr.slug = p_slug and pr.booking_enabled;
$$;

-- Horarios libres entre dos fechas (locales del profesional). Respeta franjas, bloqueos, aviso mínimo y turnos ya tomados.
create function public.available_slots(p_slug text, p_from date, p_to date)
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
  order by s.starts_at;
$$;

-- Reserva un horario. Errores (message): invalid_input, not_found, slot_unavailable, too_many_appointments.
create function public.book_appointment(
  p_slug text, p_starts_at timestamptz, p_dni text, p_name text, p_email text default null, p_phone text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pr public.professionals%rowtype;
  v_dni text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_day date;
  v_patient uuid;
  appt public.appointments%rowtype;
begin
  if v_dni !~ '^[0-9]{6,10}$'
     or char_length(v_name) not between 2 and 100
     or (v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or (v_phone is not null and char_length(v_phone) > 40) then
    raise exception 'invalid_input';
  end if;

  -- El lock serializa las reservas de un mismo profesional.
  select * into pr from public.professionals where slug = p_slug and booking_enabled for update;
  if not found then raise exception 'not_found'; end if;

  v_day := (p_starts_at at time zone pr.timezone)::date;
  if not exists (select 1 from public.available_slots(p_slug, v_day, v_day) s where s.starts_at = p_starts_at) then
    raise exception 'slot_unavailable';
  end if;

  if (select count(*) from public.appointments
      where professional_id = pr.id and patient_dni = v_dni and status = 'confirmed' and starts_at > now()) >= 2 then
    raise exception 'too_many_appointments';
  end if;

  -- Si el DNI corresponde a un paciente ya registrado del profesional, se vincula (sin revelárselo al que reserva).
  select id into v_patient from public.patients
  where owner_id = pr.id and regexp_replace(dni, '[^0-9]', '', 'g') = v_dni
  limit 1;

  begin
    insert into public.appointments (professional_id, patient_id, starts_at, ends_at, patient_dni, patient_name, patient_email, patient_phone)
    values (pr.id, v_patient, p_starts_at, p_starts_at + make_interval(mins => pr.slot_minutes), v_dni, v_name, v_email, v_phone)
    returning * into appt;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;

  return jsonb_build_object(
    'appointment_id', appt.id, 'cancel_token', appt.cancel_token,
    'starts_at', appt.starts_at, 'ends_at', appt.ends_at,
    'professional_name', pr.display_name, 'timezone', pr.timezone
  );
end;
$$;

-- Ver un turno con su token secreto (el link que recibe el paciente al reservar).
create function public.get_appointment_by_token(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'professional_name', pr.display_name, 'timezone', pr.timezone,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status, 'patient_name', a.patient_name
  )
  from public.appointments a
  join public.professionals pr on pr.id = a.professional_id
  where a.cancel_token = p_token;
$$;

-- Cancelar con el token. Sólo turnos vigentes y futuros. Error: cannot_cancel.
create function public.cancel_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  appt public.appointments%rowtype;
begin
  update public.appointments
  set status = 'cancelled', cancelled_by = 'patient'
  where cancel_token = p_token and status = 'confirmed' and starts_at > now()
  returning * into appt;
  if not found then raise exception 'cannot_cancel'; end if;
  return jsonb_build_object('status', appt.status);
end;
$$;

-- Reemplaza de forma atómica todas las franjas semanales del profesional logueado (respeta RLS).
create function public.replace_availability(p_rules jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  delete from public.availability_rules where professional_id = auth.uid();
  insert into public.availability_rules (professional_id, weekday, start_time, end_time)
  select auth.uid(), (r->>'weekday')::smallint, (r->>'start_time')::time, (r->>'end_time')::time
  from jsonb_array_elements(p_rules) r;
end;
$$;

-- Sólo estas funciones quedan expuestas; el resto de los permisos por defecto se quitan.
revoke all on function public.get_professional(text) from public, anon, authenticated;
revoke all on function public.available_slots(text, date, date) from public, anon, authenticated;
revoke all on function public.book_appointment(text, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_appointment_by_token(uuid) from public, anon, authenticated;
revoke all on function public.cancel_appointment_by_token(uuid) from public, anon, authenticated;
revoke all on function public.replace_availability(jsonb) from public, anon, authenticated;

grant execute on function public.get_professional(text) to anon, authenticated;
grant execute on function public.available_slots(text, date, date) to anon, authenticated;
grant execute on function public.book_appointment(text, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.replace_availability(jsonb) to authenticated;
