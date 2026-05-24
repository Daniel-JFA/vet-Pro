# VetPro — Plan de Sprints completo
**Stack:** Angular 21 · Node.js · PostgreSQL · Whisper AI · WhatsApp Business API  
**Metodología:** Scrum · Sprints de 2 semanas · Equipo: 2 devs + 1 QA

---

## 🏷️ Nombres sugeridos para el producto

| # | Nombre | Concepto | Dominio sugerido |
|---|--------|----------|-----------------|
| 1 | **VetPro** | Profesional, directo, posicionamiento claro en el sector | vetpro.co |
| 2 | **Pawsy** | Amigable, memorable, evoca mascotas; fácil de pronunciar en LATAM | pawsy.app |
| 3 | **Clinipet** | Fusión de "clínica" + "pet"; communica el producto de forma inmediata | clinipet.co |

---

## 📦 Estructura del proyecto Angular

```
vetpro/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/          ← Todos los tipos de dominio
│   │   │   ├── services/        ← api, auth, inventory, patients, appointments, billing
│   │   │   ├── guards/          ← authGuard
│   │   │   └── interceptors/    ← authInterceptor (JWT)
│   │   ├── shared/
│   │   │   ├── components/      ← sidebar, topbar, badge, confirm-dialog
│   │   │   ├── pipes/           ← currencyCop, timeAgo
│   │   │   └── directives/
│   │   ├── layout/
│   │   │   └── shell.component  ← Sidebar + Topbar + RouterOutlet
│   │   ├── features/
│   │   │   ├── auth/            ← login
│   │   │   ├── dashboard/       ← KPIs, agenda del día, alertas IA
│   │   │   ├── patients/        ← list · detail · form
│   │   │   ├── appointments/    ← list · calendar · form
│   │   │   ├── medical-records/ ← list · detail · bitacora-ai (voz→historia)
│   │   │   ├── inventory/       ← list · form · alerts · movements ✅ COMPLETO
│   │   │   ├── billing/         ← list · form · receipt (DIAN)
│   │   │   ├── notifications/   ← center · templates (WhatsApp)
│   │   │   └── reports/         ← analytics · exportar
│   │   ├── app.routes.ts        ← Lazy loading por feature
│   │   ├── app.config.ts        ← HTTP + Router + Animations
│   │   └── app.ts
│   ├── environments/
│   │   ├── environment.ts       ← dev: http://localhost:3000
│   │   └── environment.prod.ts  ← prod: https://api.vetpro.co
│   └── styles.scss              ← Design tokens globales (CSS vars)
├── angular.json
└── package.json
```

---

## 🗓️ Sprint 0 — Setup & Arquitectura (Semana 1–2)

**Objetivo:** Proyecto funcionando de punta a punta, sin features de negocio.

### Tareas
- [ ] Crear repositorio (GitHub/GitLab) con branching strategy (main / develop / feature/*)
- [ ] Setup Angular 21 con estructura de carpetas (✅ entregado)
- [ ] Configurar ESLint + Prettier + Husky pre-commit hooks
- [ ] Setup backend: Node.js + Express + Prisma + PostgreSQL
- [ ] Diseñar schema de base de datos (multi-tenant con clinicId y branchId en todas las tablas desde el inicio para multi-sucursal)
- [ ] Setup autenticación: JWT + refresh tokens
- [ ] CI/CD: GitHub Actions → build + test + deploy a staging
- [ ] Setup entornos: dev · staging · prod
- [ ] Definir Design System: tokens de color, tipografía, spacing (✅ styles.scss)
- [ ] Setup Sentry para error tracking

### Entregables
- Proyecto Angular compilando sin errores ✅
- API REST con endpoints `/auth/login` y `/auth/me`
- Shell con sidebar y login funcional
- Pipeline de CI verde

---

## 🗓️ Sprint 1 — Pacientes & Tutores (Semana 3–4)

**Objetivo:** Un veterinario puede registrar y buscar pacientes.

### Historias de usuario
- **HU-01:** Como vet, quiero registrar una nueva mascota con foto, especie, raza, tutor y chip
- **HU-02:** Como vet, quiero buscar pacientes por nombre, tutor o chip
- **HU-03:** Como vet, quiero ver el perfil completo de una mascota con sus datos y tutor
- **HU-04:** Como admin, quiero registrar y editar tutores

### Tareas técnicas
- [ ] `PatientListComponent`: tabla paginada con búsqueda y filtros (especie, estado)
- [ ] `PatientFormComponent`: formulario reactivo con validación, upload de foto
- [ ] `PatientDetailComponent`: perfil con tabs (datos, historia, vacunas, documentos)
- [ ] `TutorFormComponent`: CRUD de tutores
- [ ] API: `GET/POST/PUT /patients`, `GET/POST /tutors`
- [ ] Prisma migration: tablas `Patient` y `Tutor`
- [ ] Upload de fotos a S3 / Cloudflare R2
- [ ] Tests unitarios (service + component): cobertura mínima 70%

### Criterios de aceptación
- Registrar una mascota en menos de 2 minutos
- Búsqueda con resultados en tiempo real (debounce 300ms)
- Foto se muestra correctamente en perfil

---

## 🗓️ Sprint 2 — Agenda & Notificaciones (Semana 5–6)

**Objetivo:** Agendar citas y enviar recordatorios automáticos por WhatsApp.

### Historias de usuario
- **HU-05:** Como recepcionista, quiero agendar una cita eligiendo vet, paciente, servicio y hora
- **HU-06:** Como vet, quiero ver mi agenda del día en formato calendario
- **HU-07:** Como tutor, quiero recibir un WhatsApp de confirmación y recordatorio 24h antes
- **HU-08:** Como admin, quiero configurar las plantillas de mensajes

### Tareas técnicas
- [ ] `AppointmentCalendarComponent`: vista semanal con drag & drop (FullCalendar)
- [ ] `AppointmentListComponent`: lista de citas con sala de espera digital
- [ ] `AppointmentFormComponent`: formulario con selector de paciente, vet y slot disponible
- [ ] Sala de espera: estado en tiempo real (WebSocket o SSE)
- [ ] Integración WhatsApp Business API (Meta Cloud API)
- [ ] Job scheduler (node-cron): recordatorios 24h y 2h antes
- [ ] `NotificationTemplatesComponent`: editor de plantillas con variables {{nombre}}, {{fecha}}
- [ ] API: `GET/POST/PUT /appointments`, `PATCH /appointments/:id/status`
- [ ] Prisma migration: tablas `Appointment`, `NotificationTemplate`, `NotificationLog`

### Criterios de aceptación
- Cita agendada genera WhatsApp automático al tutor y al vet
- Recordatorio 24h antes llega correctamente
- Sala de espera refleja cambios de estado en < 3 segundos

---

## 🗓️ Sprint 3 — Historia Clínica & Bitácora IA (Semana 7–8)

**Objetivo:** El veterinario documenta consultas con voz y la IA genera la historia estructurada. Diferenciador principal.

### Historias de usuario
- **HU-09:** Como vet, quiero grabar mi consulta con el micrófono y que la IA genere la historia clínica
- **HU-10:** Como vet, quiero ver el historial médico completo de una mascota cronológicamente
- **HU-11:** Como vet, quiero adjuntar resultados de laboratorio, imágenes y documentos a la historia
- **HU-12:** Como vet, quiero que la IA sugiera un diagnóstico presuntivo basado en los síntomas

### Tareas técnicas
- [ ] `BitacoraAiComponent`: grabador de audio (MediaRecorder API), visualizador de onda, temporizador
- [ ] Backend: enviar audio a OpenAI Whisper API → transcripción
- [ ] Prompt engineering: transcripción → historia clínica estructurada (anamnesis, examen físico, diagnóstico, tratamiento)
- [ ] `RecordDetailComponent`: vista de historia con secciones colapsables
- [ ] Upload de archivos adjuntos (PDF, imágenes, DICOM)
- [ ] `RecordListComponent`: timeline cronológico del paciente
- [ ] Contador de minutos de IA usado vs plan contratado
- [ ] API: `POST /medical-records`, `POST /medical-records/transcribe`, `GET /patients/:id/medical-records`
- [ ] Prisma migration: tablas `MedicalRecord`, `Attachment`

### Criterios de aceptación
- Grabación de 5 min genera historia en < 30 segundos
- Estructura de historia clínica correcta en > 90% de casos
- El vet puede editar cualquier campo generado por IA

---

## 🗓️ Sprint 4 — Inventario (Semana 9–10) ✅ ENTREGADO

**Objetivo:** Control completo de medicamentos, vacunas e insumos con alertas automáticas.

### Historias de usuario
- **HU-13:** Como admin, quiero registrar productos con SKU, precio y stock mínimo
- **HU-14:** Como vet, quiero ver una alerta cuando un producto está por agotarse o vencer
- **HU-15:** Como admin, quiero registrar entradas y salidas de inventario
- **HU-16:** Como vet, quiero que al facturar una consulta se descuente automáticamente el inventario

### Componentes entregados ✅
- `InventoryListComponent`: tabla con filtros, stats cards, indicadores visuales de stock
- `InventoryFormComponent`: formulario por tabs (básico, precios, stock) con cálculo de margen
- `InventoryMovementsComponent`: registro de movimientos (entrada/salida/ajuste/pérdida/devolución)
- `InventoryAlertsComponent`: panel de productos sin stock, stock bajo y próximos a vencer

### Tareas pendientes de backend
- [ ] API: `GET/POST/PUT /inventory/products`
- [ ] API: `POST /inventory/movements` (descuenta/suma stock atómicamente)
- [ ] API: `GET /inventory/products/low-stock` y `/expiring`
- [ ] Job diario: revisar vencimientos y generar alertas internas
- [ ] Descuento automático al registrar una consulta que usa medicamentos

---

## 🗓️ Sprint 5 — Facturación (Semana 11–12)

**Objetivo:** Cobros, comprobantes y registro de pagos (Facturación electrónica DIAN pospuesta para fase final).

### Historias de usuario
- **HU-17:** Como admin, quiero generar una factura por los servicios de una consulta
- **HU-18:** Como admin, quiero registrar pagos parciales o totales
- **HU-19:** Como admin, quiero generar factura electrónica (Pospuesto para fase final / a organizar después)
- **HU-20:** Como tutor, quiero recibir mi comprobante de pago por WhatsApp

### Tareas técnicas
- [ ] `BillingListComponent`: lista de facturas con filtros por estado y fecha
- [ ] `BillingFormComponent`: creación de factura con ítems, descuentos, IVA
- [ ] `BillingReceiptComponent`: comprobante PDF descargable y compartible
- [ ] [POSPUESTO] Integración DIAN: Habilitación, firma digital, envío XML (a definir al final del proyecto)
- [ ] Módulo de pagos parciales (abonos)
- [ ] Envío de comprobante por WhatsApp
- [ ] API: `GET/POST /billing/invoices`, `PATCH /billing/invoices/:id/issue`
- [ ] Reportes: ingresos por día/mes, servicios más rentables

### Criterios de aceptación
- Comprobante llega al tutor por WhatsApp en < 1 minuto
- El sistema registra correctamente el abono y el saldo pendiente

---

## 🗓️ Sprint 6 — Firma digital & Documentos (Semana 13–14)

**Objetivo:** Consentimientos y autorizaciones firmados digitalmente por el tutor desde su celular.

### Historias de usuario
- **HU-21:** Como vet, quiero generar un consentimiento de anestesia y enviarlo al tutor para firma
- **HU-22:** Como tutor, quiero firmar el documento desde mi celular sin instalar nada
- **HU-23:** Como admin, quiero plantillas reutilizables de consentimientos (cirugía, hospitalización, eutanasia)

### Tareas técnicas
- [ ] Generación de PDF con PDFKit desde plantillas
- [ ] Firma digital: implementar con SignaturePad.js
- [ ] Link único por documento (expira en 72h)
- [ ] Almacenamiento de PDFs firmados con hash de integridad
- [ ] Plantillas de consentimiento: hospitalización, eutanasia, anestesia, destete
- [ ] Módulo de autorizaciones adjunto a historia clínica
- [ ] Notificación automática cuando el tutor firma

---

## 🗓️ Sprint 7 — Reportes & Analytics (Semana 15–16)

**Objetivo:** El admin tiene visibilidad completa del negocio para tomar decisiones.

### Historias de usuario
- **HU-24:** Como admin, quiero ver los ingresos del mes comparados con el mes anterior
- **HU-25:** Como admin, quiero saber qué servicios son más rentables
- **HU-26:** Como admin, quiero una tasa de retención de pacientes mensual
- **HU-27:** Como admin, quiero exportar reportes a Excel

### Tareas técnicas
- [ ] Dashboard ejecutivo con Chart.js: ingresos, citas, pacientes nuevos
- [ ] Reporte de servicios: más vendidos, más rentables
- [ ] Retención: pacientes que volvieron en los últimos 90 días
- [ ] Reporte de inventario: rotación, productos más usados
- [ ] Exportación Excel con `exceljs`
- [ ] Filtros por rango de fechas, veterinario, servicio

---

## 🗓️ Sprint 8 — Portal del tutor (Semana 17–18)

**Objetivo:** El dueño de la mascota tiene su propio espacio digital (desde Noah Club).

### Historias de usuario
- **HU-28:** Como tutor, quiero ver el historial médico de mi mascota desde mi celular
- **HU-29:** Como tutor, quiero agendar una cita online
- **HU-30:** Como tutor, quiero ver la cartilla de vacunas y descargarla como PDF

### Tareas técnicas
- [ ] Portal tutor: app web PWA (misma base Angular, ruta `/portal`)
- [ ] Autenticación tutor: link mágico por WhatsApp (sin contraseña)
- [ ] Vista historial: timeline de consultas y vacunas
- [ ] Cartilla de vacunas: PDF generado bajo demanda
- [ ] Agendamiento online: selector de servicio y slot disponible
- [ ] Push notifications para el tutor

---

## 🗓️ Sprint 9 — Multi-sucursal & Roles (Semana 19–20)

**Objetivo:** La plataforma escala a clínicas con múltiples sedes y equipos.

### Tareas técnicas
- [ ] Soporte multi-sucursal: implementación en UI y lógica de negocio de las sedes (branchId configurado en base de datos desde Sprint 0)
- [ ] Control de roles granular: admin · vet · asistente · recepcionista
- [ ] Permisos por módulo: leer / escribir / eliminar
- [ ] Transferencia de paciente entre sedes
- [ ] Reportes consolidados multi-sede

---

## 🗓️ Sprint 10 — QA, Performance & Go-Live (Semana 21–22)

**Objetivo:** La plataforma está lista para producción con los primeros clientes.

### Tareas
- [ ] E2E tests con Playwright: flujos críticos (login → agendar → consulta → facturar)
- [ ] Auditoría de seguridad: OWASP Top 10
- [ ] Performance: Lighthouse score > 90 en mobile
- [ ] Habeas data y política de privacidad (Ley 1581/2012 Colombia)
- [ ] Onboarding flow: wizard de configuración inicial de la clínica (< 5 min)
- [ ] Documentación API con Swagger
- [ ] Setup monitoreo: Datadog o Grafana
- [ ] Plan de backup: PostgreSQL → S3 diario con retención 30 días
- [ ] Capacitación a primeros clientes beta

---

## 📊 Resumen de sprints

| Sprint | Módulo | Semanas | Estado |
|--------|--------|---------|--------|
| 0 | Setup & Arquitectura (Multi-sucursal base) | 1–2 | ✅ Entregado |
| 1 | Pacientes & Tutores | 3–4 | ✅ Entregado |
| 2 | Agenda & Notificaciones | 5–6 | ✅ Entregado |
| 3 | Historia Clínica & Bitácora IA | 7–8 | ✅ Entregado |
| 4 | Inventario | 9–10 | ✅ Entregado |
| 5 | Facturación básica (DIAN pospuesto) | 11–12 | ✅ Entregado |
| 6 | Firma digital & Docs | 13–14 | ✅ Entregado |
| 7 | Reportes & Analytics | 15–16 | ✅ Entregado |
| 8 | Portal del tutor | 17–18 | ✅ Entregado |
| 9 | Multi-sucursal & Roles | 19–20 | ✅ Entregado |
| 10 | QA, Facturación DIAN & Go-Live | 21–22 | 🔲 Pendiente |

**Total estimado:** 22 semanas (~5.5 meses)  
**MVP mínimo (sprints 0–4):** 10 semanas para salir al mercado con la propuesta de valor principal

---

## 🛠️ Stack tecnológico

### Frontend
- Angular 21 (Standalone Components, Signals)
- Angular Material + CSS custom tokens
- FullCalendar (agenda)
- Chart.js (reportes)
- SignaturePad.js (firmas)

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- Redis (sesiones, jobs, cache)
- BullMQ (cola de trabajos: WhatsApp, recordatorios, reportes)

### IA & Integraciones
- OpenAI Whisper API (transcripción de voz)
- Claude API (estructuración de historia clínica y diagnóstico presuntivo)
- Meta WhatsApp Business Cloud API
- Siigo o Alegra (facturación electrónica DIAN)
- Wompi / PayU (pagos en línea)
- AWS S3 / Cloudflare R2 (almacenamiento)

### DevOps
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Railway o Render (hosting backend)
- Vercel o Netlify (hosting frontend)
- Sentry (errores) + Datadog (métricas)
