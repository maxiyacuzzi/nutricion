-- La talla se registra una sola vez, al dar de alta al paciente (o después, editándolo) — no en cada visita
-- simple. Los valores que ya había en visits.height_cm están reflejados en patients.height_cm (se sincronizaban
-- solos), así que no se pierde nada al sacar la columna.
alter table public.visits drop column height_cm;
