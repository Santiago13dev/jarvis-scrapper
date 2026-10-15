# Jarvis IA — máquina de clientes

Jarvis encuentra negocios en Google Maps, detecta cuáles necesitan los servicios de **Jarvis IA** (páginas web, tiendas virtuales, SEO, Google Ads, asistentes de IA para WhatsApp), les escribe un mensaje personalizado y lo envía por WhatsApp **cuando tú lo apruebas**. Funciona en **Colombia, España y Estados Unidos**.

```
Buscar ──► Enriquecer ──► Puntuar ──► Redactar ──► Aprobar ──► Enviar ──► Seguir ──► Cerrar
Google     web, correo,   0–100 y     mensaje      un clic    WhatsApp    a los 3    respuestas
Maps       redes, WA      servicio    por lead     tuyo       seguro      días       en el chat
```

---

## Índice

- [Qué hace](#qué-hace)
- [Cómo decide a quién venderle](#cómo-decide-a-quién-venderle)
- [Envío seguro por WhatsApp](#envío-seguro-por-whatsapp)
- [Pantallas](#pantallas)
- [Arquitectura](#arquitectura)
- [Instalación local](#instalación-local)
- [Configuración](#configuración)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [API principal](#api-principal)
- [Antes de producción](#antes-de-producción)
- [Uso responsable](#uso-responsable)

---

## Qué hace

| Paso | Qué ocurre | Dónde vive |
|---|---|---|
| **1. Buscar** | Escribes `dentistas en Madrid` o `dentists in Miami`. Jarvis detecta rubro, ciudad y país, geocodifica la ciudad y lanza la búsqueda en Google Maps en el idioma del país. | `GoogleMapsScraperAdapter` |
| **2. Limpiar** | Descarta negocios cerrados definitivamente, deduplica por teléfono, dominio y nombre+dirección, y separa Instagram/Facebook/wa.me que Google muestra como "sitio web". | `ImportLeadsFromScraperUseCase`, `LeadDeduplicationService` |
| **3. Enriquecer** | Extrae correos de cada web, normaliza el teléfono a formato internacional y detecta si es celular (WhatsApp). Audita la web: HTTPS, móvil, velocidad, SEO, chatbot, redes. | `enrich_imported_leads` (worker) |
| **4. Puntuar** | Calcula una oportunidad de 0 a 100 y recomienda **qué servicio venderle** con las razones. | `LeadScoringService` |
| **5. Redactar** | Escribe el primer mensaje personalizado: usted en Colombia, tú en España, inglés en EE. UU. | `OutreachMessageService` |
| **6. Aprobar** | Revisas y editas en la bandeja. Nada sale sin tu aprobación. | `/approvals` |
| **7. Enviar** | Programa los envíos con límite diario, pausas aleatorias y horario laboral del país del cliente. | `OutreachService`, `send_outreach_draft` |
| **8. Seguir** | Si no responde en N días, deja listo un segundo mensaje para aprobar. Si responde, se cancela todo lo pendiente. | `mark_follow_up_due` |
| **9. Atender** | Las respuestas llegan al chat de Conversaciones. Quien escribe "NO" o "STOP" queda bloqueado para siempre. | `/conversations`, webhook |

El **Piloto automático** repite los pasos 1–5 solo, cada día, cada 3 días o cada semana, para las combinaciones de rubros y ciudades que definas.

---

## Cómo decide a quién venderle

Cada lead se evalúa contra todos los servicios y se queda con el de mayor puntaje. Además de la necesidad, pesa la **capacidad de pago**: reseñas, rating y si tiene canal de contacto.

| Servicio recomendado | Señal principal | Precio (solo CO) |
|---|---|---|
| **Landing Page Profesional** | Sin web propia y negocio pequeño (< 100 reseñas) | desde $800.000 |
| **Página Web Corporativa** | Sin web propia y negocio establecido, o web caída o deficiente | desde $1.500.000 |
| **Tienda Virtual** | Comercio que vende por redes sin tienda online | desde $2.200.000 |
| **Posicionamiento SEO** | Tiene web activa pero sin título o meta descripción | desde $500.000/mes |
| **SEO + Google Ads** | Sector competitivo (abogados, clínicas, inmobiliarias…) | desde $800.000/mes |
| **Asistente IA WhatsApp** | Sector con muchas consultas y alto volumen de clientes, sin chatbot | desde $1.000.000 |

En España y Estados Unidos se recomienda el servicio **sin precio**, hasta que definas tarifas en EUR/USD. Las categorías de Google Maps se reconocen en español y en inglés.

---

## Envío seguro por WhatsApp

WhatsApp bloquea números que envían mensajes no solicitados de forma masiva. Jarvis reduce ese riesgo por diseño:

- **Aprobación humana**: ningún mensaje sale sin tu clic.
- **Límite diario configurable** (40 por defecto) y **1–2,5 minutos aleatorios** entre envíos.
- **Horario laboral local** del cliente (9:00–19:00, sin domingos), por zona horaria del país.
- **Solo celulares**: los fijos se descartan (en Colombia empiezan por 3; en España, por 6 o 7).
- **Baja inmediata**: quien responde NO, STOP o BAJA queda en "no contactar" y se cancelan sus pendientes.
- **Chats personales intocables**: el webhook ignora cualquier número al que Jarvis no haya escrito primero; nunca crea leads ni responde a tus contactos.
- **Sin IA configurada**, las respuestas pasan a una persona en lugar de contestar mal.

> Para volumen alto usa la **WhatsApp Business Platform (Cloud API)** oficial de Meta. OpenWA (WhatsApp Web) sirve para empezar, pero Meta puede bloquear el número. El adaptador `MessagingProvider` permite cambiar de proveedor sin tocar el resto del sistema.

---

## Pantallas

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Jarvis te dice qué hacer hoy. Buscador inteligente, primeros pasos, actividad de los últimos 14 días, meta de envíos, embudo, servicios, mercados y a quién escribir primero. |
| **Buscar clientes** | Tarjetas o tabla con filtros (oportunidad alta, con WhatsApp, sin web, por servicio, país y etapa), panel de detalle con contacto en un toque, acciones masivas y exportación a Excel. |
| **Piloto automático** | Búsquedas programadas por país × rubros × ciudades, con frecuencia, profundidad y puntaje mínimo. |
| **Aprobar mensajes** | Bandeja con los mensajes escritos por Jarvis, editables, para aprobar uno a uno o en lote. |
| **Conversaciones** | Chat con los clientes que respondieron. Puedes contestar desde Jarvis. |
| **Campañas / Plantillas** | Envíos agrupados con una plantilla fija (`{{lead_name}}` se reemplaza por el nombre del negocio). |
| **WhatsApp** | Conexión por QR paso a paso, estado del número, uso del día y mensaje de prueba. |
| **Configuración** | Firma de los mensajes, límite diario, días de seguimiento, puntaje mínimo, base de conocimiento del agente IA y estado en vivo de las integraciones. |

---

## Arquitectura

Arquitectura hexagonal (puertos y adaptadores): el dominio y los casos de uso no conocen Google Maps, OpenWA ni OpenAI.

```
frontend (Next.js 14) ──HTTP──► backend (FastAPI) ──► PostgreSQL 16
                                   │      ▲
                                   │      └── webhook ◄── openwa (WhatsApp Web, :8090)
                                   ├──► google-maps-scraper (gosom, :8080)
                                   └──► Redis ◄── worker (ARQ): enriquecer, puntuar, piloto,
                                                  enviar y seguimientos (cron cada 10 min)
```

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic, Pydantic 2 |
| Datos y colas | PostgreSQL 16, Redis 7, ARQ |
| Integraciones | gosom/google-maps-scraper, OpenWA (whatsapp-web.js), OpenAI (opcional), Nominatim (geocodificación) |

```
backend/app/
├── domain/            entidades (Lead, Conversation…), países y reglas puras
├── application/       casos de uso, servicios (scoring, outreach, auditoría web) y puertos
└── infrastructure/    API REST, modelos SQLAlchemy, adaptadores, jobs del worker
frontend/src/
├── app/               pantallas (dashboard, leads, autopilot, approvals, conversations…)
├── components/        layout, buscador inteligente, tarjetas de lead, UI base
└── lib/               cliente API, secciones y colores, intérprete de búsquedas
integrations/openwa/   servidor de WhatsApp (QR, envío, reenvío de respuestas)
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
| WhatsApp (QR) | http://localhost:8090 |

**Primeros pasos en la app:**
1. Crea tu cuenta en `/register`.
2. Conecta WhatsApp en **WhatsApp** (escanea el QR).
3. En **Configuración → Agente IA**, pulsa *Usar mis servicios de Jarvis IA*.
4. Haz tu primera búsqueda en **Inicio**, por ejemplo `restaurantes en Medellín`.
5. Revisa y aprueba los mensajes en **Aprobar mensajes**.
6. Activa el **Piloto automático** para que se repita solo.

---

## Configuración

| Variable | Para qué |
|---|---|
| `DATABASE_URL`, `POSTGRES_*` | Conexión a PostgreSQL |
| `REDIS_URL` | Colas y tareas programadas |
| `JWT_SECRET_KEY` | Firma de sesiones. **Obligatorio cambiarla.** |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Respuestas automáticas con IA (opcional; sin clave, las respuestas pasan a una persona) |
| `OPENWA_BASE_URL` | Servidor de WhatsApp para el backend |
| `NEXT_PUBLIC_OPENWA_URL` | Servidor de WhatsApp para el navegador (QR, estado, prueba) |
| `SCRAPER_API_URL` | Servicio de Google Maps |
| `SCRAPER_LATITUDE`, `SCRAPER_LONGITUDE` | Centro por defecto si no se puede geocodificar la ciudad |
| `NEXT_PUBLIC_API_URL` | URL pública de la API |

Los ajustes comerciales (firma, límite diario, días de seguimiento, puntaje mínimo y base de conocimiento) se editan desde **Configuración**, por workspace.

---

## Desarrollo y pruebas

```bash
# Backend: pruebas unitarias
cd backend && pytest -q

# Frontend: tipos y lint
cd frontend && npx tsc --noEmit && npx next lint

# Reiniciar servicios tras cambios en el worker o el servidor de WhatsApp
docker restart prospectai_worker
docker compose up -d --build openwa
```

En Windows, `docker-compose.yml` activa `WATCHPACK_POLLING` para que el frontend recargue al editar archivos.

---

## API principal

Todo bajo `/api/v1/workspaces/{workspace_id}`. La documentación interactiva completa está en `/api/docs`.

| Método y ruta | Descripción |
|---|---|
| `POST /leads/import` | Busca en Google Maps (`keyword`, `location`, `country`, `depth`) |
| `GET /leads` | Lista de leads con puntaje y servicio recomendado |
| `PATCH /leads/{id}/status` | Cambia la etapa o marca "no contactar" |
| `GET /dashboard/overview` | Indicadores, embudo, actividad y mejores oportunidades |
| `GET/POST /automation/autopilot/rules` | Reglas del piloto automático |
| `POST /automation/autopilot/rules/{id}/run` | Ejecuta una regla ya |
| `GET /automation/outreach` | Bandeja de mensajes |
| `POST /automation/outreach/approve` | Aprueba y programa envíos |
| `POST /automation/outreach/draft` | Pide a Jarvis que escriba para ciertos leads |
| `POST /whatsapp/conversations/{id}/messages` | Responde a un cliente |
| `GET/PUT /settings` | Ajustes comerciales del workspace |
| `GET /settings/integrations` | Estado de WhatsApp, scraper, worker y OpenAI |

---

## Antes de producción

- [ ] Servidor con HTTPS y dominio. Docker Compose sin montajes de código ni `--reload`, y build de Next.js en modo producción.
- [ ] Secretos fuertes (`JWT_SECRET_KEY`, base de datos) gestionados fuera del repositorio.
- [ ] Endpoint de renovación de sesión (hoy la sesión dura 30 minutos).
- [ ] Proteger el webhook de WhatsApp con un token compartido y cerrar los puertos internos (5432, 6379, 8080, 8090).
- [ ] Copias de seguridad automáticas de PostgreSQL.
- [ ] Migrar a **WhatsApp Cloud API** oficial, con plantillas aprobadas por Meta, para volumen alto.
- [ ] Monitoreo de errores y logs (por ejemplo Sentry) y alertas si el worker se detiene.
- [ ] Tarifas en EUR/USD para España y Estados Unidos.

---

## Uso responsable

Google Maps y WhatsApp son servicios de terceros con sus propios términos, y cada país regula la comunicación comercial no solicitada (por ejemplo la Ley 1581 de 2012 en Colombia, el RGPD y la LSSI en España, y la TCPA en Estados Unidos). Contacta solo a empresas, identifica siempre quién escribe, ofrece una forma clara de darse de baja y respétala de inmediato.
