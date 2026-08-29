# VetPro — Plan de Mejora y Marketplace
**Versión:** 2.0 — Agosto 2026  
**Stack:** Angular 21 · Node.js · PostgreSQL · Whisper AI · WhatsApp Business API · Socket.IO  
**Metodología:** Scrum · Sprints de 2 semanas  
**Horizonte:** 26 semanas (13 sprints)

---

## Contexto y diagnóstico

El análisis profundo del código actual revela una brecha entre lo declarado como "entregado" y el estado real del sistema. Esta es la realidad:

| Área | Estado real | Riesgo |
|------|-------------|--------|
| Inventario (`low-stock`) | Bug de runtime — crash garantizado | CRÍTICO |
| Número de factura | Race condition — duplicados posibles | CRÍTICO |
| JWT sin fallback seguro | Secret expuesto en código | CRÍTICO |
| Whisper AI | Simulado con texto hardcodeado | ALTO |
| WhatsApp | Schema existe, integración ausente | ALTO |
| Tests | Cero cobertura | ALTO |
| DIAN | Campo reservado, sin integración | MEDIO |
| Firma digital | Ruta existe, captura no implementada | MEDIO |
| Dockerfile frontend | `nginx.conf` referenciado pero no existe | CRÍTICO |

Adicionalmente, el análisis competitivo frente a OkVet (4,000+ clínicas, 24 países) revela que **ningún competidor en LATAM** ofrece despacho de veterinarios certificados a domicilio con historia clínica digital generada por IA. Esta es la oportunidad del marketplace.

---

## Arquitectura del plan

```
FASE A — ESTABILIZACIÓN     Sprints 0–1   (4 semanas)   Plataforma clínica confiable
FASE B — DIFERENCIADORES    Sprints 2–4   (6 semanas)   IA real + WhatsApp + DIAN
FASE C — CALIDAD            Sprints 5–6   (4 semanas)   Tests, performance, refactor
FASE D — MARKETPLACE        Sprints 7–10  (8 semanas)   Modelo Rappi para vets
FASE E — GO-LIVE            Sprints 11–12 (4 semanas)   QA, hospitalización, lanzamiento
```

---

## FASE A — ESTABILIZACIÓN

### Sprint 0 — Bugs Críticos y Seguridad Base
**Objetivo:** La plataforma no tiene crashes ni vulnerabilidades explotables.  
**Duración:** Semanas 1–2

#### Bugs críticos (P0 — día 1)

- [ ] **BUG-01** `inventory.routes.ts` — reemplazar `prisma.product.fields.minStock` por raw SQL
  ```sql
  SELECT * FROM "Product"
  WHERE "currentStock" <= "minStock" AND "clinicId" = $1 AND "active" = true
  ```
- [ ] **BUG-02** `billing.routes.ts` — eliminar race condition en generación de número de factura
  - Crear tabla `InvoiceSequence (clinicId, lastNumber)` con `ON CONFLICT DO UPDATE`
  - Generar número dentro de transacción atómica
- [ ] **BUG-03** `auth.routes.ts` — eliminar fallback de JWT_SECRET
  ```typescript
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required — app cannot start');
  ```
- [ ] **BUG-04** Crear `vetpro-angular/nginx.conf` para que el build de Docker funcione
  - Configurar SPA fallback (`try_files $uri $uri/ /index.html`)
  - Headers de seguridad: CSP, X-Frame-Options, X-Content-Type-Options

#### Seguridad

- [ ] **SEC-01** Rate limiting en `/auth/login` — 10 intentos / 15 min con `express-rate-limit`
- [ ] **SEC-02** CORS restrictivo — solo orígenes de `FRONTEND_URL` y dominio de producción
- [ ] **SEC-03** Validación con Zod en endpoints críticos:
  - `POST /auth/login` — email + password (max 128 chars)
  - `POST /billing/invoices` — discount [0–100], taxRate [0–100]
  - `POST /inventory/movements` — quantity > 0, type enum válido
  - `POST /patients` — campos requeridos, sanitización de strings
- [ ] **SEC-04** Límite de body parser: `express.json({ limit: '10mb' })`
- [ ] **SEC-05** Remover rutas demo de producción
  - `portal.routes.ts:ensureDemoTutor()` solo ejecutable en `NODE_ENV=development`
  - En producción: `if (isDevelopment) { ... } else { return res.status(404).json({...}) }`

#### Docker y DevOps base

- [ ] **OPS-01** Agregar health checks en `docker-compose.yml`
  ```yaml
  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vetpro"]
      interval: 5s
      retries: 10
  backend:
    depends_on:
      db:
        condition: service_healthy
  ```
- [ ] **OPS-02** Backup automático de PostgreSQL — agregar servicio `pg-backup` al compose
- [ ] **OPS-03** Variables de entorno — auditar `.env.example`, eliminar secrets hardcodeados

#### Criterios de aceptación
- `GET /inventory/products/low-stock` responde 200 sin crash
- Dos requests simultáneos a `POST /billing/invoices` generan números diferentes
- App arranca con error si `JWT_SECRET` no está en env
- Build de Docker frontend completa sin errores
- 10+ requests a `/auth/login` en 1 minuto retornan 429

---

### Sprint 1 — Calidad de Código Base
**Objetivo:** Logging real, validación centralizada, status enums consistentes.  
**Duración:** Semanas 3–4

#### Logging estructurado

- [ ] Instalar Pino + `pino-http`
- [ ] Reemplazar todos los `console.error()` / `console.log()` por logger con niveles
- [ ] Agregar `requestId` en cada request (UUID v4 via middleware)
- [ ] Log de toda mutación de base de datos con userId, acción y entidad

#### Normalización de enums

- [ ] Unificar status de Appointment: eliminar mapeo `in-progress ↔ in_progress`
  - Frontend envía y recibe siempre `snake_case` (cambiarlo en los 5+ componentes afectados)
  - Eliminar funciones `toDbStatus()` y `toApiStatus()` de `appointment.routes.ts`
- [ ] Agregar `serviceType` enum al schema: `consulta | vacunacion | desparasitacion | peluqueria | spa | laboratorio | cirugia | hospitalizacion`
- [ ] Migration de Prisma para los cambios de schema

#### Utilidades compartidas

- [ ] `src/utils/pagination.ts` — función única para `skip/take/page/pageSize` con validación
- [ ] `src/utils/haversine.ts` — fórmula de distancia geográfica (se usará en marketplace)
- [ ] `src/middleware/clinicContext.ts` — middleware que inyecta `clinicId` del token automáticamente en `req.clinicId` para evitar olvidos

#### Centralizar mock data

- [ ] Crear `src/services/mockData.service.ts` con todos los datos de desarrollo
- [ ] Reemplazar las 12+ copias de mock fallback por importación única
- [ ] Feature flag: `ENABLE_MOCK_FALLBACK=true` solo en development

#### Criterios de aceptación
- Logs en formato JSON con nivel, timestamp, requestId y userId
- Ningún `console.log` en código de producción (lint rule)
- Todos los status de appointment usan snake_case en toda la pila
- `serviceType` enum funcionando en creación de citas

---

## FASE B — DIFERENCIADORES

### Sprint 2 — Whisper AI + Claude: Historia Clínica por Voz (REAL)
**Objetivo:** El diferenciador principal del producto funciona de verdad.  
**Duración:** Semanas 5–6

> Este es el sprint más importante del plan. OkVet no tiene esto. Ningún competidor en LATAM lo tiene. Si no está implementado de verdad, VetPro no tiene argumento de venta premium.

#### Backend — Integración real

- [ ] Instalar `multer` para recepción de archivos de audio (webm, mp4, wav, ogg)
- [ ] Configurar límite de 25MB por archivo (límite de Whisper API)
- [ ] `POST /medical-records/transcribe`:
  1. Recibe archivo de audio con `multer`
  2. Envía a `OpenAI Whisper API` — obtiene transcripción en texto
  3. Envía transcripción a `Claude API` con prompt SOAP veterinario:
     ```
     Eres un asistente clínico veterinario. Convierte esta transcripción de consulta
     en una historia clínica estructurada con:
     - Motivo de consulta (anamnesis)
     - Examen físico (signos vitales, hallazgos)
     - Diagnóstico presuntivo
     - Plan de tratamiento (medicamentos, dosis, frecuencia)
     - Recomendaciones al tutor
     Responde en JSON estrictamente con esas 5 claves.
     ```
  4. Descuenta minutos de IA usados en `Clinic.aiMinutesUsed`
  5. Guarda resultado en `MedicalRecord` (los campos ya existen en schema)
- [ ] Control de límite: si `aiMinutesUsed >= aiMinutesLimit`, retornar 402 con mensaje claro
- [ ] `POST /medical-records/:id/suggest-diagnosis`:
  - Toma síntomas del registro + especie/raza/edad del paciente
  - Claude sugiere diagnóstico diferencial (top 3 más probables con % de probabilidad)

#### Frontend — `BitacoraAiComponent`

- [ ] `MediaRecorder API` — grabar audio directo desde el navegador
- [ ] Visualizador de onda de audio en tiempo real (Canvas API)
- [ ] Temporizador de grabación con límite de 10 minutos
- [ ] Progress bar mientras se procesa (Whisper + Claude toman 10–30 segundos)
- [ ] Panel de resultados editable — el vet puede modificar cualquier campo generado
- [ ] Botón "Sugerir diagnóstico" con spinner y display de top 3
- [ ] Indicador de minutos de IA disponibles vs usados (barra de consumo)

#### Criterios de aceptación
- Grabación de 3 minutos genera historia clínica estructurada en < 45 segundos
- El vet puede editar cualquier campo antes de guardar
- Si se supera el límite de IA, el error es claro y ofrece enlace a upgrade
- La historia generada tiene las 5 secciones SOAP correctamente separadas

---

### Sprint 3 — WhatsApp Business API + Campañas
**Objetivo:** Notificaciones automáticas funcionando; campañas de marketing básicas.  
**Duración:** Semanas 7–8

#### Integración Meta Cloud API

- [ ] Registrar número de WhatsApp Business en Meta for Developers
- [ ] Variables de entorno: `WA_PHONE_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`
- [ ] `src/services/whatsapp.service.ts`:
  ```typescript
  sendMessage(to: string, templateName: string, variables: string[]): Promise<void>
  ```
- [ ] Webhook de entrega: `POST /webhooks/whatsapp` — confirma entregados/leídos, registra en `NotificationLog`

#### BullMQ — Cola de trabajos

- [ ] Instalar Redis + BullMQ (agregar servicio Redis al docker-compose)
- [ ] Queue `notifications` con workers para:
  - `appointment.confirmed` — WhatsApp al tutor al crear cita
  - `appointment.reminder.24h` — job programado 24h antes de la cita
  - `appointment.reminder.2h` — job programado 2h antes
  - `invoice.paid` — comprobante de pago al tutor
- [ ] Job scheduler con `node-cron`: revisar citas próximas cada hora, encolar recordatorios

#### Plantillas de WhatsApp

- [ ] Crear y aprobar templates en Meta Business Manager:
  - `vet_appointment_confirm` — "Hola {{tutor}}, tu cita para {{mascota}} está confirmada para el {{fecha}} a las {{hora}}."
  - `vet_appointment_reminder` — "Recordatorio: mañana a las {{hora}} tienes cita para {{mascota}} en {{clinica}}."
  - `vet_invoice_paid` — "Comprobante de pago: {{monto}} recibido. Gracias por confiar en nosotros."
- [ ] Editor de plantillas en frontend (`/notifications/templates`) con variables dinámicas

#### Campañas de marketing

- [ ] `POST /notifications/campaigns` — enviar mensaje a segmento de tutores:
  - Filtros: especie, última visita hace X días, vacuna próxima a vencer
  - Límite de envío: 1,000 mensajes/día (restricción Meta)
- [ ] `NotificationCampaign` model en schema: nombre, filtros, template, estado, enviados, fallidos
- [ ] UI: wizard de 3 pasos (seleccionar segmento → elegir template → confirmar y enviar)

#### Criterios de aceptación
- Al crear una cita, el tutor recibe WhatsApp en < 30 segundos
- Recordatorio llega exactamente 24h antes
- Campaña de prueba llega a lista de 10 tutores de prueba
- `NotificationLog` registra estado de cada mensaje (enviado/entregado/fallido)

---

### Sprint 4 — Facturación Electrónica DIAN + Firma Digital
**Objetivo:** Facturación legal en Colombia. Consentimientos firmados digitalmente.  
**Duración:** Semanas 9–10

#### DIAN via Alegra API (no construir desde cero)

- [ ] Crear cuenta en Alegra (software contable colombiano con API REST)
- [ ] Variables de entorno: `ALEGRA_EMAIL`, `ALEGRA_TOKEN`
- [ ] `src/services/alegra.service.ts`:
  - `createInvoice(invoice: Invoice)` → genera factura electrónica, retorna CUFE
  - `getInvoicePdf(cufe: string)` → descarga PDF con XML firmado
- [ ] Al emitir factura en VetPro (`PATCH /billing/invoices/:id/issue`):
  1. Crear invoice en Alegra
  2. Guardar `electronicId` (CUFE) en `Invoice.electronicId`
  3. Guardar PDF URL
  4. Enviar PDF al tutor por WhatsApp
- [ ] Endpoint `GET /billing/invoices/:id/pdf` — descarga PDF de factura electrónica

#### Portal del tutor — comprobantes

- [ ] Tutor puede descargar PDF de cualquier factura desde su portal
- [ ] Vista de historial de pagos con estado (pendiente / pagado / vencido)

#### Firma digital de consentimientos

- [ ] Instalar `signature_pad` en Angular
- [ ] `ConsentSignComponent` — canvas de firma táctil/mouse con:
  - Previsualización del documento antes de firmar
  - Campo de nombre completo para validar identidad
  - Botón confirmar → envía firma como imagen base64
- [ ] Backend `PATCH /consent/:id/sign`:
  1. Recibe firma base64 + nombre
  2. Genera PDF con `PDFKit` (documento + firma embebida)
  3. Calcula SHA-256 del PDF (hash de integridad)
  4. Guarda PDF en almacenamiento (R2/S3)
  5. Marca `ConsentForm.signedAt` y `signedHash`
- [ ] Link de firma expira en 72h (no 24h — los tutores necesitan tiempo)
- [ ] Notificación automática a la clínica cuando el tutor firma

#### Criterios de aceptación
- Factura emitida genera CUFE válido en Alegra (ambiente de pruebas DIAN)
- PDF descargable con código QR de validación DIAN
- Firma en mobile funciona con dedo en pantalla táctil
- PDF firmado tiene hash de integridad verificable

---

## FASE C — CALIDAD

### Sprint 5 — Testing y Performance
**Objetivo:** Cobertura mínima de tests en flujos críticos. Queries optimizadas.  
**Duración:** Semanas 11–12

#### Tests unitarios (Jest + Supertest)

- [ ] Setup: Jest + Supertest + base de datos de test (PostgreSQL en Docker separado)
- [ ] Tests obligatorios — mínimo 70% cobertura en:
  - `auth.service` — generación JWT, validación, expiración
  - `billing.service` — cálculo de totales, descuentos, IVA
  - `inventory.service` — stock no puede ser negativo, movimientos atómicos
  - `dispatch.service` (futuro marketplace) — selección del vet más cercano
- [ ] Test de integración API:
  - `POST /auth/login` — credenciales válidas e inválidas
  - `POST /billing/invoices` — concurrencia (dos requests simultáneos = números únicos)
  - `PATCH /inventory/movements` — stock no baja de cero

#### Índices de base de datos

- [ ] Agregar a `schema.prisma` (migration):
  ```prisma
  model MedicalRecord {
    @@index([createdAt])
    @@index([clinicId, createdAt])
  }
  model Invoice {
    @@index([issuedAt])
    @@index([clinicId, status])
  }
  model Appointment {
    @@index([clinicId, scheduledAt])
    @@index([vetId, scheduledAt])
  }
  model Product {
    @@index([clinicId, currentStock])
  }
  ```

#### Fix N+1 queries

- [ ] `appointment.routes.ts` — reemplazar loops con `include: { patient: true, vet: true }`
- [ ] `medical-record.routes.ts` — incluir vet en la query principal
- [ ] `report.routes.ts` — reemplazar 6 queries separadas por `groupBy` de Prisma
- [ ] Agregar paginación obligatoria en exportación de reportes (máximo 5,000 filas por request)

#### Cache en memoria

- [ ] `src/utils/cache.ts` — Map con TTL simple (sin Redis por ahora):
  ```typescript
  const cache = new Map<string, { data: any; expiresAt: number }>();
  ```
- [ ] Cachear con TTL 5 min: lista de branches, lista de vets activos, productos del catálogo

#### Criterios de aceptación
- `npm test` pasa con 70%+ cobertura en servicios críticos
- Query `/appointments?date=today` responde en < 100ms con 500 citas
- Exportación de 5,000 facturas no agota memoria del proceso

---

### Sprint 6 — Refactor Frontend + PWA + Upload de Archivos
**Objetivo:** Componentes mantenibles. App instalable. Archivos adjuntos a historia clínica.  
**Duración:** Semanas 13–14

#### Descomponer componentes monolíticos

- [ ] `landing.component.ts` (1,973 líneas) → dividir en:
  - `HeroSectionComponent`
  - `FeaturesSectionComponent`
  - `PricingSectionComponent`
  - `TestimonialsSectionComponent`
  - `CtaSectionComponent`
- [ ] `dashboard.component.ts` (974 líneas) → dividir en:
  - `KpiCardsComponent`
  - `TodayScheduleComponent`
  - `AlertsPanelComponent`
  - `RevenueChartComponent`
  - `RecentActivityComponent`

#### Repository pattern en backend

- [ ] Crear `src/repositories/`:
  - `patient.repository.ts` — todas las queries de Patient
  - `appointment.repository.ts`
  - `billing.repository.ts`
  - `inventory.repository.ts`
- [ ] Las rutas solo orquestan; las queries viven en repositories
- [ ] Beneficio: repositorios son testeables de forma aislada

#### PWA para portal del tutor

- [ ] `manifest.webmanifest` — nombre, icono, color de tema, display standalone
- [ ] Service Worker — cache de assets estáticos y modo offline básico
- [ ] Prompt "Agregar a pantalla de inicio" en primera visita al portal
- [ ] Push notifications para el tutor (permiso en primer ingreso)

#### Upload de archivos adjuntos

- [ ] Configurar Cloudflare R2 (o AWS S3) — variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_BUCKET`
- [ ] `src/services/storage.service.ts`:
  ```typescript
  uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string>
  getSignedUrl(key: string, expiresIn: number): Promise<string>
  ```
- [ ] `POST /attachments` — sube archivo, guarda metadata en `Attachment` model
- [ ] Tipos permitidos: PDF, JPG, PNG, DICOM, MP3, MP4 (máx 50MB)
- [ ] En el frontend: drag-and-drop en `RecordDetailComponent` para adjuntar archivos

#### Criterios de aceptación
- Ningún componente supera 400 líneas
- Portal del tutor instalable como PWA en Android e iOS
- Adjuntar PDF de laboratorio a historia clínica funciona en < 5 segundos
- URL de archivo firmada expira en 1 hora (seguridad)

---

## FASE D — MARKETPLACE

### Sprint 7 — Schema y Backend del Marketplace
**Objetivo:** Base de datos y API para el modelo Rappi de veterinarios.  
**Duración:** Semanas 15–16

#### Schema nuevo — 7 modelos

- [ ] Agregar a `schema.prisma` y correr migration:

```prisma
model VetProvider {
  id             String        @id @default(cuid())
  name           String
  licenseNumber  String        @unique
  phone          String        @unique
  email          String        @unique
  profilePhoto   String?
  bio            String?
  lat            Float?
  lng            Float?
  isOnline       Boolean       @default(false)
  isVerified     Boolean       @default(false)
  rating         Float         @default(0)
  totalReviews   Int           @default(0)
  commissionRate Float         @default(0.15)
  createdAt      DateTime      @default(now())
  services       VetService[]
  serviceArea    ServiceArea?
  requests       ServiceRequest[]
  reviews        Review[]
  payouts        Payout[]
  @@index([lat, lng])
  @@index([isOnline, isVerified])
}

model VetService {
  id           String       @id @default(cuid())
  vetId        String
  vet          VetProvider  @relation(fields: [vetId], references: [id])
  type         ServiceType
  name         String
  description  String?
  priceMin     Float
  priceMax     Float
  durationMin  Int
  isActive     Boolean      @default(true)
}

model ServiceArea {
  id         String      @id @default(cuid())
  vetId      String      @unique
  vet        VetProvider @relation(fields: [vetId], references: [id])
  radiusKm   Float       @default(10)
  centerLat  Float
  centerLng  Float
  city       String
}

model ServiceRequest {
  id              String          @id @default(cuid())
  tutorId         String
  tutor           Tutor           @relation(fields: [tutorId], references: [id])
  patientId       String
  patient         Patient         @relation(fields: [patientId], references: [id])
  vetId           String?
  vet             VetProvider?    @relation(fields: [vetId], references: [id])
  serviceType     ServiceType
  description     String?
  addressLat      Float
  addressLng      Float
  addressText     String
  scheduledFor    DateTime?
  status          RequestStatus   @default(pending)
  totalAmount     Float?
  platformFee     Float?
  vetEarnings     Float?
  medicalRecordId String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  tracking        VetTracking[]
  review          Review?
  payment         Payment?
  @@index([status, createdAt])
  @@index([tutorId])
  @@index([vetId, status])
}

enum RequestStatus {
  pending
  accepted
  en_route
  arrived
  in_progress
  completed
  cancelled
  no_vet_found
}

model VetTracking {
  id        String         @id @default(cuid())
  requestId String
  request   ServiceRequest @relation(fields: [requestId], references: [id])
  lat       Float
  lng       Float
  timestamp DateTime       @default(now())
  @@index([requestId, timestamp])
}

model Review {
  id           String         @id @default(cuid())
  requestId    String         @unique
  request      ServiceRequest @relation(fields: [requestId], references: [id])
  vetId        String
  vet          VetProvider    @relation(fields: [vetId], references: [id])
  tutorRating  Int
  tutorComment String?
  vetRating    Int?
  createdAt    DateTime       @default(now())
}

model Payment {
  id        String         @id @default(cuid())
  requestId String         @unique
  request   ServiceRequest @relation(fields: [requestId], references: [id])
  amount    Float
  gateway   String
  gatewayRef String?
  status    PaymentStatus  @default(pending)
  paidAt    DateTime?
}

enum PaymentStatus { pending processing paid failed refunded }

model Payout {
  id          String      @id @default(cuid())
  vetId       String
  vet         VetProvider @relation(fields: [vetId], references: [id])
  amount      Float
  period      String
  status      String      @default("pending")
  transferRef String?
  createdAt   DateTime    @default(now())
}
```

#### Rutas del marketplace — backend

- [ ] `GET /marketplace/services` — catálogo de tipos de servicio con precio promedio por ciudad
- [ ] `GET /marketplace/vets/nearby?lat=&lng=&service=` — vets online en radio, ordenados por distancia + rating
- [ ] `POST /marketplace/requests` — crear pedido (requiere tutorAuthMiddleware)
- [ ] `GET /marketplace/requests/:id` — estado del pedido para el tutor
- [ ] `POST /marketplace/requests/:id/rate` — calificar servicio
- [ ] `GET /marketplace/requests/:id/cancel` — cancelar pedido (si status es `pending`)

#### Motor de despacho

- [ ] `src/services/dispatch.service.ts`:
  - Fórmula Haversine para calcular distancia
  - Filtrar vets: online + verificados + cubren la dirección + ofrecen el servicio
  - Ordenar: 70% distancia + 30% rating
  - Notificar primer vet por WhatsApp: "Nuevo servicio disponible — acepta en 90 segundos"
  - Si no acepta: pasar al siguiente de la lista
  - Si nadie acepta: `status = no_vet_found`, notificar al tutor

#### Criterios de aceptación
- Migration corre sin errores en DB existente
- `GET /marketplace/vets/nearby` retorna vets en orden de distancia
- Motor de despacho asigna vet en < 5 segundos
- Si no hay vet disponible, el pedido queda en `no_vet_found` y el tutor recibe WhatsApp

---

### Sprint 8 — App del Tutor: Pedir un Servicio
**Objetivo:** El tutor puede pedir un vet a domicilio desde el portal.  
**Duración:** Semanas 17–18

#### Nuevas rutas Angular — `/marketplace`

- [ ] `MarketplaceDiscoveryComponent` — pantalla inicial:
  - Selector de tipo de servicio (iconos: consulta, vacuna, peluquería, emergencia...)
  - Campo de síntomas / descripción libre
  - Mapa con vets disponibles en radio (puntos verdes = online)
  - Precio estimado y tiempo estimado de llegada
- [ ] `ServiceRequestFormComponent`:
  - Selector de mascota (las del tutor)
  - Confirmación de dirección con mapa interactivo (Leaflet.js o Google Maps)
  - Resumen del pedido con precio final
  - Botón "Pedir ahora" o selector de fecha/hora para agenda
- [ ] `RequestTrackingComponent`:
  - Estado visual del pedido (stepper: Buscando vet → Vet asignado → En camino → Atendiendo → Completado)
  - Mapa con posición del vet en tiempo real (se actualiza via WebSocket)
  - ETA en minutos
  - Botón de cancelar (solo disponible en estado `pending`)
- [ ] `ServiceHistoryComponent` — historial de pedidos con estado y opción de repetir servicio

#### Integración de mapas

- [ ] Instalar Leaflet.js (open source, sin costo de API)
- [ ] `MapComponent` reutilizable: marcador del tutor + marcadores de vets + ruta
- [ ] Geolocalización del navegador con `navigator.geolocation` para autocompletar dirección

#### Criterios de aceptación
- Tutor puede pedir un servicio en < 3 clics desde que abre el portal
- Mapa muestra vets disponibles en tiempo real
- Estado del pedido se actualiza automáticamente sin refrescar la página
- En mobile (375px), toda la UI es usable con una sola mano

---

### Sprint 9 — App del Vet: Recibir y Gestionar Pedidos
**Objetivo:** El vet en campo puede recibir pedidos, navegar y generar historia clínica.  
**Duración:** Semanas 19–20

#### Onboarding del vet independiente

- [ ] `VetProviderOnboardingComponent` — wizard de 4 pasos:
  1. Datos personales + foto de perfil
  2. Tarjeta profesional (upload del documento + número)
  3. Servicios que ofrece + precios por cada uno
  4. Área de cobertura (radio en km sobre mapa)
- [ ] Backend `POST /vet-provider/register` — crea `VetProvider` en estado `isVerified: false`
- [ ] Panel de admin en VetPro para verificar documentos y aprobar vets (`isVerified: true`)

#### Dashboard del vet

- [ ] `VetProviderDashboardComponent`:
  - Toggle online/offline prominente (grande, como Rappi)
  - Ganancias del día / semana
  - Pedidos activos y próximos
  - Rating actual y últimas reseñas
- [ ] `IncomingRequestComponent` — modal de pedido entrante:
  - Sonido de alerta + vibración
  - Info: tipo de servicio, mascota, distancia, monto estimado
  - Countdown de 90 segundos
  - Botones "Aceptar" / "Rechazar"

#### Gestión del servicio activo

- [ ] `ActiveServiceComponent`:
  - Mapa con ruta de navegación hacia el tutor (link a Google Maps / Waze)
  - Botones de estado: "Voy en camino" → "Llegué" → "Atendiendo" → "Completé"
  - Al presionar "Atendiendo": abre `BitacoraAiComponent` adaptada para domicilio
  - Al presionar "Completé": historia clínica + factura generadas automáticamente

#### Tracking GPS del vet

- [ ] Cuando el vet acepta: `navigator.geolocation.watchPosition()` cada 10 segundos
- [ ] `POST /tracking/update` — envía lat/lng al backend
- [ ] Backend guarda en `VetTracking` y emite via Socket.IO al tutor

#### Criterios de aceptación
- Vet recibe alerta de pedido con sonido y vibración en mobile
- Aceptar pedido en < 90 segundos lo asigna; pasado ese tiempo pasa al siguiente vet
- Posición del vet se actualiza en el mapa del tutor cada 10–15 segundos
- Historia clínica generada con Whisper al completar servicio en domicilio

---

### Sprint 10 — Tiempo Real, Pagos y Reviews
**Objetivo:** WebSocket completo, pago integrado, sistema de calificaciones.  
**Duración:** Semanas 21–22

#### WebSocket con Socket.IO

- [ ] Instalar Socket.IO en backend + Angular
- [ ] Rooms por pedido: `request-{id}` — tutor y vet se unen al crear/aceptar pedido
- [ ] Eventos:
  - `vet-location` → tutor recibe lat/lng del vet
  - `request-status-changed` → ambas partes reciben cambio de estado
  - `vet-assigned` → tutor sabe que encontraron vet
  - `service-completed` → tutor ve pantalla de calificación

#### Pago con Wompi

- [ ] Variables de entorno: `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`
- [ ] Flujo de pago:
  1. Tutor ingresa tarjeta al crear pedido (tokenización con widget de Wompi)
  2. Pago se cobra solo al completar el servicio (`status = completed`)
  3. Webhook de Wompi confirma pago → `Payment.status = paid`
  4. Se calcula: `vetEarnings = total * 0.85`, `platformFee = total * 0.15`
- [ ] Efectivo como alternativa: tutor selecciona "pago en efectivo", vet confirma recibido

#### Sistema de reviews

- [ ] Al completar servicio, tutor ve pantalla de calificación (1–5 estrellas + comentario)
- [ ] Vet puede calificar al tutor (interno, no visible al público)
- [ ] Rating del vet se recalcula: promedio ponderado de todas sus reviews
- [ ] Reviews visibles en perfil del vet en el marketplace

#### Earnings y payouts del vet

- [ ] `GET /vet-provider/earnings` — ganancias por día/semana/mes, comisiones descontadas
- [ ] Payout semanal automático (cron job los lunes):
  - Suma ganancias de la semana
  - Crea registro en `Payout`
  - Transfiere via PSE/Nequi (integración pendiente — primero manual con notificación)

#### Criterios de aceptación
- Posición del vet actualiza en tiempo real en el mapa del tutor (latencia < 2 segundos)
- Pago se cobra exitosamente al completar servicio con tarjeta de prueba de Wompi
- Review enviada actualiza el rating del vet inmediatamente
- Vet ve sus ganancias del día en el dashboard

---

## FASE E — GO-LIVE

### Sprint 11 — Hospitalización + Módulo de Laboratorio
**Objetivo:** Cubrir el segmento de clínicas medianas con servicios avanzados.  
**Duración:** Semanas 23–24

> Features que OkVet Pro tiene y VetPro aún no. Sin esto, VetPro no puede venderle a clínicas con internación.

#### Hospitalización / Kardex

- [ ] Schema nuevo:
  ```prisma
  model Hospitalization {
    id           String    @id @default(cuid())
    patientId    String
    patient      Patient   @relation(...)
    branchId     String
    bedNumber    String
    admittedAt   DateTime  @default(now())
    dischargedAt DateTime?
    reason       String
    evolutions   HospitalizationEvolution[]
    medications  HospitalizationMedication[]
  }
  model HospitalizationEvolution {
    id               String          @id @default(cuid())
    hospitalizationId String
    vetId            String
    notes            String
    vitals           Json
    recordedAt       DateTime        @default(now())
  }
  ```
- [ ] `HospitalizationListComponent` — mapa visual de camas (disponible / ocupada / en limpieza)
- [ ] `HospitalizationDetailComponent` — timeline de evoluciones, medicaciones programadas
- [ ] Job cron: alertar si no hay evolución registrada en > 12h

#### Módulo de laboratorio

- [ ] Tipo de cita: `laboratorio` — formulario específico con campos de muestra
- [ ] Upload de resultados PDF adjunto a la historia clínica
- [ ] Plantilla de reporte de laboratorio imprimible (PDFKit)
- [ ] Integración básica: veterinario puede solicitar examen y adjuntar resultado cuando llega

#### Tipos de servicio adicionales (paridad con OkVet)

- [ ] Peluquería / spa — formulario con: estilo de corte, productos usados, observaciones
- [ ] Desparasitación — selector de producto + dosis + próxima fecha
- [ ] Todos los servicios son facturables y aparecen en reportes

#### Criterios de aceptación
- Mapa de camas muestra estado en tiempo real
- Evolución de hospitalizado registrada en < 2 minutos
- Resultado de laboratorio adjunto aparece en historia clínica del paciente

---

### Sprint 12 — QA, Seguridad Final, Monitoreo y Lanzamiento
**Objetivo:** La plataforma está lista para clientes reales.  
**Duración:** Semanas 25–26

#### Tests E2E con Playwright

- [ ] Setup Playwright en CI
- [ ] Flujos críticos cubiertos:
  - `Login → Ver agenda → Atender cita → Crear historia con IA → Facturar`
  - `Agregar producto → Registrar movimiento → Ver alerta de stock bajo`
  - `Tutor pide servicio → Vet acepta → Completa servicio → Califica`
  - `Admin genera reporte mensual → Exporta Excel`

#### Auditoría de seguridad

- [ ] OWASP Top 10 — checklist completo:
  - [ ] A01 Broken Access Control — verificar que cada endpoint valida `clinicId` del token
  - [ ] A02 Cryptographic Failures — HTTPS forzado, secrets en vault
  - [ ] A03 Injection — Prisma previene SQL injection, verificar raw queries
  - [ ] A05 Security Misconfiguration — headers de seguridad en Nginx y Express
  - [ ] A07 Auth Failures — rate limiting, expiración de tokens, logout seguro
- [ ] Penetration test básico con OWASP ZAP en staging

#### Monitoreo y observabilidad

- [ ] Configurar Sentry para error tracking (frontend + backend)
- [ ] Configurar Grafana + Prometheus (o Datadog) para métricas:
  - Latencia P95 de endpoints críticos
  - Tasa de errores 5xx
  - Tiempo de respuesta de Whisper API
  - Pedidos de marketplace por estado
- [ ] Alertas: Slack notification si error rate > 1% en 5 minutos

#### Performance final

- [ ] Lighthouse score > 90 en mobile (portal del tutor)
- [ ] Lighthouse score > 85 en desktop (app de clínica)
- [ ] Bundle size frontend < 2MB (con lazy loading)

#### Cumplimiento legal Colombia

- [ ] Política de privacidad (Ley 1581 de 2012 — Habeas Data)
- [ ] Términos y condiciones del marketplace
- [ ] Autorización de tratamiento de datos en registro de tutores y vets
- [ ] Aviso de privacidad en formulario de magic link

#### Onboarding de clínicas

- [ ] Wizard de configuración inicial (< 5 minutos):
  1. Nombre de clínica + logo
  2. Datos de la sede principal
  3. Crear primer usuario vet
  4. Configurar horarios de atención
  5. Tutorial interactivo de las 3 acciones más comunes
- [ ] Video demo integrado en el dashboard del primer inicio de sesión

#### Criterios de aceptación (Go-Live Gate)
- Todos los tests E2E pasan en CI
- Cero vulnerabilidades críticas o altas en OWASP ZAP
- Lighthouse mobile > 90 en portal del tutor
- Error rate < 0.5% en staging con carga simulada de 100 usuarios concurrentes
- Al menos 3 clínicas beta han usado la plataforma por 1 semana sin incidentes críticos

---

## Resumen de sprints

| Sprint | Módulo | Semanas | Estado |
|--------|--------|---------|--------|
| 0 | Bugs críticos + Seguridad base | 1–2 | Pendiente |
| 1 | Logging · Enums · Utilidades compartidas | 3–4 | Pendiente |
| 2 | Whisper AI + Claude — integración real | 5–6 | Pendiente |
| 3 | WhatsApp Business API + BullMQ + Campañas | 7–8 | Pendiente |
| 4 | DIAN (Alegra) + Firma digital | 9–10 | Pendiente |
| 5 | Tests unitarios + Índices DB + Performance | 11–12 | Pendiente |
| 6 | Refactor frontend + PWA + File upload | 13–14 | Pendiente |
| 7 | Schema marketplace + Backend + Dispatch | 15–16 | Pendiente |
| 8 | App del tutor: pedir servicio + tracking | 17–18 | Pendiente |
| 9 | App del vet: recibir pedidos + GPS | 19–20 | Pendiente |
| 10 | WebSocket tiempo real + Wompi + Reviews | 21–22 | Pendiente |
| 11 | Hospitalización + Laboratorio + Peluquería | 23–24 | Pendiente |
| 12 | QA E2E + Seguridad + Monitoreo + Go-Live | 25–26 | Pendiente |

**Total:** 26 semanas (6.5 meses)  
**MVP clínica estabilizado (Sprints 0–4):** 10 semanas  
**MVP marketplace funcional (Sprints 0–10):** 22 semanas

---

## Modelo de negocio

| Producto | Precio | Audiencia |
|----------|--------|-----------|
| VetPro Clínica — Starter | $80,000 COP/mes | Clínicas 1 vet |
| VetPro Clínica — Pro | $150,000 COP/mes | Clínicas 2–5 vets + IA ilimitada |
| VetPro Clínica — Enterprise | $300,000 COP/mes | Multi-sede + API + DIAN |
| VetPro Marketplace — Comisión | 15% por servicio | Vets independientes |
| VetPro Marketplace — Pro Vet | $49,000 COP/mes | Mayor visibilidad en búsqueda |

**Proyección conservadora año 1:**
- 50 clínicas × $120,000 COP/mes = $6,000,000 COP/mes
- 30 vets activos × 3 servicios/día × $90,000 COP × 15% = $1,215,000 COP/día
- **Total año 1:** ~$500M COP

---

## Stack tecnológico completo

### Frontend
- Angular 21 (Standalone · Signals · PWA)
- Leaflet.js (mapas open source)
- Socket.IO client (tiempo real)
- Signature Pad (firmas digitales)
- Chart.js (reportes)

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL 15
- Redis + BullMQ (colas de trabajos)
- Socket.IO (WebSocket)
- Pino (logging estructurado)

### IA e Integraciones
- OpenAI Whisper API (transcripción)
- Anthropic Claude API (estructuración historia + diagnóstico)
- Meta WhatsApp Business Cloud API
- Alegra API (facturación DIAN)
- Wompi (pagos Colombia)

### DevOps
- Docker + Docker Compose
- GitHub Actions (CI/CD con tests obligatorios)
- Cloudflare R2 (almacenamiento de archivos)
- Sentry (error tracking)
- Grafana + Prometheus (métricas)

---

## Decisiones de arquitectura clave

| Decisión | Opción elegida | Razón |
|----------|---------------|-------|
| DIAN | Alegra API | No construir desde cero; Alegra está habilitado y tiene SDK |
| Mapas | Leaflet.js | Sin costo de API vs Google Maps ($7 USD/1,000 requests) |
| Pagos | Wompi | Líder en Colombia, API simple, sin contratos anuales |
| Storage | Cloudflare R2 | Sin costo de egress vs AWS S3 |
| Real-time | Socket.IO | Más simple que implementar WebSocket raw; funciona en todos los navegadores |
| Logging | Pino | 5x más rápido que Winston en benchmarks; formato JSON nativo |

---

*Última actualización: 2026-08-28*  
*Autor: VetPro Engineering Team*
