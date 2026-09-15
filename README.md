# JarvisIA

JarvisIA es una consola de prospección comercial para agencias y equipos de ventas. Centraliza la búsqueda de negocios locales, la gestión de leads y la preparación de campañas de contacto desde un solo workspace.

## Cómo funciona

1. Busca un rubro y una ubicación desde **Leads**.
2. JarvisIA consulta Google Maps y guarda los negocios encontrados en tu workspace.
3. Filtra por información útil, por ejemplo: negocios sin página web, con teléfono o con correo electrónico.
4. Revisa los leads y crea una plantilla de mensaje profesional.
5. Agrupa leads seleccionados en una campaña y controla su estado desde **Campañas**.
6. Conecta un número de WhatsApp mediante QR para realizar pruebas controladas de envío.

El dashboard muestra métricas reales del workspace: leads disponibles, campañas activas, conversaciones y mensajes enviados.

## Características

- Extracción de negocios locales desde Google Maps.
- CRM multi-workspace para leads, estados, filtros y exportación.
- Plantillas de mensajes y campañas de outreach.
- Dashboard con información operativa real.
- Integración opcional con OpenAI para análisis de leads.
- Interfaz responsive para computador y celular.

## Tecnologías

- Frontend: Next.js, React, TypeScript y Tailwind CSS.
- Backend: FastAPI, SQLAlchemy, Alembic y Pydantic.
- Infraestructura: Docker Compose, PostgreSQL, Redis y ARQ.
- Integraciones: Google Maps Scraper, OpenAI y WhatsApp Web mediante OpenWA.

## Inicio local

### Requisitos

- Docker Desktop con el motor iniciado.
- Git.

### Ejecutar

```bash
git clone https://github.com/Santiago13dev/jarvis-scrapper.git
cd jarvis-scrapper
cp .env.example .env
docker compose up --build -d
```

Docker ejecuta migraciones automáticamente al iniciar el backend. Comprueba la API con:

```bash
curl http://localhost:8000/health
```

### Accesos locales

| Servicio | Dirección |
| --- | --- |
| Aplicación | http://localhost:3000 |
| API | http://localhost:8000/api/v1 |
| Documentación API | http://localhost:8000/api/docs |
| Scraper Google Maps | http://localhost:8080 |
| Conexión WhatsApp QR | http://localhost:8090 |

## Configuración

El archivo `.env.example` contiene todas las variables necesarias. Para uso local, define como mínimo una contraseña de PostgreSQL y un `JWT_SECRET_KEY` propio. Configura `OPENAI_API_KEY` sólo si utilizarás análisis asistido por IA.

Las coordenadas del scraper se controlan con `SCRAPER_LATITUDE` y `SCRAPER_LONGITUDE`. Ajusta esos valores al área desde la que deseas iniciar las búsquedas.

## Uso responsable

Google Maps y WhatsApp son servicios de terceros sujetos a sus propios términos y a la normativa aplicable. Utiliza datos de negocios y mensajería comercial de forma responsable:

- Revisa y filtra los leads antes de contactarles.
- Realiza primero pruebas con tu propio número o contactos que hayan dado consentimiento.
- Evita automatizaciones o envíos masivos desde WhatsApp Web.
- Para una operación comercial escalable, usa la WhatsApp Business Platform / Cloud API oficial de Meta y gestiona el consentimiento de los destinatarios.

## Producción

La composición actual está optimizada para desarrollo local. Antes de publicarla, configura un VPS, dominio, HTTPS, secretos robustos, copias de seguridad de PostgreSQL y una composición de Docker sin montajes de código ni modo de recarga.

Consulta [ARCHITECTURE.md](ARCHITECTURE.md) para el detalle técnico de la arquitectura.
