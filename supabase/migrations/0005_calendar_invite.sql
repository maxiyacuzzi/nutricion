-- Suma `calendar_invite` a lo que ve el paciente antes de reservar: si el profesional tiene Google Calendar
-- conectado (y por lo tanto va a recibir la invitación por email), sin exponer nada más de la conexión.
drop function public.get_professional(text);

create function public.get_professional(p_slug text)
returns table (display_name text, slot_minutes int, max_days_ahead int, timezone text, calendar_invite boolean)
language sql stable security definer set search_path = public
as $$
  select pr.display_name, pr.slot_minutes, pr.max_days_ahead, pr.timezone,
         exists (select 1 from public.google_connections gc where gc.professional_id = pr.id) as calendar_invite
  from public.professionals pr
  where pr.slug = p_slug and pr.booking_enabled;
$$;

revoke all on function public.get_professional(text) from public, anon, authenticated;
grant execute on function public.get_professional(text) to anon, authenticated;
