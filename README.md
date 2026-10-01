# Nutrición

Dashboard de composición corporal para nutricionistas: pacientes, visitas y mediciones (grasa, agua, músculo,
análisis segmental, metabolismo) con reporte en PDF. React + TypeScript + Vite + Supabase.

## Puesta en marcha

1. Crear un proyecto en [Supabase](https://supabase.com) y ejecutar `supabase/migrations/0001_init.sql`
   en el SQL Editor (o con `supabase db push`).
2. `cp .env.example .env` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`

Cada usuario (auth por email/contraseña) sólo ve sus propios pacientes: la seguridad la aplica RLS en la base.

## Estructura

- `supabase/migrations/` — esquema (`patients`, `visits`, `measurements`) y políticas RLS
- `src/lib/ranges.ts` — rangos de referencia de cada indicador (según sexo)
- `src/lib/fields.ts` — definición de los campos del formulario de medición
- `src/components/` — `Gauge`, `SegmentCard`, `BodyFigure`, formularios
- `src/pages/` — `Dashboard` y `PatientForm`

## Google Calendar (sincronización completa)

- **App → Google**: cada turno nuevo, modificado o cancelado se copia al calendario del profesional (un trigger avisa a la
  Edge Function `google`, que crea/actualiza/borra el evento).
- **Google → app**: los horarios en que el profesional está ocupado en su calendario dejan de ofrecerse en el link de reserva.

Puesta en marcha (una vez por proyecto de Google Cloud):

1. En [Google Cloud Console](https://console.cloud.google.com/) crear un proyecto y habilitar **Google Calendar API**.
2. *Google Auth Platform* → configurar la pantalla de consentimiento (tipo Externo), agregar el permiso
   `https://www.googleapis.com/auth/calendar.events` y, mientras esté en "Testing", tu email como usuario de prueba.
   En "Testing" Google vence el acceso a los 7 días; para uso propio conviene **publicar** la app (aparece el aviso de
   "app no verificada" y hay un tope de 100 usuarios).
3. *Credenciales* → crear **ID de cliente OAuth** de tipo *Aplicación web* con la URI de redirección autorizada
   `https://<project-ref>.supabase.co/functions/v1/google/callback`.
4. Agregar al `.env` (nunca con prefijo `VITE_`, así no llega al navegador) `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, y cargarlos:

   ```sh
   set -a; . ./.env; set +a
   supabase secrets set GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
     TOKEN_ENCRYPTION_KEY="$TOKEN_ENCRYPTION_KEY" APP_URL="$APP_URL"
   supabase functions deploy google --use-api --no-verify-jwt
   ```

   `TOKEN_ENCRYPTION_KEY` (32 bytes en base64: `openssl rand -base64 32`) cifra los tokens de Google en la base; si se pierde,
   cada profesional tiene que volver a conectar. `APP_URL` es la URL pública de la app (a donde vuelve el consentimiento).
5. Registrar la URL de las funciones (`supabase/seeds/004_functions_url.sql`) y, en la app, *Turnos → Disponibilidad →
   Conectar Google Calendar*.

Las pruebas de la lógica pura de la función: `cd supabase/functions/google && deno test lib_test.ts`.

### Iniciar sesión con Google (opcional)

Usa el mismo ID de cliente OAuth de arriba. Para activarlo:

1. En Google Cloud, sumar una **segunda URI de redirección** al mismo cliente:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. En Supabase → *Authentication → Sign In / Providers → Google*: habilitarlo y pegar el Client ID y el Client Secret.
3. En Supabase → *Authentication → URL Configuration*: poner `http://localhost:5173` como Site URL y agregar
   `http://localhost:5173/**` a las Redirect URLs (y la URL pública cuando se publique la app).
4. Agregar `VITE_GOOGLE_LOGIN=true` al `.env` para que aparezca el botón **Continuar con Google**.

Importante: Supabase vincula el login de Google a la cuenta existente **solo si el email coincide** (y está confirmado).
Hay que entrar con el mismo Gmail con el que se registró la cuenta; con otro se crea un usuario nuevo, sin pacientes.

El login (sesión de la app) y la conexión del calendario son pasos separados: el login pide solo los datos básicos y
la conexión pide el permiso de calendario una única vez, sugiriendo la misma cuenta de Google.

## Anotaciones y plan de alimentación

- **Anotaciones**: en la ficha de cada paciente, pestaña *Anotaciones*: una bitácora con fecha, editable y borrable
  entrada por entrada. Es información libre del profesional; no se muestra al paciente.
- **Plan de alimentación**: pestaña *Plan de alimentación*, una grilla de 7 días × 4 comidas por paciente, con
  historial de planes anteriores. Se puede armar a mano o generar un borrador con **Generar con IA**, que usa las
  restricciones alimenticias, la última medición y las anotaciones recientes del paciente.

La generación con IA usa la [API de Gemini](https://aistudio.google.com/) (Google AI Studio → *Get API key*, no
requiere el mismo cliente OAuth que Google Calendar). Configuración:

```sh
set -a; . ./.env; set +a
supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY"
supabase functions deploy mealplan --use-api
```

`GEMINI_MODEL` es opcional (por defecto `gemini-3.6-flash`). La función corre con `verify_jwt` activo (el valor por
defecto de Supabase): sólo el profesional dueño del paciente puede generarle un plan, porque la consulta a la base se
hace con su propia sesión, no con permisos de administrador.

Pruebas de la lógica pura: `cd supabase/functions/mealplan && deno test lib_test.ts`.
