# JarvisIA — Project Context

## What is this?
Lead generation CRM that scrapes businesses from Google Maps, displays them with AI scoring, and enables WhatsApp campaign outreach. Built for Santiago's agency.

**Brand name**: JarvisIA (was ProspectAI/LeadScraper)
**Status**: Functional MVP, UI redesigned, core features working

---

## Quick Commands

### Docker
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker restart prospectai_frontend   # Restart frontend (after file changes)
docker restart prospectai_backend    # Restart backend
```

### Frontend (inside container)
```bash
docker exec prospectai_frontend rm -rf /app/.next   # Clear Next.js cache before restart
docker exec prospectai_frontend npm install <pkg> --legacy-peer-deps  # Install packages
```

### Verify
```bash
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login   # Frontend
curl.exe -s -o NUL -w "%{http_code}" http://localhost:8000/health  # Backend
```

### Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1
- Swagger: http://localhost:8000/docs
- OpenWA WhatsApp: http://localhost:8090

---

## Architecture

Hexagonal Architecture (Ports & Adapters):
- **Domain**: Pure Python entities, value objects, events, exceptions
- **Application**: Use cases + Port interfaces (ABCs) + DTOs
- **Infrastructure**: FastAPI routers, SQLAlchemy models, concrete adapters, ARQ workers

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async), Alembic, Pydantic 2.9 |
| Frontend | Next.js 14 (App Router), React 18, TypeScript 5.6, Tailwind 3.4 |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, ARQ |
| Maps | Leaflet + react-leaflet 4.2 |
| Charts | Recharts 3.10 |
| Export | CSV compatible con Excel generado en el navegador (`lib/leads.ts`); openpyxl 3.1.5 (backend) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| AI | OpenAI gpt-4o-mini |
| Scraper | gosom/google-maps-scraper (Go, web mode at :8080) |
| WhatsApp | OpenWA (node, whatsapp-web.js) |

---

## Docker Services

| Service | Port | Notes |
|---------|------|-------|
| postgres | 5432 | User/pass/db: prospectai |
| redis | 6379 | |
| backend | 8000 | Volume: `./backend:/app`, auto-reloads |
| frontend | 3000 | Volume: `./frontend:/app`, own `node_modules` preserved |
| google-maps-scraper | 8080 | Web mode, sidecar |
| worker | — | ARQ background jobs (campaign messages) |
| openwa | 8090 | WhatsApp session |

---

## Frontend Structure

```
frontend/src/
├── app/
│   ├── layout.tsx          # Root: Space Grotesk + Inter + JetBrains Mono fonts
│   ├── page.tsx            # Landing page (marketing)
│   ├── login/page.tsx      # Login with robot AI background
│   ├── register/page.tsx   # Registration
│   ├── dashboard/page.tsx  # KPIs, map, charts
│   ├── leads/page.tsx      # Leads: stats, quick filters, table/cards, drawer, import jobs
│   ├── outreach/page.tsx   # "Contactar hoy": daily queue + follow-ups (assisted WhatsApp)
│   ├── campaigns/page.tsx  # Campaign list
│   ├── templates/page.tsx  # Message templates
│   ├── conversations/page.tsx  # Chat split view
│   ├── whatsapp/page.tsx   # QR code + status
│   └── settings/page.tsx   # Workspace/AI/WhatsApp config
├── components/
│   ├── layout/ (sidebar + mobile bottom nav, topbar, app-shell, logo)
│   ├── leads/ (import-panel, lead-drawer, lead-badges)
│   └── ui/ (button, card, dialog, badge, score-ring, bogota-map)
├── hooks/use-active-workspace.ts  # Workspace from localStorage
├── lib/api-client.ts              # HTTP client (fetch, JWT auth)
├── types/api.ts                   # TypeScript types matching Pydantic schemas
└── styles/globals.css             # CSS vars, dark theme, Leaflet overrides
```

### Design Tokens
- Background: `#080a12` (void)
- Accent: `#825aff` (purple) — `bg-accent`, `text-accent`
- Teal: `#00d296`, Amber: `#ffb432`, Red: `#ff4060`, Blue: `#468cff`, Pink: `#ff6090`
- Card: `bg-card` (dark gray), Border: `border-border/40`
- Fonts: `font-display` (Space Grotesk), `font-mono-data` (JetBrains Mono)

### Important Frontend Notes
- Dynamic Tailwind classes don't work (e.g., `` bg-${color}/10 ``) — use static classes
- `accent-[#825aff]` for checkbox/radio accent color (not `accent-signal-purple`)
- Use `next/dynamic` with `{ ssr: false }` for Leaflet maps
- `react-leaflet@5` requires React 19 — must use `react-leaflet@4` with `--legacy-peer-deps`
- Install packages inside Docker: `docker exec prospectai_frontend npm install <pkg> --legacy-peer-deps`

---

## Backend Structure

```
backend/app/
├── main.py                         # FastAPI app, CORS, routers
├── domain/
│   ├── entities/ (Organization, Workspace, User, Lead, Campaign, Conversation, MessageTemplate)
│   ├── events/, exceptions/, services/, value_objects/
├── application/
│   ├── use_cases/ (9 use cases - import, analyze, export, campaigns, messaging, auth)
│   ├── ports/ (ScraperProvider, AIProvider, MessagingProvider, etc.)
│   └── mappers/
├── infrastructure/
│   ├── api/v1/ (auth, users, leads, campaigns, templates, whatsapp, dashboard, ai)
│   ├── adapters/ (GoogleMapsScraperAdapter, OpenAIAdapter, OpenWAAdapter, etc.)
│   ├── database/models/ (SQLAlchemy models)
│   ├── repositories/ (Postgres implementations)
│   ├── config/config.py (pydantic-settings)
│   └── workers/ (ARQ jobs)
└── shared/ (utils, security, constants)
```

### Key API Routes (all under /api/v1)
- `POST /auth/login` → JWT tokens
- `GET /users/me/workspaces` → list workspaces
- `GET /workspaces/{id}/leads?limit=5000` → list leads (default limit is 50!)
- `POST /workspaces/{id}/leads/import-jobs` → background Google Maps search (ARQ `import_leads_job`); poll `GET .../import-jobs/{job_id}`
- `POST /workspaces/{id}/leads/enrich` → re-enrich + re-score all leads
- `GET /workspaces/{id}/leads/outreach-queue` / `POST .../leads/{lead_id}/contacted` → "Contactar hoy"
- `GET|PATCH /workspaces/{id}/settings` → workspace name, category, AI knowledge base
- `GET|POST /whatsapp/cloud/webhook` → Meta Cloud API (signature-verified)
- `POST /workspaces/{id}/campaigns` → create campaign
- `GET /workspaces/{id}/templates/messages` → list templates (NOT /templates)
- `GET /workspaces/{id}/dashboard/summary` → KPIs

### CSV Column Mapping (Google Maps Scraper)
The gosom scraper outputs: `review_rating`, `review_count` (not `rating`/`reviews_count`)
Fixed in `backend/app/infrastructure/adapters/scraper/google_maps_adapter.py` lines 96-97

### Gotchas
- `prospectai_worker` has no auto-reload: `docker restart prospectai_worker` after backend job changes.
- On Windows the frontend container may not see new files: `docker restart prospectai_frontend`.
- Lead scoring = "potencial de venta" (fit + digital gap). `WebAudit.audited_at` defaults to now, so detect a real audit by its result fields.

---

## Database

PostgreSQL 16 with 13 tables:
organizations → workspaces → users (+ workspace_memberships)
leads (unique on workspace_id + raw_source_id)
campaigns → campaign_leads (N:M)
message_templates, conversations → messages
lead_notes, lead_tasks, lead_follow_ups, lead_import_jobs, demo_page_templates
workspaces.knowledge_base (AI agent context, migration 0008)

---

## Environment Variables (.env)

```
DATABASE_URL=postgresql+asyncpg://prospectai:prospectai@postgres:5432/prospectai
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=change-me-in-production
OPENAI_API_KEY=          # Must be set for AI features
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_OPENWA_URL=http://localhost:8090
SCRAPER_API_URL=http://google-maps-scraper:8080
```

---

## Known Issues / TODO
- No `/auth/refresh` endpoint yet (token expires after 30min, must re-login)
- No fine-grained RBAC (admin/member/viewer roles exist but not enforced)
- Campaign status: draft→running→paused→finished (draft cannot go directly to finished)
- Templates API routes are under `/templates/messages` not `/templates`
- Frontend volume mount: `./frontend:/app` with anonymous `node_modules` volume
- `Math.random()` in SSR causes hydration mismatch — use null-state skeletons

---

## User
- **Santiago** — runs a marketing/lead gen agency
- Prefers Spanish UI labels
- Login: uses email `kevin.rodriguezgomez1308@gmail.com` (or similar kevin emails)
- Workspace: "Principal" (id: `979ebcf3-bc87-43b5-8e4e-a62aa5486f8e`)
- Wants Instagram/Facebook scraping in future (architecturally possible via new adapters)
- Prefers visual-first development, sees screenshots for feedback
