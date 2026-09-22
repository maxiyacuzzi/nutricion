-- Agenda de demostración para el primer usuario: perfil de reserva, horarios y algunos turnos. Idempotente.
-- Link de reserva: /reservar/consultorio-demo (se puede cambiar en Turnos → Disponibilidad).
do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  tz text := 'America/Argentina/Buenos_Aires';
  today date := (now() at time zone tz)::date;
  nxt date[] := (select array_agg(d::date order by d) from generate_series(today + 1, today + 14, interval '1 day') d
                 where extract(dow from d) between 1 and 5);
  prev date := (select max(d::date) from generate_series(today - 7, today - 1, interval '1 day') d
                where extract(dow from d) between 1 and 5);
  carlos uuid; martin uuid; daniel uuid;
begin
  if uid is null or exists (select 1 from public.professionals where id = uid) then return; end if;

  insert into public.professionals (id, slug, display_name) values (uid, 'consultorio-demo', 'Consultorio Demo');
  insert into public.availability_rules (professional_id, weekday, start_time, end_time)
    select uid, w, s.a::time, s.b::time
    from generate_series(1, 5) w cross join (values ('09:00', '13:00'), ('15:00', '18:00')) s(a, b);

  select id into daniel from public.patients where owner_id = uid and dni = '35564323';
  select id into carlos from public.patients where owner_id = uid and dni = '28457119';
  select id into martin from public.patients where owner_id = uid and dni = '41236598';

  insert into public.appointments (professional_id, patient_id, starts_at, ends_at, status, patient_dni, patient_name, patient_email, patient_phone, cancelled_by)
  select uid, v.pid, (v.day + v.t) at time zone tz, (v.day + v.t + interval '30 minutes') at time zone tz,
         v.status, v.dni, v.name, v.email, v.phone, v.by
  from (values
    (carlos, nxt[1], time '10:00', 'confirmed', '28457119', 'Carlos Benítez',  'carlos.test@example.com', '11 5555 0101', null),
    (martin, nxt[1], time '16:30', 'confirmed', '41236598', 'Martín Ledesma',  'martin.test@example.com', '11 5555 0202', null),
    (daniel, nxt[2], time '09:30', 'confirmed', '35564323', 'Daniel Yacuzzi',  'daniel.test@example.com', null,           null),
    (null::uuid, nxt[3], time '11:00', 'confirmed', '30111222', 'Lucía Fernández', 'lucia@example.com',   '11 5555 0303', null),
    (carlos, nxt[4], time '15:00', 'cancelled', '28457119', 'Carlos Benítez',  null,                      null,           'patient'),
    (daniel, prev,   time '10:30', 'confirmed', '35564323', 'Daniel Yacuzzi',  'daniel.test@example.com', null,           null)
  ) as v(pid, day, t, status, dni, name, email, phone, by);
end $$;
