-- URL base de las Edge Functions de este proyecto (la usa el trigger que avisa a Google cuando cambia un turno).
insert into public.app_settings (key, value)
values ('functions_url', 'https://micvrbhbyurqxjhdbjba.supabase.co/functions/v1')
on conflict (key) do update set value = excluded.value;
