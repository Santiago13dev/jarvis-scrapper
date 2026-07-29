# ProspectAI

ProspectAI es una plataforma SaaS multi-tenant diseñada para automatizar la prospección comercial de negocios locales mediante scraping, análisis con IA, CRM y campañas de outreach.

La idea central es convertir información dispersa de negocios en leads calificados, listos para ser gestionados desde un dashboard único y procesados con flujos automatizados.

## ✨ Qué ofrece

- Descubrimiento de negocios desde fuentes externas de scraping.
- Clasificación y scoring de leads con IA.
- Gestión centralizada de leads, campañas y conversaciones.
- Integración con WhatsApp para automatizar mensajes y seguimiento.
- Arquitectura preparada para escalar con módulos independientes.

## 🏗️ Arquitectura

El proyecto está estructurado con una arquitectura hexagonal (Ports & Adapters) y capas bien definidas:

- Backend: FastAPI + Python
- Frontend: Next.js + React + TypeScript
- Base de datos: PostgreSQL
- Cache/colas: Redis + ARQ
- Integraciones externas: Google Maps Scraper, OpenAI y WhatsApp

Para más detalle técnico, consulta [ARCHITECTURE.md](ARCHITECTURE.md).

## 🧰 Stack tecnológico

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic, Pydantic
- Infraestructura: Docker, Docker Compose
- Integraciones: OpenAI, Redis, Google Maps Scraper, WhatsApp

## 🚀 Inicio rápido

### Requisitos

- Docker
- Docker Compose
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/Santiago13dev/jarvis-scrapper.git
cd jarvis-scrapper
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y ajusta los valores según tu entorno:

```bash
cp .env.example .env
```

### 3. Levantar los servicios

```bash
docker compose up --build
```

Esto levantará:

- Backend en http://localhost:8000
- Frontend en http://localhost:3000
- PostgreSQL en localhost:5432
- Redis en localhost:6379

La API documentada estará disponible en:

- http://localhost:8000/docs

## 📁 Estructura del proyecto

```text
ProspectAI/
├── backend/            # API FastAPI y lógica de negocio
├── frontend/           # Aplicación Next.js
├── integrations/       # Integraciones externas como el scraper de Google Maps
├── docker-compose.yml  # Orquestación de servicios
├── ARCHITECTURE.md     # Documentación técnica de arquitectura
└── .env.example        # Variables de entorno base
```

## 🔧 Estado del proyecto

Este repositorio se encuentra en una etapa inicial de desarrollo, con la estructura base y los contratos de arquitectura implementados. El objetivo actual es consolidar los módulos core y dejarlo listo para pruebas y desarrollo incremental.

## 🗺️ Próximos pasos

- Implementar modelos de datos y migraciones.
- Conectar los adapters reales de scraping, IA y WhatsApp.
- Completar los casos de uso de negocio.
- Desarrollar los flujos del dashboard y CRM.
- Preparar pruebas end-to-end y despliegue.

## 🤝 Contribución

Las contribuciones son bienvenidas. Si deseas colaborar:

1. Haz un fork del proyecto.
2. Crea una rama con tu cambio.
3. Abre un pull request describiendo claramente la mejora.
