-- Teléfono del paciente (texto libre, como email o dietary_restrictions). Se usa para el botón de WhatsApp.
alter table public.patients add column phone text;
