# Decisiones de Arquitectura — ProspectAI

> Estado: los 7 pasos de la metodología de trabajo están cubiertos de punta a punta
> (arquitectura → modelo de datos → adapters → casos de uso → API → frontend). El
> proyecto compila conceptualmente pero **no ha sido probado en ejecución real**
> (`docker compose up`, migraciones, npm install) — ver la sección "Pendientes y gaps
> conocidos" al final antes de darlo por listo para producción.

---

## Parte 1 — Decisiones de arquitectura

### 1. Patrón: Arquitectura Hexagonal (Ports & Adapters) + Clean Architecture

Regla de dependencias, de afuera hacia adentro:

```
Infrastructure  (FastAPI, PostgreSQL, OpenAI, OpenWA, Redis, ARQ...)
      │
      ▼
Application     (Use Cases + Ports)
      │
      ▼
Domain          (Entities + Business Rules) — Python puro
```

- El **dominio** no conoce casos de uso ni frameworks.
- Los **casos de uso** no conocen frameworks (FastAPI, SQLAlchemy, etc.), sólo Ports.
- La **infraestructura** es la única capa que conoce librerías y proveedores externos.

### 2. Ports (6 confirmados) + EventBus + Repositorios

| Port | Adapter inicial | Futuro reemplazo posible |
|---|---|---|
| `ScraperProvider` | `GoogleMapsScraperAdapter` (invoca el repo gosom externo) | Otro scraper / API de datos |
| `AIProvider` | `OpenAIAdapter` | Anthropic, modelos locales |
| `MessagingProvider` | `OpenWAAdapter` | WhatsApp Cloud API oficial |
| `FileStorageProvider` | Adapter de disco local | S3 / GCS |
| `QueueProvider` | `ArqQueueAdapter` (ARQ + Redis) | RabbitMQ, AWS SQS |
| `CacheProvider` | `RedisCacheAdapter` | Otro motor de caché |

Además, un **`EventBus`** definido desde el inicio (con una implementación in-memory) para
desacoplar efectos secundarios: `LeadImported → AIAnalyzed → CampaignCreated →
MessageSent → ConversationUpdated`. Cuando se necesite analítica, auditoría o
notificaciones, se suscribe un handler nuevo sin tocar los casos de uso existentes.

Y **repositorios separados de `FileStorageProvider`** (responsabilidad distinta: datos
estructurados vs. archivos binarios): `LeadRepository`, `CampaignRepository`,
`ConversationRepository`, `TemplateRepository`, `UserRepository` +
`OrganizationRepository`, `StatisticsRepository`.

### 3. Google Maps Scraper — aislado completamente

`integrations/google-maps-scraper` (repo gosom, sin modificar) vive en la **raíz del
repositorio**, fuera de `backend/`, porque es un proyecto Go independiente invocado como
proceso externo, no un paquete Python importable. El adapter
(`infrastructure/adapters/scraper/`) sólo hace:

```
Run scraper → esperar resultado → leer CSV/JSON → convertir a Lead → retornar List[Lead]
```

Nunca se mezcla lógica del scraper con el dominio de ProspectAI.

### 4. Multi-Tenancy: Organization → Workspace → User

Reemplaza el modelo plano de `tenant_id` único por dos niveles:

```
Organization (agencia)
  └── Workspace (cliente de la agencia: ej. "Coca-Cola", "Adidas", "Nike")
        └── Users (con rol por workspace: admin / member / viewer)
```

Todas las tablas de negocio (leads, campañas, conversaciones, plantillas, páginas demo,
estadísticas) llevan `workspace_id`. Esto permite que una misma agencia gestione varios
clientes de forma completamente aislada, y que un usuario tenga distintos permisos según
el workspace.

**Para el MVP:** una sola base de datos, aislamiento vía `workspace_id` + índices (no
schema-per-tenant). Migrar a schema-per-cliente o BD dedicada sólo se justifica a escala
Enterprise (miles de clientes).

### 5. Versionado de API — organizado por dominio

```
infrastructure/api/v1/
├── auth/        ├── leads/        ├── whatsapp/     ├── users/
├── campaigns/   ├── ai/           ├── templates/    └── dashboard/
```

En vez de carpetas genéricas `routers/` + `schemas/` mezclando todos los endpoints, cada
módulo de dominio agrupa su propio router + schemas. Permite introducir `v2` a futuro sin
romper integraciones existentes.

### 6. Colas: ARQ + Redis (no Celery)

Celery es potente pero pesado para este caso de uso. **ARQ** se eligió por asyncio
nativo (encaja con FastAPI sin adaptadores extra), poco boilerplate, y porque es
suficiente para decenas de miles de jobs (envío de campañas, scraping en background).

```
Campaña → crear Job → worker (infrastructure/workers/) → enviar WhatsApp → guardar estado → siguiente
```

### 7. Aislamiento de datos: `workspace_id` compartido (no schema-per-tenant)

Confirmado para el MVP: una sola base de datos con `workspace_id` en cada tabla e índices
compuestos. Se revisará sólo si el volumen de clientes Enterprise lo justifica.

### 8. Separación de `StorageProvider`

`StorageProvider` (mezclaba exportaciones y archivos) se dividió en:

- **Repositorios** de entidades (`LeadRepository`, `CampaignRepository`, etc. — persistencia)
- **`FileStorageProvider`** (sólo archivos binarios: exportaciones generadas, imágenes)

Las exportaciones (Excel/CSV/JSON) son un caso de uso que combina un repositorio +
`FileStorageProvider`, no un método de un único "storage" genérico.

### 9. EventBus definido desde el inicio

Puerto (`application/ports/event_bus.py`) y clase base de eventos
(`domain/events/base_event.py`) existen desde el paso 2, con implementación in-memory
desde el paso 4 (`InMemoryEventBus`). Cuando se reemplace por Redis Pub/Sub u otro broker,
los casos de uso no cambian: sólo publican eventos.

---

## Parte 2 — Estructura de carpetas final

```
ProspectAI/
├── backend/
│   └── app/
│       ├── domain/
│       │   ├── entities/        (Organization, Workspace, User, Lead, Campaign,
│       │   │                     Conversation, MessageTemplate, DemoPageTemplate...)
│       │   ├── value_objects/   (LeadScore)
│       │   ├── services/
│       │   ├── events/          (DomainEvent + eventos concretos)
│       │   └── exceptions/
│       │
│       ├── application/
│       │   ├── use_cases/       (9 casos de uso — ver Parte 3, paso 5)
│       │   ├── ports/
│       │   │   └── repositories/
│       │   ├── dto/
│       │   └── mappers/         (entidad ↔ modelo ORM)
│       │
│       ├── infrastructure/
│       │   ├── api/v1/          (auth, users, leads, campaigns, templates,
│       │   │                     whatsapp, dashboard, ai)
│       │   ├── database/        (SQLAlchemy models + session)
│       │   ├── adapters/        (ai, messaging, scraper, file_storage, queue,
│       │   │                     cache, event_bus)
│       │   ├── repositories/    (implementaciones Postgres)
│       │   ├── workers/         (jobs ARQ)
│       │   ├── config/          (settings)
│       │   └── dependencies/    (wiring de DI + auth)
│       │
│       ├── shared/
│       │   ├── utils/
│       │   ├── logging/
│       │   ├── security/        (password hashing, JWT)
│       │   └── constants/
│       │
│       ├── alembic/             (migración inicial 0001_initial_schema)
│       └── tests/
│
├── frontend/
│   └── src/
│       ├── app/                 (login, dashboard, leads, campaigns — Next.js App Router)
│       ├── components/
│       │   ├── ui/              (Button, Badge, Card, ScoreRing)
│       │   └── layout/          (Sidebar, Topbar, AppShell, Logo)
│       ├── hooks/                (use-active-workspace)
│       ├── lib/                  (api-client, utils)
│       ├── types/                (api.ts)
│       └── styles/               (globals.css — design tokens)
│
├── integrations/
│   └── google-maps-scraper/     (repo gosom, externo, sin modificar)
│
├── docker-compose.yml
└── .env.example
```

---

## Parte 3 — Progreso de implementación

### Paso 1 — Estructura de carpetas ✅

Scaffolding inicial de `backend/`, `frontend/`, `integrations/`, y arquitectura hexagonal
completa (domain / application / infrastructure / shared).

### Paso 2 — Contratos entre módulos (Ports + Repository interfaces) ✅

Los 6 Ports + `EventBus` + 7 repository interfaces definidos como ABCs con DTOs tipados
(ver Parte 1, sección 2).

### Paso 3 — Modelo de datos ✅

- **Entidades de dominio**: `Organization`, `Workspace`, `User` + `WorkspaceMembership`,
  `Lead` (+ `LeadNote`, `LeadTask`), `Campaign`, `Conversation` + `Message`,
  `MessageTemplate`, `DemoPageTemplate`. Con reglas de negocio propias (ej.
  `Campaign.transition_to` valida transiciones de estado permitidas).
- **Value Objects**: `LeadScore` (valida rango 0-100).
- **Excepciones de dominio**: `DuplicateLeadError`, `InvalidCampaignTransitionError`,
  `WorkspaceAccessDeniedError`, `KnowledgeBaseRequiredError`.
- **Eventos de dominio**: `LeadImportedEvent`, `LeadAnalyzedEvent`, `CampaignCreatedEvent`,
  `MessageSentEvent`, `ConversationUpdatedEvent`, etc.
- **Modelos SQLAlchemy**: un archivo por agregado, con `workspace_id` indexado en toda
  tabla de negocio, constraint único de deduplicación en `leads (workspace_id,
  raw_source_id)`, y tabla asociativa `campaign_leads` (N:M).
- **Mappers**: convierten entidad ↔ modelo ORM, para que ni el dominio ni los casos de
  uso conozcan SQLAlchemy.
- **Alembic**: `env.py` async-compatible (asyncpg + `run_sync`), migración inicial
  `0001_initial_schema.py` con las 13 tablas, escrita a mano.

### Paso 4 — Adapters concretos + wiring de DI ✅

- **Repositorios Postgres**: `PostgresLeadRepository`, `PostgresCampaignRepository`,
  `PostgresConversationRepository`, `PostgresTemplateRepository`,
  `PostgresUserRepository` + `PostgresOrganizationRepository`,
  `PostgresStatisticsRepository`. Todos scoped por `workspace_id`.
- **`OpenAIAdapter`**: implementa `AIProvider` forzando salida JSON estructurada y un
  system prompt que impide inventar información fuera de la base de conocimiento.
- **`OpenWAAdapter`**: implementa `MessagingProvider` contra el servidor REST de OpenWA
  (@open-wa/wa-automate); aislado para poder reemplazarse por WhatsApp Cloud API.
- **`GoogleMapsScraperAdapter`**: implementa `ScraperProvider` invocando el contenedor
  Docker del repo externo y parseando el CSV resultante a `ScrapedBusiness`.
- **`LocalFileStorageAdapter`**: implementa `FileStorageProvider` en disco local,
  reemplazable por S3/GCS sin tocar casos de uso.
- **`ArqQueueAdapter`** + `infrastructure/workers/worker_settings.py`: implementa
  `QueueProvider`.
- **`RedisCacheAdapter`**: implementa `CacheProvider` con redis-py async.
- **`InMemoryEventBus`**: primera implementación de `EventBus`.
- **`infrastructure/dependencies/providers.py`**: único punto de wiring — decide qué
  adapter concreto satisface cada Port, expuesto como dependencias de FastAPI (`Depends`).

### Paso 5 — Casos de uso ✅

- **`ImportLeadsFromScraperUseCase`**: scraping → deduplicación → `bulk_create` → publica
  `LeadImportedEvent` por cada lead nuevo.
- **`AnalyzeLeadWithAIUseCase`**: arma `BusinessAnalysisInput` desde el Lead, llama a
  `AIProvider.analyze_business`, aplica el `LeadScore` y publica `LeadAnalyzedEvent`.
- **`ExportLeadsUseCase`**: combina `LeadRepository` + `FileStorageProvider`, serializa a
  Excel/CSV/JSON.
- **`CreateCampaignUseCase`** y **`ChangeCampaignStatusUseCase`**: las transiciones de
  estado (pause/resume/finish) las valida la propia entidad `Campaign`. Al pasar a
  `RUNNING`, encola el job `send_campaign_messages` vía `QueueProvider`.
- **`SendCampaignMessagesUseCase`**: por cada lead de la campaña, renderiza la plantilla,
  envía por `MessagingProvider`, crea/actualiza la `Conversation`. Conectado al worker real
  de ARQ en `infrastructure/workers/jobs/send_campaign_messages_job.py`.
- **`ProcessIncomingWhatsAppMessageUseCase`**: el agente conversacional completo. Obtiene/
  crea la `Conversation`, guarda el mensaje entrante, genera respuesta con `AIProvider`
  usando sólo la base de conocimiento del workspace, y transfiere a humano si no puede
  responder en vez de inventar información.
- **`TransferConversationToHumanUseCase`**: transferencia manual.
- **`RegisterOrganizationUseCase`** / **`AuthenticateUserUseCase`**: alta de Organization +
  Workspace por defecto + User admin; login con JWT.

### Paso 6 — Endpoints REST por dominio ✅

- **`/api/v1/auth`**: `POST /register`, `POST /login`.
- **`/api/v1/users`**: `GET /me`, `GET /` (usuarios de la organización), `GET
  /me/workspaces` (lista de workspaces), `GET /me/workspaces/{id}/role`.
- **`/api/v1/workspaces/{workspace_id}/leads`**: list, get, `POST /import`, `POST
  /{id}/analyze`, `PATCH /{id}/status`, `PATCH /{id}/assign`, `POST /export`.
- **`/api/v1/workspaces/{workspace_id}/campaigns`**: list, get, create, `PATCH
  /{id}/status`.
- **`/api/v1/workspaces/{workspace_id}/templates`**: mensajes (`/messages`) y páginas
  demo globales (`/demo-pages`).
- **`/api/v1/whatsapp/webhook`** (público) + **`/api/v1/workspaces/{workspace_id}/whatsapp`**
  (autenticado: status de sesión, conversaciones, transferencia manual).
- **`/api/v1/workspaces/{workspace_id}/dashboard/summary`**.
- **`/api/v1/workspaces/{workspace_id}/ai/test-reply`**.
- **Autenticación**: `shared/security/` (bcrypt + JWT). `require_workspace_access` valida
  membership en el `workspace_id` del path antes de dejar pasar cualquier request.

### Paso 7 — Frontend (scaffolding inicial) ✅

**Identidad visual** (evitando los clichés de diseño IA — cream+terracota, negro+verde
ácido, broadsheet): fondo casi negro con acento ámbar/teal ("señal detectada" / radar de
prospección), Space Grotesk (títulos) + Inter (UI/tablas) + JetBrains Mono (scores,
teléfonos, stats). Elemento de firma: el **Lead Score como anillo de intensidad de
señal** (`ScoreRing`), no un badge plano.

- **Tokens**: `styles/globals.css` + `tailwind.config.ts`.
- **Layout**: `Sidebar`, `Topbar`, `AppShell`, `Logo` (con barrido de radar animado,
  respeta `prefers-reduced-motion`).
- **Primitivas UI**: `Button`, `Badge`/`StatusBadge`, `Card`, `ScoreRing`.
- **Páginas construidas**: `/login`, `/dashboard`, `/leads` (con importación desde
  Google Maps), `/campaigns` (pausar/reanudar/finalizar), todas conectadas a la API real.
- **`lib/api-client.ts`** + **`hooks/use-active-workspace.ts`** + **`types/api.ts`**.

---

## Parte 4 — Pendientes y gaps conocidos

Consolidado de todo lo señalado como pendiente a lo largo de las 7 fases. Nada de esto
bloquea seguir desarrollando, pero conviene resolverlo antes de producción:

**Backend**
- No hay endpoint `POST /auth/refresh` (sólo login inicial emite el par de tokens).
- Los permisos son "tiene acceso al workspace" — falta un modelo de permisos más fino
  por rol (ej. sólo `admin` puede cambiar el estado de una campaña o eliminar un lead).
- `GoogleMapsScraperAdapter`: los flags de CLI (`-input`, `-results`, `-depth`, `-lang`)
  son un placeholder razonable — **verificar contra el README real de
  gosom/google-maps-scraper** antes de usar en producción.
- `ArqQueueAdapter.register_worker` no alimenta al worker real de ARQ (limitación de
  diseño de ARQ: los jobs deben declararse estáticamente en `WorkerSettings.functions`).
  Sirve para tests/fakes; los jobs de producción van en `infrastructure/workers/jobs/`.
- `default_knowledge_base_lookup` lee la base de conocimiento del agente IA desde una
  clave de caché (`kb:{workspace_id}`) — no hay todavía una tabla `workspace_settings`
  administrable desde el frontend para configurarla.
- La migración `0001_initial_schema.py` fue escrita a mano (sin poder ejecutar
  `alembic revision --autogenerate` en este entorno) — **correrla contra una BD de
  prueba** antes de confiar en ella.

**Frontend**
- Páginas pendientes: `/conversations` (bandeja de WhatsApp con transferencia a
  humano), `/templates` (CRUD de plantillas + biblioteca de páginas demo), `/settings`
  (base de conocimiento del agente IA, gestión de usuarios), `/register` (alta de
  Organization).
- Falta el detalle de ficha de un Lead (notas, tareas, historial de conversación).
- No se ha ejecutado `npm install` / `next build` en este entorno — verificar que
  las versiones fijadas en `package.json` resuelven sin conflictos.

**General**
- Todo el proyecto fue escrito sin ejecución real (no hay acceso a Docker/Python/Node
  en esta máquina remota vía MCP) — el próximo paso natural es **levantarlo de verdad**
  y corregir lo que falle en la práctica.
