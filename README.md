# Jarvis IA — máquina de clientes

Jarvis encuentra negocios en Google Maps, detecta cuáles necesitan los servicios de **Jarvis IA** (páginas web, tiendas virtuales, SEO, Google Ads, asistentes de IA para WhatsApp), les escribe un mensaje personalizado y te ayuda a enviarlo por WhatsApp **con tu aprobación**. Funciona en **Colombia, España y Estados Unidos**.

```
Buscar ──► Enriquecer ──► Puntuar ──► Redactar ──► Aprobar ──► Enviar ──► Seguir ──► Cerrar
Google     web, correo,   0–100 y     mensaje      un clic    WhatsApp    a los N    respuestas
Maps       redes, WA      servicio    por lead     tuyo                   días       en el chat
```

---

## Índice

- [Qué hace](#qué-hace)
- [Cómo decide a quién venderle](#cómo-decide-a-quién-venderle)
- [Modos de WhatsApp](#modos-de-whatsapp)
- [Envío seguro](#envío-seguro)
- [Pantallas](#pantallas)
- [Arquitectura](#arquitectura)
- [Instalación local](#instalación-local)
- [Configuración](#configuración)
- [Problemas frecuentes](#problemas-frecuentes)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [API principal](#api-principal)
- [Producción](#producción)
- [Uso responsable](#uso-responsable)

---

## Qué hace

| Paso | Qué ocurre | Dónde vive |
|---|---|---|
| **1. Buscar** | Escribes `dentistas en Madrid` o `dentists in Miami`. Jarvis detecta rubro, ciudad y país, geocodifica la ciudad y lanza la búsqueda en Google Maps **en segundo plano**, con progreso por etapas. | `import_leads_job`, `GoogleMapsScraperAdapter` |
| **2. Limpiar** | Descarta negocios cerrados, deduplica (teléfono, dominio, nombre+dirección) y separa redes sociales y directorios (Tripadvisor, Rappi…) que Google muestra como "sitio web". | `ImportLeadsFromScraperUseCase`, `lead_enrichment` |
| **3. Enriquecer** | Extrae correos, normaliza el teléfono al formato internacional del país y detecta si es celular (WhatsApp). Audita en paralelo cada web: HTTPS, móvil, velocidad, SEO, chatbot, redes. | `enrich_imported_leads` |
| **4. Puntuar** | Oportunidad de 0 a 100 y **qué servicio venderle**, con las razones. | `LeadScoringService` |
| **5. Redactar** | Mensaje personalizado: usted en Colombia, tú en España, inglés en EE. UU. | `OutreachMessageService` |
| **6. Aprobar y enviar** | En modo asistido abres WhatsApp con el texto listo; con OpenWA o la API oficial, Jarvis envía solo con límites y horario. | `/approvals`, `/outreach` |
| **7. Seguir** | Si no responde en N días, deja listo un seguimiento. Si responde, se cancela lo pendiente. | `mark_follow_up_due` |
| **8. Atender** | Las respuestas llegan a **Conversaciones**, donde puedes contestar. "NO" o "STOP" bloquea al contacto para siempre. | `/conversations`, webhooks |

El **Piloto automático** repite los pasos 1–5 solo (cada día, cada 3 días o cada semana) para las combinaciones de rubros y ciudades que definas.

---

## Cómo decide a quién venderle

Cada lead se evalúa contra todos los servicios y se queda con el de mayor puntaje. Además de la necesidad pesa la **capacidad de pago**: reseñas, rating y si tiene canal de contacto.

| Servicio recomendado | Señal principal | Precio (solo CO) |
|---|---|---|
| **Landing Page Profesional** | Sin web propia y negocio pequeño (< 100 reseñas) | desde $800.000 |
| **Página Web Corporativa** | Sin web propia y establecido, web gratuita (Wix, Blogspot…), caída o deficiente | desde $1.500.000 |
| **Tienda Virtual** | Comercio que vende por redes sin tienda online | desde $2.200.000 |
| **Posicionamiento SEO** | Web activa sin título o meta descripción | desde $500.000/mes |
| **SEO + Google Ads** | Sector competitivo (abogados, clínicas, inmobiliarias…) | desde $800.000/mes |
| **Asistente IA WhatsApp** | Sector con muchas consultas, alto volumen de clientes, sin chatbot | desde $1.000.000 |

En España y Estados Unidos se recomienda el servicio **sin precio**. Las categorías de Google Maps se reconocen en español e inglés. Un directorio o red social **no** cuenta como página propia.

---

## Modos de WhatsApp

Se eligen con `WHATSAPP_PROVIDER` en `.env`:

| Modo | Cómo funciona | Costo | Recomendado para |
|---|---|---|---|
| `assisted` *(por defecto)* | Jarvis abre WhatsApp con el mensaje escrito y tú pulsas enviar. Registra el contacto y agenda el seguimiento. | Gratis | Empezar. Sin riesgo de bloqueo porque cada envío es tuyo. |
| `openwa` | WhatsApp Web vinculado por QR (pantalla **WhatsApp**). Los mensajes aprobados salen solos, con límites y horario. | Gratis | Volumen bajo y pruebas: Meta puede bloquear números que automatizan WhatsApp Web. |
| `cloud_api` | API oficial de Meta (WhatsApp Business Platform) con plantillas aprobadas. | Meta cobra por conversación | Volumen alto y automatización real. |

### Activar la API oficial de Meta (`cloud_api`)
1. Crea una app en [developers.facebook.com](https://developers.facebook.com/) y agrega el producto **WhatsApp**.
2. Verifica tu empresa, registra el número y crea una **plantilla de mensaje** (Meta debe aprobarla).
3. Completa en `.env`:
   ```env
   WHATSAPP_PROVIDER=cloud_api
   WHATSAPP_CLOUD_TOKEN=token_permanente_de_la_app
   WHATSAPP_CLOUD_PHONE_NUMBER_ID=id_del_numero
   WHATSAPP_CLOUD_APP_SECRET=secreto_de_la_app        # verifica la firma de los webhooks
   WHATSAPP_CLOUD_VERIFY_TOKEN=una_frase_que_tu_inventes
   WHATSAPP_CLOUD_TEMPLATE=nombre_de_tu_plantilla
   WHATSAPP_CLOUD_TEMPLATE_LANG=es
   WHATSAPP_CLOUD_WORKSPACE_ID=id_del_workspace_que_recibe_respuestas
   ```
4. En Meta configura el webhook `https://TU-DOMINIO/api/v1/whatsapp/cloud/webhook` con el mismo `VERIFY_TOKEN` y suscríbete a **messages**.
5. Reinicia: `docker compose up -d backend worker`.

> El webhook necesita una URL pública con HTTPS. Para pruebas locales usa un túnel (Cloudflare Tunnel o ngrok).

---

## Envío seguro

WhatsApp bloquea números que envían mensajes no solicitados de forma masiva. Jarvis reduce ese riesgo por diseño:

- **Aprobación humana**: ningún mensaje sale sin tu clic.
- **Límite diario configurable** (40 por defecto), **1–2,5 minutos aleatorios** entre envíos y solo en **horario laboral local** del cliente (9:00–19:00, sin domingos). *(OpenWA y API oficial.)*
- **Solo celulares**: los fijos se descartan (Colombia: empiezan por 3; España: por 6 o 7).
- **Baja inmediata**: NO, STOP o BAJA marca "no contactar" y cancela lo pendiente.
- **Chats personales intocables**: el webhook ignora cualquier número al que Jarvis no haya escrito; nunca crea leads ni responde a tus contactos.
- **Webhook protegido** con `OPENWA_WEBHOOK_SECRET` y firma de Meta en la API oficial.
- **Sin IA configurada**, las respuestas pasan a una persona en lugar de contestar mal.

---

## Pantallas

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Jarvis te dice qué hacer hoy: buscador inteligente, primeros pasos, actividad de 14 días, meta de envíos, embudo, servicios, mercados y a quién escribir primero. |
| **Buscar clientes** | Tarjetas o tabla con filtros (oportunidad alta, WhatsApp, sin web, servicio, país, etapa), panel de detalle con contacto en un toque, acciones masivas, **Actualizar datos** y exportación CSV para Excel. |
| **Piloto automático** | Búsquedas programadas por país × rubros × ciudades, con frecuencia, profundidad y puntaje mínimo. |
| **Aprobar mensajes** | Mensajes escritos por Jarvis, editables. Se aprueban (envío automático) o se envían con un toque (modo asistido). |
| **Contactar hoy** | Lista diaria priorizada de negocios con WhatsApp, con mensaje desde tus plantillas y registro del contacto. |
| **Conversaciones** | Chat con los clientes que respondieron; puedes contestar desde Jarvis. |
| **Campañas / Plantillas** | Envíos agrupados con plantilla. Variables: `{{negocio}}`, `{{categoria}}`, `{{ciudad}}`, `{{calificacion}}`, `{{resenas}}`, `{{oportunidad}}`. |
| **WhatsApp** | Conexión por QR (modo OpenWA) o explicación del modo activo, uso del día y mensaje de prueba. |
| **Configuración** | Nombre, rubro, firma, límite diario, días de seguimiento, puntaje mínimo, base de conocimiento del agente IA y estado en vivo de las integraciones. |

---

## Arquitectura

Arquitectura hexagonal (puertos y adaptadores): el dominio y los casos de uso no conocen Google Maps, WhatsApp ni OpenAI.

```
frontend (Next.js 14) ──HTTP──► backend (FastAPI) ──► PostgreSQL 16
                                   │      ▲
                                   │      ├── webhook ◄── openwa (WhatsApp Web, :8090)
                                   │      └── webhook ◄── Meta Cloud API (opcional)
                                   ├──► google-maps-scraper (gosom, :8080)
                                   └──► Redis ◄── worker (ARQ): búsquedas, enriquecimiento,
                                                  piloto (cron cada 10 min), envíos, seguimientos
```

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic, Pydantic 2 |
| Datos y colas | PostgreSQL 16, Redis 7, ARQ |
| Integraciones | gosom/google-maps-scraper, WhatsApp (asistido, OpenWA o Cloud API), OpenAI (opcional), Nominatim |

```
backend/app/
├── domain/            entidades, países, enriquecimiento y reglas puras
├── application/       casos de uso, servicios (puntaje, mensajes, auditoría web) y puertos
└── infrastructure/    API REST, modelos SQLAlchemy, adaptadores y jobs del worker
frontend/src/
├── app/               pantallas (dashboard, leads, autopilot, approvals, outreach, conversations…)
├── components/        layout, buscador inteligente, tarjetas y panel de lead, UI base
└── lib/               cliente API (con renovación de sesión), secciones, búsqueda y CSV
integrations/openwa/   servidor de WhatsApp Web (QR, envío, reenvío de respuestas)
```

---

## Instalación local

**Requisitos:** Docker Desktop con el motor iniciado y Git.

```bash
git clone https://github.com/Santiago13dev/jarvis-scrapper.git
cd jarvis-scrapper
cp .env.example .env          # cambia JWT_SECRET_KEY y POSTGRES_PASSWORD
docker compose up --build -d
```

Las migraciones se aplican solas al arrancar el backend.

| Servicio | URL |
|---|---|
| Aplicación | http://localhost:3000 |
| API y documentación | http://localhost:8000/api/docs |
| Scraper de Google Maps | http://localhost:8080 |
| WhatsApp (QR, modo OpenWA) | http://localhost:8090 |

**Primeros pasos en la app:**
1. Crea tu cuenta en `/register`.
2. En **Configuración → Agente IA**, pulsa *Usar mis servicios de Jarvis IA*.
3. Haz tu primera búsqueda en **Inicio**, por ejemplo `restaurantes en Medellín`.
4. Revisa y envía los mensajes en **Aprobar mensajes** o **Contactar hoy**.
5. Activa el **Piloto automático** para que se repita solo.

---

## Configuración

| Variable | Para qué |
|---|---|
| `ENVIRONMENT` | `development` o `production`. En producción el backend no arranca con secretos inseguros. |
| `DATABASE_URL`, `POSTGRES_*` | Conexión a PostgreSQL |
| `REDIS_URL` | Colas y tareas programadas |
| `JWT_SECRET_KEY` | Firma de sesiones (mínimo 32 caracteres aleatorios en producción) |
| `ALLOW_PUBLIC_REGISTRATION` | `false` cierra el registro tras crear la primera cuenta |
| `WHATSAPP_PROVIDER` | `assisted`, `openwa` o `cloud_api` ([Modos de WhatsApp](#modos-de-whatsapp)) |
| `WHATSAPP_CLOUD_*` | Credenciales de la API oficial de Meta |
| `OPENWA_BASE_URL`, `OPENWA_WEBHOOK_SECRET` | Servidor de WhatsApp Web y secreto que protege su webhook |
| `NEXT_PUBLIC_OPENWA_URL` | Servidor de WhatsApp para el navegador (QR, estado, prueba) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Respuestas automáticas con IA (opcional) |
| `SCRAPER_API_URL`, `SCRAPER_LATITUDE`, `SCRAPER_LONGITUDE` | Servicio de Google Maps y centro por defecto |
| `NEXT_PUBLIC_API_URL` | URL pública de la API |

Los ajustes comerciales (firma, límite diario, días de seguimiento, puntaje mínimo, base de conocimiento) se editan en **Configuración**, por workspace.

---

## Problemas frecuentes

**La búsqueda tarda mucho.** Con extracción de correos, 100 resultados pueden tardar 8–10 minutos. Pasados 40 minutos se marca como fallida y puedes reintentar. Revisa `docker compose logs -f worker google-maps-scraper`.

**Encuentra pocos resultados.** Usa una zona más específica (barrio + ciudad) y el tipo de negocio como aparece en Google Maps («odontólogo» en vez de «salud oral»).

**Un negocio no tiene botón de WhatsApp.** Solo se detectan celulares (Colombia: 3…, España: 6/7…, EE. UU.: cualquier número de 10 dígitos) o enlaces `wa.me` en su web. Los fijos aparecen con *Llamar*.

**No veo mis cambios de código (Windows).** `docker-compose.yml` activa `WATCHPACK_POLLING` para el frontend; para el worker o el servidor de WhatsApp usa `docker restart prospectai_worker` o `docker compose up -d --build openwa`.

**«Sesión expirada».** La sesión se renueva sola mientras uses la aplicación; si pasan días sin usarla, vuelve a iniciar sesión y regresarás a la página donde estabas.

---

## Desarrollo y pruebas

```bash
cd backend && pytest -q                                  # pruebas del backend
cd frontend && npx tsc --noEmit && npx next lint         # tipos y lint
cd frontend && npx next build                            # build de producción
```

---

## API principal

Todo bajo `/api/v1/workspaces/{workspace_id}`. Documentación interactiva en `/api/docs`.

| Método y ruta | Descripción |
|---|---|
| `POST /leads/import-jobs` | Búsqueda en segundo plano (`keyword`, `location`, `country`, `depth`) |
| `GET /leads/import-jobs/{id}` | Progreso de la búsqueda |
| `POST /leads/enrich` | Actualizar datos: WhatsApp, redes, puntaje y auditorías pendientes |
| `GET /leads` / `PATCH /leads/{id}/status` | Leads con puntaje y servicio; cambiar etapa o "no contactar" |
| `GET /leads/outreach-queue` | Lista diaria de "Contactar hoy" |
| `GET /dashboard/overview` | Indicadores, actividad, embudo y mejores oportunidades |
| `GET/POST /automation/autopilot/rules` | Reglas del piloto automático |
| `GET /automation/outreach` | Bandeja de mensajes |
| `POST /automation/outreach/approve` | Aprobar y programar (OpenWA / API oficial) |
| `POST /automation/outreach/{id}/sent` | Registrar un envío hecho a mano (modo asistido) |
| `POST /whatsapp/conversations/{id}/messages` | Responder a un cliente |
| `GET/PATCH /settings`, `GET /settings/integrations` | Ajustes del workspace y estado de integraciones |

---

## Producción

`docker-compose.yml` está pensado para desarrollo (código montado y recarga automática). Para publicar:

- [ ] Servidor con Docker, dominio y HTTPS (Caddy o Traefik).
- [ ] `ENVIRONMENT=production`, secretos robustos, `OPENWA_WEBHOOK_SECRET` y `ALLOW_PUBLIC_REGISTRATION=false` tras crear tu cuenta.
- [ ] Sin montajes de código ni `--reload`; frontend compilado con `next build`.
- [ ] No exponer PostgreSQL, Redis, el scraper ni OpenWA a internet.
- [ ] Copias de seguridad diarias: `docker exec prospectai_postgres pg_dump -U prospectai -Fc prospectai > respaldo.dump`.
- [ ] Monitoreo de errores (por ejemplo Sentry) y alerta si el worker se detiene.
- [ ] Para volumen alto, `WHATSAPP_PROVIDER=cloud_api` con plantillas aprobadas.
- [ ] Tarifas en EUR/USD para España y Estados Unidos.

---

## Uso responsable

Google Maps y WhatsApp son servicios de terceros con sus propios términos, y cada país regula la comunicación comercial no solicitada (Ley 1581 de 2012 en Colombia; RGPD y LSSI en España; TCPA en Estados Unidos). Contacta solo a empresas, identifica siempre quién escribe, ofrece una forma clara de darse de baja y respétala de inmediato.
