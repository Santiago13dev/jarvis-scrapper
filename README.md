# JarvisIA

JarvisIA es una consola de prospección comercial para agencias y equipos de ventas. Centraliza la búsqueda de negocios locales, la gestión de leads y la preparación de campañas de contacto desde un solo workspace.

## Cómo funciona

1. **Busca negocios** desde **Leads → Buscar negocios**: tipo de negocio + zona (ej. «odontólogos» en «Cedritos, Bogotá»). La búsqueda corre en segundo plano y puedes seguir trabajando.
2. **Jarvis completa y califica** cada negocio: detecta su WhatsApp, Instagram/Facebook, si su «página web» es en realidad una red social o un directorio, revisa la web cuando existe y le asigna un **potencial de venta de 0 a 100**.
3. **Contacta desde «Contactar hoy»**: una lista diaria con los mejores prospectos aún sin contactar y un mensaje personalizado y editable para cada uno. Un toque abre WhatsApp con el mensaje listo.
4. **Seguimiento automático**: a los 3 días el negocio vuelve a aparecer con un mensaje de seguimiento; después de 3 intentos sin respuesta, Jarvis deja de insistir.
5. Si alguien responde, el lead pasa a **Respondió**; si pide no ser contactado («no me interesa», «no escriban más»…), queda marcado como **No contactar** y sale de todas las listas.

### ¿Cómo se calcula el potencial de venta?

| Señal | Puntos |
| --- | --- |
| Buena calificación en Google (4,5+) | hasta 15 |
| Muchas reseñas (negocio activo) | hasta 15 |
| Se le puede escribir (WhatsApp, teléfono, correo) | hasta 20 |
| **No tiene página propia** (solo redes, directorio o nada) | 25 + 25 por todas las carencias |
| Tiene web, pero con problemas (sin HTTPS, no carga, no apta para celular, mal SEO, lenta) | 5 por cada problema |

Un negocio sólido sin página propia llega a 100; uno con una web impecable no pasa de 50. Los pesos se configuran por workspace.

## Características

- Búsqueda de negocios en Google Maps en segundo plano, con progreso en vivo.
- Enriquecimiento automático: WhatsApp (números móviles de Colombia en formato internacional), redes sociales, correo y detección de webs gratuitas o de directorio.
- Potencial de venta explicado: cada lead muestra por qué tiene ese puntaje.
- «Contactar hoy»: cola diaria, mensajes personalizados, seguimientos y respeto de quienes piden no ser contactados.
- Plantillas con variables: `{{negocio}}`, `{{categoria}}`, `{{ciudad}}`, `{{calificacion}}`, `{{resenas}}`, `{{oportunidad}}`.
- CRM multi-workspace con filtros, ficha del negocio, exportación a CSV (Excel) y campañas.
- Agente de IA opcional que responde con la base de conocimiento definida en **Configuración**.
- Interfaz responsive para computador y celular.

## Modos de WhatsApp

Se eligen con la variable `WHATSAPP_PROVIDER` del `.env`:

| Modo | Cómo envía | Cuándo usarlo |
| --- | --- | --- |
| `assisted` (por defecto) | Abre WhatsApp en tu celular o computador con el mensaje listo; tú lo envías. | Para empezar: gratis y sin riesgo de bloqueo. |
| `cloud_api` | API oficial de Meta (WhatsApp Business Platform), con plantillas aprobadas. Las respuestas llegan a **Conversaciones**. | Para volumen y automatización real. |
| `openwa` | Sesión de WhatsApp Web por QR. | Solo pruebas con pocos mensajes: Meta puede bloquear el número. |

Para activar la API oficial: crea una app en developers.facebook.com, agrega el producto WhatsApp y completa en el `.env` `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, `WHATSAPP_CLOUD_TEMPLATE` (plantilla aprobada) y `WHATSAPP_CLOUD_WORKSPACE_ID` (workspace que recibe las respuestas). El webhook que debes registrar en Meta es `https://TU-DOMINIO/api/v1/whatsapp/cloud/webhook`.

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

El archivo `.env.example` contiene todas las variables necesarias. Para uso local, define como mínimo una contraseña de PostgreSQL y un `JWT_SECRET_KEY` propio. Configura `OPENAI_API_KEY` sólo si utilizarás el agente de IA.

- `ALLOW_PUBLIC_REGISTRATION=false` cierra el registro público una vez creada la primera cuenta (recomendado en producción).
- `OPENWA_WEBHOOK_SECRET` protege el webhook de OpenWA; sin él, cualquiera podría inyectar mensajes falsos.
- Con `ENVIRONMENT=production` el backend se niega a arrancar si `JWT_SECRET_KEY` sigue siendo el valor de ejemplo.

Las coordenadas del scraper se controlan con `SCRAPER_LATITUDE` y `SCRAPER_LONGITUDE`. Ajusta esos valores al área desde la que deseas iniciar las búsquedas.

## Uso responsable

Google Maps y WhatsApp son servicios de terceros sujetos a sus propios términos y a la normativa aplicable. Utiliza datos de negocios y mensajería comercial de forma responsable:

- Revisa y filtra los leads antes de contactarles. Escribe solo a negocios a los que tu servicio les aporte algo.
- Respeta a quien pide no ser contactado: Jarvis lo marca automáticamente, pero también puedes hacerlo a mano con «No contactar».
- Realiza primero pruebas con tu propio número o contactos que hayan dado consentimiento.
- Evita automatizaciones o envíos masivos desde WhatsApp Web.
- Para una operación comercial escalable, usa la WhatsApp Business Platform / Cloud API oficial de Meta y gestiona el consentimiento de los destinatarios.

## Producción

La composición actual está optimizada para desarrollo local. Antes de publicarla, configura un VPS, dominio, HTTPS, secretos robustos, copias de seguridad de PostgreSQL y una composición de Docker sin montajes de código ni modo de recarga.

Consulta [ARCHITECTURE.md](ARCHITECTURE.md) para el detalle técnico de la arquitectura.
