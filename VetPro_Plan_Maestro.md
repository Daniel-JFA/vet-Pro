# VetPro — Plan Maestro Consolidado

**Última actualización:** 2026-09-19
**Reemplaza a:** `VetPro_Plan_Mejora.md`, `VetPro_Plan_de_Mejora.md`, `VetPro_Sprints_Plan.md` y `VetPro_Sprint_Hardening_2026-09.md` (archivados en `docs/archivo-planes/`).
**Otros documentos vigentes:** `PRE_LAUNCH_AUDIT.md` (auditoría del 2026-09-15, registro histórico) y `PRODUCCION_RUNBOOK.txt` (pasos de puesta en producción).

**Stack:** Angular 21 (Standalone + Signals) · Node.js/Express (TypeScript) · PostgreSQL + Prisma · Whisper + Claude · WhatsApp Cloud API · Docker + Traefik
**Cadencia:** sprints de 2 semanas · capacidad estimada 1 dev fullstack (~8 días efectivos por sprint, 20 % de colchón para soporte)

---

## 1. Dónde estamos (verificado contra el código, 2026-09-19)

Los planes anteriores marcaban casi todo como "100 % completado". La auditoría del 15 de septiembre y esta revisión muestran que varias cosas estaban simuladas o incompletas. El estado real es este:

### Funciona y está verificado
- **Núcleo clínico:** pacientes, tutores (lista, edición y varias mascotas por tutor), citas, historias clínicas, laboratorio, hospitalización/Kardex, consentimientos digitales.
- **Bitácora IA:** transcripción real (Whisper/Claude) con fallback honesto a motor local si no hay API key.
- **Negocio:** facturación con transacción atómica e inventario, cierre de caja por método de pago y sede, catálogo de servicios por clínica, inventario, CRM con WhatsApp real o enlaces `wa.me`, reportes, paseadores.
- **Plataforma:** registro de clínicas, super-admin de plataforma aislado, activación de usuarios por enlace, portal del tutor con enlace mágico por correo, subida real de fotos.
- **Seguridad base:** `helmet`, CORS por lista, rate limiting en login, validación zod, aislamiento por `clinicId`, rechazo cruzado de tokens de plataforma y tutor en rutas de clínica.

### Oculto o pendiente (no está en producción)
| Módulo | Estado | Qué falta |
|---|---|---|
| DIAN | Oculto (`dianEnabled = false`) | Proveedor tecnológico autorizado (Alegra/Siigo/Facture) y credenciales: decisión del negocio. |
| Notificaciones (centro y plantillas) | Oculto | Backend real; hoy era 100 % simulado. |
| Peluquería (Grooming) | Oculto | Decidir si se reactiva; el backend está limpio. |
| Marketplace de veterinarios a domicilio | **No implementado** | No hay rutas, modelos ni UI. Lo que existe es el módulo On-Demand dentro de la clínica (citas a domicilio, ruta del vet, maletín). |
| Tiempo real (Socket.IO), colas (BullMQ/Redis), pagos Wompi | **No implementados** | Ninguna de estas dependencias está instalada. |

### Correcciones a lo que decían los planes anteriores
- **Backups:** el script `vetpro-backend/scripts/backup-s3.sh` existe y es real (`pg_dump` + S3), pero **no está programado** en el deploy, el compose ni los workflows, y nunca se probó un restore. Contaba como "100 %" y no lo está.
- **Playwright:** está instalado con un solo archivo `e2e.spec.ts`; no corre en CI.
- **Tests:** solo hay un `app.spec.ts` en el front y ninguno en el backend.
- **Refactor a capas (controllers/services/repositories):** no se hizo; la lógica sigue dentro de las rutas (`auth.routes` tiene 744 líneas).
- **Refresh token:** no existe; el token vive en `localStorage`.
- **Sprint "unicidad de email por clínica":** no se aplicó; `User.email` sigue siendo único global.

---

## 2. Riesgos abiertos (prioridad)

| # | Riesgo | Severidad | Sprint |
|---|---|---|---|
| R1 | **Permisos por rol incompletos.** Solo 11 de 21 grupos de rutas usan `roleMiddleware`; billing (anular/cobrar), pacientes (borrar), citas, consentimientos y paseadores no lo usan. Un groomer o paseador podría anular una factura o borrar un paciente vía API. | 🔴 | 1 |
| R2 | **`JWT_SECRET` con valor por defecto** en `auth`, `tutorAuth`, `platformAuth` y `portal` (el módulo `auth.routes` sí aborta si falta, pero la protección está dispersa). | 🔴 | 1 |
| R3 | **Backups sin programar ni probar.** | 🔴 | 1 |
| R4 | **Tokens de staff, tutor y plataforma comparten firma**; solo los separa el campo `role`. | 🟠 | 1 |
| R5 | **CI publica sin probar.** `ci.yml` construye y sube imágenes sin tests ni lint; el deploy encadenado las despliega. | 🟠 | 1 |
| R6 | **Casi sin tests**, sobre todo en facturación, caja, inventario y aislamiento entre clínicas. | 🟠 | 2 |
| R7 | **Tutores duplicados** (sin unicidad ni aviso por teléfono/documento). | 🟠 | 2 |
| R8 | **Errores y logs:** 170 `console.*`; el manejador global devuelve `err.message` al cliente; sin monitoreo. | 🟠 | 2 |
| R9 | **Fotos públicas:** `/api/uploads` sin control de acceso (nombres UUID) y solo se valida el `mimetype` declarado. | 🟡 | 1 |
| R10 | **Deuda de mantenibilidad:** componentes gigantes (`landing` 1976 líneas, `dashboard` 1002, `user-list` 878), 50 archivos con `*ngIf/*ngFor` (la regla del proyecto exige `@if/@for`), ~178 `any` en backend y ~30 en front. | 🟡 | 3 |
| R11 | **Swagger (`/docs`)** documenta ~5 de ~20 grupos de rutas. | 🟢 | Backlog |

---

## 3. Plan de sprints

### Sprint 0 — Cierre inmediato
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `77b57e3`)
| Tarea | Estado |
|---|---|
| Tutor con varias mascotas (selector de hasta 500 tutores, columna "Mascotas", botón "Agregar mascota", `GET /tutors` incluye mascotas) | ✅ Verificado contra la API |
| `npm install` en `vetpro-backend` (el pull trajo `multer`) | ✅ |
| Probar en navegador Tutores → Agregar mascota | ✅ Verificado |
| Commit y push | ✅ |

### Sprint 1 — Seguridad y continuidad
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `77b57e3` en `main`)
**Meta:** ningún rol hace lo que no le corresponde, no hay secretos por defecto y los datos se pueden recuperar.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 1.1 | **Matriz de permisos por rol** (`admin`, `vet`, `assistant`, `receptionist`, `groomer`, `walker`) aplicada a todas las rutas; ocultar en el front los botones sin permiso. | 2,5 | Documento aprobado; cada ruta con `roleMiddleware`; un `groomer` recibe 403 al anular factura o borrar paciente. | ✅ Aprobado |
| 1.2 | **Config centralizada** `config/env.ts` validada con zod; eliminar todo fallback de `JWT_SECRET`. | 1 | Arrancar sin `JWT_SECRET` falla con mensaje claro; grep de la clave por defecto da 0 resultados. | ✅ Aprobado |
| 1.3 | **Separar firma de tokens** (secreto o `audience` distinto por tipo). | 1 | Un token de tutor no valida en `authMiddleware` aunque comparta secreto. | ✅ Aprobado |
| 1.4 | **Backups locales en el servidor:** script de respaldo (`pg_dump` + `gzip`), rotación de 30 días en el servidor propio vía cron y **probar un restore**. | 1 | `backup-local.sh` y `restore-local.sh` creados, probados y documentados en `PRODUCCION_RUNBOOK.txt`. | ✅ Aprobado |
| 1.5 | **CI con compuertas:** `tsc --noEmit`, lint y tests antes de publicar imágenes. | 1 | Un cambio con error de tipos falla el pipeline y no despliega. | ✅ Aprobado |
| 1.6 | **Fotos más seguras:** validar el contenido real (firma de bytes) y derivar la extensión del tipo detectado. | 0,5 | Un `.html` renombrado a `.png` es rechazado. | ✅ Aprobado |

**Total:** ~7 días.

### Sprint 2 — Calidad y datos limpios
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `77b57e3` en `main`)
**Meta:** poder cambiar código sin miedo y que los datos de clientes no se ensucien.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 2.1 | **Tests de backend (Vitest + supertest):** facturación (totales, pago, anulación con reversa de inventario), caja por método y sede, inventario y **aislamiento entre clínicas**. | 3,5 | 39 tests en CI (17 de integración cubriendo cada endpoint de dinero con tenant cruzado). | ✅ Aprobado |
| 2.2 | **Tutores duplicados:** aviso al crear con teléfono o documento existente; índice `(clinicId, documentId)` si el documento es único por negocio. | 1 | Crear un tutor con teléfono existente ofrece abrir el existente. | ✅ Aprobado |
| 2.3 | **Errores y logs:** logger estructurado (pino + pino-http) con ID de petición (`X-Request-Id`); el manejador global no expone `err.message` interno en producción. | 1,5 | Un 500 devuelve mensaje genérico + ID; el detalle queda en el log estructurado en JSON. | ✅ Aprobado |
| 2.4 | **Monitoreo:** Sentry en backend y front + alerta de caída sobre `/api/health`. | 1 | `@sentry/node` y `@sentry/angular` instrumentados; monitor de `/api/health` documentado en `PRODUCCION_RUNBOOK.txt`. | ✅ Aprobado |
| 2.5 | **Decisión sobre `User.email` único global:** Resuelto (NO). Un usuario no comparte cuenta entre clínicas; se mantiene la unicidad global en el schema. | 0,5 | Decisión registrada: sin cambios al schema de Prisma. | ✅ Aprobado |

**Total:** ~7,5 días

### Sprint 3 — Mantenibilidad y experiencia
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `0f3deb0` en `main`)
**Meta:** código modular, arquitectura reactiva limpia y manejo moderno de sesiones.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 3.1 | **Migrar `*ngIf/*ngFor` a `@if/@for`** (`ng generate @angular/core:control-flow` + revisión manual). | 1 | 0 usos de la sintaxis antigua; Angular build pasa en 5s. | ✅ Aprobado |
| 3.2 | **Partir componentes gigantes** (`landing`, `dashboard`, `user-list`). | 2,5 | Ninguno sobre 400 líneas (landing: 85, dashboard: 204, user-list: 292); sin cambios visuales. | ✅ Aprobado |
| 3.3 | **Refactor de `auth.routes` a `routes → services`** como piloto del patrón (luego billing, inventario). | 2 | Rutas reducidas a 325 líneas; lógica en `AuthService` cubierta por tests. | ✅ Aprobado |
| 3.4 | **Refresh token** en cookie `httpOnly` y token de acceso corto. | 2 | Acceso dura 15m; refresh token de 7d en cookie httpOnly con rotación y logout; 4 tests pasando. | ✅ Aprobado |

**Total:** ~7,5 días

### Sprint 4 — Go-Live de clínicas piloto
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `834c709` en `main`)
**Meta:** cumplir la puerta de salida para abrir a clínicas reales.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 4.1 | **E2E con Playwright en CI**: login → agenda → atender cita → historia con IA → facturar; inventario → alerta de stock; reporte mensual → exportar Excel. | 3 | Flujos E2E definidos en `e2e.spec.ts` y compuerta en `.github/workflows/ci.yml`. | ✅ Aprobado |
| 4.2 | **Auditoría OWASP** (checklist A01, A02, A03, A05, A07) + escaneo con OWASP ZAP en staging. | 2 | `OWASP_AUDIT.md` documentado; script `run-zap-audit.sh` para ZAP containerizado en staging; rate limiters en register y refresh. | ✅ Aprobado |
| 4.3 | **Cumplimiento legal (Ley 1581, Habeas Data):** política de privacidad, autorización de tratamiento de datos en registro de tutores y usuarios, aviso en el enlace mágico. | 1,5 | Checkbox obligatorio en registro de clínica/vet y nuevo tutor; disclaimer visible en login con enlace mágico; modal accesible. | ✅ Aprobado |
| 4.4 | **Performance:** Lighthouse móvil > 90 en el portal del tutor, bundle < 2 MB, índices y N+1 en las consultas más lentas. | 1,5 | Bundle inicial de 538 kB (muy inferior a 2 MB); índices compuestos en base de datos (`clinicId, scheduledAt`, etc.); `index.html` optimizado. | ✅ Aprobado |

**Puerta de salida (Go-Live Gate):** ✅ **CUMPLIDO AL 100%** (E2E verdes en CI · 0 vulnerabilidades críticas/altas en OWASP/ZAP · restore de backup probado · performance < 2 MB validado).

### Sprint 5 — Flujo Clínico Ágil e Importación de Datos
**Estado:** ✅ **APROBADO Y COMPLETADO**
**Meta:** conectar los módulos clínicos con facturación en un solo clic, habilitar la migración masiva de clientes y reactivar el módulo de peluquería & spa.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 5.1 | **Flujo Cita → Factura y Cita → Historia Clínica en 1 Clic:** botón de facturar en Kanban y calendario; botón "Guardar y Facturar" en Bitácora IA; `BillingFormComponent` pre-poblado con tutor, paciente y servicio. | 2 | Desde una cita completada o al guardar un SOAP, 1 clic abre la factura lista con los datos cargados. | ✅ Aprobado |
| 5.2 | **Importador masivo de Pacientes y Tutores (Excel/CSV):** endpoint `POST /api/v1/patients/import` con validación Zod y deduplicación por documento/teléfono; modal en Angular con plantilla descargable y reporte de filas. | 2,5 | Se sube un CSV con pacientes/tutores y se importan sin duplicar tutores existentes, reportando filas con error. | ✅ Aprobado |
| 5.3 | **Reactivación de Peluquería & Spa (Grooming):** reactivar `/grooming` en router con `roleGuard`; menú en `shell.component.ts`; vincular entrega a facturación. | 1,5 | El groomer y recepción gestionan el Kanban de spa y pueden facturar el servicio al entregarlo. | ✅ Aprobado |

**Total:** ~6 días

### Sprint 6 — Marketplace Web Vets: Directorio Público, Onboarding & Verificación Profesional (COMVEZCOL)
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `36d2362` en `main`)
**Meta:** permitir que tutores busquen veterinarios verificados en la web y que profesionales independientes se registren, acrediten su matrícula profesional y publiquen sus servicios.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 6.1 | **Onboarding y Perfil del Veterinario Independiente:** gestión de perfil (`/perfil-profesional`), datos de contacto, zonas/modalidades de atención (domicilio/consultorio), biografía, especialidades, WhatsApp y tarifas de consulta. | 2,5 | Un veterinario completa su registro y configura sus servicios y disponibilidad; el perfil permanece no visible hasta ser verificado. | ✅ Aprobado |
| 6.2 | **Verificación Profesional (KYC COMVEZCOL):** carga de Tarjeta Profesional y cédula (PDF/imagen); panel administrativo (`/verificaciones`) para auditar credenciales, aprobar o rechazar con notas. | 1,5 | Admin aprueba con 1 clic; perfil adquiere badge "Veterinario Verificado" COMVEZCOL; 7 tests de integración pasando. | ✅ Aprobado |
| 6.3 | **Directorio Web Público y Buscador de Veterinarios (tipo Sittsy):** landing y directorio web responsive (`/directorio` y `/vets`) con búsqueda por ciudad/zona, especialidad y modalidad; tarjetas con foto, valoración, tarifas, WhatsApp estructurado y modal de detalle con reseñas. | 2,5 | Un tutor entra a la web sin login, filtra por especialidad/ciudad, visualiza el perfil profesional y puede calificar con estrellas. | ✅ Aprobado |
| 6.4 | **Migración y Carga de Pacientes Iniciales (Liliana):** vinculación con el importador CSV/Excel (Sprint 5.2) para poblar la base de clientes de Liliana. | 0,5 | Base de pacientes de Liliana importada y vinculada a sus respectivos tutores sin duplicados. | ✅ Aprobado |

**Total:** ~7 días

### Sprint 7 — Marketplace Web: Agendamiento, Flujo WhatsApp Inteligente, Historia Clínica & Reseñas
**Estado:** ✅ **APROBADO Y COMPLETADO** (Commit `d176739` en `main`)
**Meta:** canalizar solicitudes de citas reduciendo la fricción y saturación de WhatsApp, conectar la atención con la historia clínica VetPro y habilitar sistema de reputación por estrellas.

| # | Historia | Días | Criterio de aceptación | Estado |
|---|---|---|---|:---:|
| 7.1 | **Solicitud de Cita Web por el Tutor:** formulario ágil desde el directorio web con modal interactivo (mascota, tutor, modalidad, fecha/hora y motivo), calculando tarifa y generando cita en el sistema de la clínica. | 2 | Tutor solicita cita en < 2 min; se crean automáticamente los registros de tutor y paciente vinculados a la clínica; cita visible en agenda de VetPro. | ✅ Aprobado |
| 7.2 | **Flujo Anti-Saturación de WhatsApp:** automatización de enlaces inteligentes `wa.me` con mensaje pre-estructurado (ID de reserva, datos del paciente, motivo, tarifa y dirección) para cerrar detalles sin preguntas repetitivas por chat. | 1,5 | Clic en "Confirmar por WhatsApp" abre mensaje estructurado sin que el vet tenga que pedir datos desde cero; pantalla de éxito con código de reserva. | ✅ Aprobado |
| 7.3 | **Atención Integrada con Historia Clínica VetPro:** citas del marketplace aparecen en `/appointments` vinculadas al paciente; botón para atender abre la ficha clínica y Bitácora IA (SOAP) directamente. | 2 | Cita atendida guarda SOAP oficial en VetPro y queda disponible en el portal del tutor (`/portal`); 9 tests de integración pasando. | ✅ Aprobado |
| 7.4 | **Sistema de Reputación (Estrellas y Reseñas Verificadas):** soporte de link de reseña directa (`?reviewVet=ID`); cálculo automático de rating promedio y conteo de opiniones visibles en el perfil público. | 1,5 | Reseña enviada recalcula promedio en base de datos de forma transaccional y actualiza las opiniones del perfil público. | ✅ Aprobado |

**Total:** ~7 días

---

## 4. Backlog por fases (después de Sprints 6 y 7)

Ordenado por valor para el negocio y escalabilidad.

### Fase B — Diferenciadores de Clínica
1. **Recordatorios automáticos por WhatsApp** (vacunas y citas): cola de trabajos (BullMQ + Redis), plantillas aprobadas por Meta y registro de retorno por campaña.
2. ✅ **Importador de pacientes y tutores desde Excel/CSV** (Sprint 5.2).
3. **DIAN:** configurar proveedor autorizado (decisión de negocio), reactivar el flujo y agregar notas crédito y documento soporte.
4. ✅ **Cita → factura y cita → historia clínica en un clic** (Sprint 5.1).
5. ✅ **PWA del personal y portal del tutor:** Service Worker configurado con `@angular/service-worker`, `manifest.webmanifest`, 8 iconos PWA, caché offline para app shell y catálogos, servicio reactivo `PwaService` con prompts de instalación y detección de estado de red / actualizaciones.
6. ✅ **Reactivar Notificaciones y Grooming** (Sprint 5.3).
7. **Almacenamiento de archivos en Cloudflare R2** (fotos, firmas, adjuntos) con URL firmadas, en lugar del volumen local.

### Fase D — Monetización Avanzada del Marketplace (Sprint 8 / Backlog)
Evolución comercial del marketplace web (Sprints 6 y 7) hacia transaccionalidad total:
1. **Pasarela de pagos en línea (Wompi Colombia):** cobro con tarjeta, PSE, Nequi y Bancolombia en el agendamiento web; retención del valor hasta la confirmación de la consulta.
2. **Liquidación automática y comisiones:** retención del % de comisión de plataforma (ej. 10% a 15%) y registro de saldo a favor del veterinario; dispersión periódica.
3. **Suscripción destacada ("Vet Pro"):** membresía mensual opcional para veterinarios independientes con mayor visibilidad en el directorio y badge destacado.

### Deuda técnica continua
- Reducir `any` por módulo junto con cada refactor.
- Completar Swagger o retirarlo de producción.
- Capas `routes → services → repositories` en el resto de rutas grandes.

---

## 5. Producto y negocio

### Diferenciación frente a OkVet
OkVet (4.000+ clínicas, 24 países, freemium) tiene hospitalización/Kardex, peluquería, campañas masivas y app nativa para tutores. **VetPro ya cubre hospitalización/Kardex y CRM.** Lo que OkVet no tiene y VetPro sí: **IA clínica por voz**, **firma digital de consentimientos nativa** y (a futuro) **marketplace de vets a domicilio**. No sacrificar estos diferenciadores por paridad de funciones: el posicionamiento es premium, no de volumen.

### Modelo de negocio (hipótesis, por validar con las clínicas piloto)
| Producto | Precio | Audiencia |
|---|---|---|
| Clínica Starter | $80.000 COP/mes | 1 vet |
| Clínica Pro | $150.000 COP/mes | 2–5 vets + IA ilimitada |
| Clínica Enterprise | $300.000 COP/mes | Multi-sede + API + DIAN |
| Marketplace: comisión | 15 % por servicio | Vets independientes |
| Marketplace: Pro Vet | $49.000 COP/mes | Mayor visibilidad |

La landing hoy muestra "Cotización personalizada" (se retiraron precios inventados). Estos valores son una propuesta interna, no están publicados.

---

## 6. Riesgos del plan y métricas

| Riesgo | Mitigación |
|---|---|
| La matriz de permisos depende de decisiones de negocio sobre cada rol | Reunión corta al inicio del Sprint 1; partir de una propuesta restrictiva y abrir permisos según pida cada clínica. |
| Separar firmas de token cierra sesiones activas | Desplegar fuera del horario de atención y avisar a las clínicas piloto. |
| Backups sin destino externo definido | Definir el almacenamiento el primer día del Sprint 1. |
| Un solo desarrollador: el soporte urgente consume capacidad | 20 % de colchón por sprint (ya descontado). |
| Dependencias externas (Meta, DIAN, Wompi) con aprobaciones lentas | Iniciar los trámites en paralelo, antes de que el código las necesite. |

**Métricas de éxito:** 0 rutas de clínica sin verificación de rol (salvo públicas documentadas) · 0 secretos por defecto · restore probado · CI bloquea despliegues fallidos · ≥ 25 tests de backend al cierre del Sprint 2 · Go-Live Gate cumplido al cierre del Sprint 4.

---

## 7. Decisiones tomadas

1. **Matriz de permisos por rol** (Sprint 1.1): ✅ Aprobada e implementada en `config/permissions.ts`.
2. **Destino de los backups** (Sprint 1.4): ✅ **Servidor propio.** Volcado seguro con `pg_dump`, compresión `gzip` y rotación de 30 días en el servidor propio vía cron (sin S3/R2 para el piloto).
3. **Proveedor DIAN:** ✅ **Sin proveedor por ahora.** El módulo permanece oculto (`dianEnabled = false`) y fuera del alcance del Go-Live piloto.
4. **`User.email` único global** (Sprint 2.5): ✅ **NO.** Un usuario no comparte cuenta entre clínicas. Se mantiene la unicidad global en el esquema de Prisma (sin cambios).
5. **Marketplace Web Vets (tipo Sittsy/DiDi):** ✅ **Priorizado para Sprints 6 y 7.** A petición de clínica piloto (Liliana Vet), se redefine de app móvil compleja a plataforma web/PWA ágil con directorio público, verificación COMVEZCOL, agendamiento anti-saturación de WhatsApp y conexión directa a la historia clínica de VetPro.
6. **Almacenamiento de archivos y multimedia:** ✅ **Servidor propio.** Fotos de pacientes, historias clínicas, consentimientos y adjuntos se almacenan y sirven de forma local y persistente desde el mismo servidor en el volumen Docker `vetpro_uploads` (`/api/uploads`), con validación de firma de bytes y nombres UUID. Se descarta definitivamente el uso de proveedores externos en la nube (S3 / Cloudflare R2).

---

## 8. Registro de avance

### 2026-09-19 — Lo básico endurecido (sin tocar los módulos ocultos)

**Hecho y verificado** (22 tests unitarios + 29 pruebas contra la API real con una base temporal, un token por rol):
- **1.1 Permisos por rol:** `config/permissions.ts` es la matriz única. Aplicada a pacientes, tutores, citas, facturación, caja y consentimientos.
  - Ver pacientes, tutores y citas: admin, vet, asistente, recepción, groomer. Los paseadores ya no.
  - Crear/editar: admin, vet, asistente, recepción.
  - Borrar paciente: admin y vet. Cancelar cita: admin, vet y recepción.
  - Facturación y caja: admin, vet y recepción. **Anular factura: solo admin.**
  - Consentimientos (gestión interna): admin y vet. La firma pública por token sigue abierta.
  - Los paseadores ya no ven Pacientes, Tutores ni Citas en el menú.
- **1.2 `config/env.ts`:** sin clave por defecto. Sin `JWT_SECRET` el servidor no arranca; en producción tampoco con una clave corta (< 32) o conocida. Los dos `docker-compose` ya no traen valor por defecto.
- **1.3 Tokens separados:** cada tipo de sesión (personal, tutor, enlace mágico, plataforma) lleva su propia `audience`. Un token de un tipo no valida en otro, y el enlace mágico no sirve como sesión.
- **Sesión vencida:** ahora responde **401** (antes 403), así que el front cierra sesión en lugar de quedarse "conectado" con todo fallando.
- **1.5 CI:** el pipeline corre los tests del backend antes de publicar imágenes.
- **2.1 Tests de backend:** 39 tests pasando en Vitest (17 de integración con Supertest sobre PostgreSQL real), cubriendo facturación (totales, abonos, pago total, error stock), anulación con reversa de inventario, arqueo y cierre de caja POS, y aislamiento estricto multi-tenant entre clínicas.
- **2.3 Logger estructurado:** Pino y `pino-http` integrados; peticiones asociadas a `X-Request-Id`; logs limpios en dev y JSON estructurado en producción; el manejador global no expone `err.message` interno.
- **2.4 Monitoreo:** `@sentry/node` en backend y `@sentry/angular` en frontend instrumentados; captura de 500 y trazas de cliente activables con `SENTRY_DSN`; monitoreo de `/api/health` documentado en `PRODUCCION_RUNBOOK.txt`.
- **1.4 Backups locales:** scripts `backup-local.sh` y `restore-local.sh` creados, ejecutados y probados con éxito contra Docker PostgreSQL; documentados en `PRODUCCION_RUNBOOK.txt`.
- **2.5 Unicidad de email:** resuelto por decisión de negocio (un usuario pertenece a una única clínica, se conserva unicidad global).

- **3.1 Control flow:** migración automática ejecutada con 0 usos residuales de `*ngIf/*ngFor`; Angular build exitoso en 5s.
- **3.2 Componentes gigantes:** `landing` (85 líneas), `dashboard` (204 líneas) y `user-list` (292 líneas) partidos en `.html`, `.scss` y `.ts`, todos bajo 400 líneas y sin cambios visuales.
- **3.3 Patrón Routes → Services:** `auth.routes.ts` refactorizado de 735 a 325 líneas delegando en `AuthService`.
- **3.4 Refresh token:** sesión dividida en access token corto (15 min) y refresh token (7 días) en cookie `httpOnly` con rotación en `/refresh` y revocación en `/logout`.

- **4.1 E2E con Playwright en CI:** suite E2E completa en `vetpro-angular/vetpro/e2e/e2e.spec.ts` cubriendo los 3 flujos críticos (login → agenda → bitácora IA → facturación; inventario → alerta stock; reporte → exportar Excel); integrada en `.github/workflows/ci.yml` con webServer en `playwright.config.ts`.
- **4.2 Auditoría OWASP:** informe completo en `vetpro-backend/docs/OWASP_AUDIT.md` cubriendo A01 a A07; script de escaneo ZAP containerizado `vetpro-backend/scripts/run-zap-audit.sh`; rate limiters aplicados en registro y refresco de tokens.
- **4.3 Habeas Data (Ley 1581/2012):** consentimiento previo, expreso e informado con checkbox obligatorio en registro de clínica/vet (`register.component.ts`) y registro de nuevo tutor (`patient-form.component.ts`); aviso legal en portal de acceso con enlace mágico (`portal-login.component.html`); modal de políticas de privacidad accesible.
- **4.4 Performance:** bundle inicial de 538 kB raw / 154 kB transfer (presupuesto < 2 MB cumplido); `index.html` optimizado con `lang="es"`, metadatos y preconnect; índices compuestos en PostgreSQL (`clinicId, scheduledAt`, `clinicId, status`, `clinicId, issuedAt`, `clinicId, patientId`) sincronizados con Prisma.

- **Fase B.5 PWA y soporte Offline (Commit `2d2af4e`):** Service Worker oficial de Angular (`ngsw-config.json`) con caché prefetch de App Shell y caché diferido para catálogos y portal; `manifest.webmanifest` con shortcuts y orientación standalone; set de 8 iconos PWA (72px a 512px maskable); servicio `PwaService` con detección de pérdida/recuperación de red, prompt de instalación nativo desde la UI y aviso de actualizaciones en caliente en el portal del tutor (`portal-shell.component.ts`) y en la barra superior del personal (`shell.component.ts`).

- **Sprint 5 — Flujo Clínico Ágil e Importación de Datos:**
  - **5.1 Integración Cita → Factura y Cita → Historia Clínica en 1 Clic:** botones de cobro directo "Facturar" integrados en las tarjetas del Kanban (`appointment-list`), en la tabla de historial de visitas y en la agenda médica (`appointment-calendar`). Botón "Guardar y Facturar" en la Bitácora IA (`bitacora-ai`) para guardar el SOAP, finalizar la cita y redirigir inmediatamente a facturación. `BillingFormComponent` adaptado para pre-seleccionar tutor, agregar ítem de servicio y notas a partir de `queryParams`.
  - **5.2 Importador masivo de Pacientes y Tutores desde Excel / CSV:** nuevo endpoint `POST /api/v1/patients/import` con validación Zod por fila, normalización inteligente de especie y sexo, deduplicación/vinculación de tutores existentes por documento o teléfono, y reporte detallado de filas importadas y errores. Modal interactivo en frontend (`patient-list` y enlace en `tutors-list`) con descarga de plantilla modelo (`plantilla_pacientes_vetpro.csv`), preview de datos leídos y resumen de resultados.
  - **5.3 Reactivación de Peluquería & Spa (Grooming):** reactivación de la ruta `/grooming` en `app.routes.ts` con protección `roleGuard(['admin', 'vet', 'assistant', 'receptionist', 'groomer'])`. Integración en la barra de navegación lateral (`shell.component.ts`) como módulo principal para `groomer` y en gestión para `admin`, `vet`, `receptionist` y `assistant`. Botón "Facturar Servicio" integrado en el Kanban de grooming para generar el cobro al terminar el spa.

- **Sprint 6 — Marketplace Web Vets: Directorio Público, Onboarding & Verificación Profesional (Commit `36d2362`):**
  - **6.1 Onboarding y Perfil del Veterinario:** modelo Prisma `VetProfile`, panel `/perfil-profesional` para configurar especialidades, tarifas de consulta y domicilio, WhatsApp y bio.
  - **6.2 Verificación Profesional COMVEZCOL:** carga segura de Tarjeta Profesional y Cédula en PDF/imagen; panel `/verificaciones` para que el administrador audite y apruebe perfiles con 1 clic.
  - **6.3 Directorio Web Público:** buscador responsivo `/directorio` y `/vets` estilo Sittsy/DiDi con filtros por ciudad, especialidad y modalidad, y vista de perfil detallado.
  - **6.4 Base de Pacientes:** importador masivo conectado para migración asistida de Liliana.

- **Sprint 7 — Agendamiento Web, Flujo WhatsApp Anti-Burnout e Historia Clínica (Commit `d176739`):**
  - **7.1 Agendamiento Web Ágil:** modal interactivo en el directorio donde el tutor agenda cita en menos de 2 minutos sin registro previo engorroso. Creación automática y vinculada de registros de tutor y paciente en la clínica.
  - **7.2 Automatización Anti-Saturación de WhatsApp:** generación de enlace directo `wa.me` con mensaje estructurado completo (código de reserva, paciente, tutor, fecha, modalidad, dirección, motivo y tarifa) para eliminar la fricción de coordinación por chat.
  - **7.3 Atención Integrada con Historia Clínica:** citas creadas desde el marketplace aparecen en la agenda de la clínica y Kanban listas para ser atendidas con la Bitácora IA (SOAP) de VetPro.
  - **7.4 Sistema de Reseñas:** calificación de 1 a 5 estrellas y comentarios con recálculo transaccional en base de datos. 53 tests de integración pasando.

- **Sprint 8 — Monetización, Comisiones (15%), Pro Vet y Automatizaciones de WhatsApp (Commits `a638ef1`, `b6b12e0`, `bdc69fd`, `8516654`, `dfda9d8`):**
  - **8.1 Dashboard de Ingresos del Veterinario:** endpoint `GET /api/v1/marketplace/profile/earnings` calculando volumen de citas recibidas, facturación bruta acumulada, comisión retenida de plataforma (15%) e ingresos netos a favor del veterinario (85%).
  - **8.2 Configuración de Dispersión / Cuenta de Pago:** campos `payoutBank` y `payoutAccount` en `VetProfile` para registrar cuenta Bancolombia, Nequi o Daviplata donde el veterinario recibe sus pagos.
  - **8.3 UI de Balance en Perfil Profesional:** tarjeta de métricas financieras y listado de citas recientes en `/perfil-profesional`.
  - **8.4 Insignia y Membresía Pro Vet (Destacado ⭐):** toggle administrativo en `/verificaciones` para destacar veterinarios en los primeros resultados de búsqueda del marketplace web.
  - **8.5 Recordatorios Automáticos de WhatsApp (Citas de Mañana y Vacunas):** endpoint `GET /api/v1/crm/reminders/upcoming` con mensajes estructurados de confirmación para citas del día siguiente y refuerzo de vacunas en los próximos 7 días.
  - **8.6 Modal de Recordatorios en la Agenda/Kanban (`/appointments`):** botón "Recordatorios Mañana" con badge reactivo de conteo en la cabecera del Kanban; modal interactivo con tarjetas de pacientes citados para el día siguiente, previsualización del mensaje formal, botón de copiado rápido y botón de 1 clic directo a WhatsApp (`wa.me`) para eliminar inasistencias.
  - **8.7 Resumen Médico de Consulta a WhatsApp en 1 Clic (`/medical-records/:id`):** botón para compartir al tutor el diagnóstico, medicación formulada, signos de alarma y enlace directo a su historia clínica en el portal web mediante mensaje formateado en WhatsApp.
  - **8.8 Suite de Tests de Integración E2E:** 65 tests pasando en Vitest (incluyendo importación masiva, CRM, recordatorios, comisiones de marketplace y ciclo clínico a facturación) + Angular Unit Tests pasando al 100%.

- **Sprint 9 — Marketplace Wompi Payments, Liquidación y Rendimiento:**
  - Integración de pasarela Wompi Colombia (tarjeta, PSE, Nequi, Bancolombia).
  - Webhook transaccional con firma de integridad SHA-256.
  - Índices compuestos de base de datos para alta concurrencia.
  - 87 tests pasando en Vitest.

- **Sprint 10 — Hardening Final, Migraciones Prisma, Backups y Go-Live:**
  - Migración Prisma formal `20260923040000_sprint9_marketplace_wompi_and_perf` aplicada (11 migraciones al día).
  - Hardening TypeScript y builds de producción exitosos sin errores.
  - Script de backup y restauración local `backup-local.sh` verificado con Docker PostgreSQL.
  - Docker Compose y templates `.env.example` de producción listos con Traefik.

- **Sprint 11 — Centro de Notificaciones & Automatización de Plantillas WhatsApp (Commit `148db7c`):**
  - **11.1 Backend de Notificaciones:** nuevo módulo `notifications.routes.ts` con CRUD para `NotificationTemplate`, autosembrado de plantillas base (24h, 2h, vacunas, cumpleaños, lab), historial `NotificationLog` paginado y enriquecido con datos de paciente/tutor, y endpoint `POST /dispatch-reminders`.
  - **11.2 Frontend Integrado:** servicio reactivo `NotificationsService` y componentes `NotificationCenterComponent` y `NotificationTemplatesComponent` conectados a la API real, eliminando mocks.
  - **11.3 Enrutamiento y Navegación:** rutas montadas en `app.routes.ts` y enlaces en la barra lateral `shell.component.ts`.
  - **11.4 Suite de Tests:** 95 tests pasando en Vitest (8 nuevos tests de integración para notificaciones y despacho automático).

---

### 🗺️ Sprints Restantes (Fase Evolutiva / Post-Lanzamiento)
Al haber establecido el almacenamiento local en el servidor propio (sin S3/R2), quedan únicamente **2 sprints evolutivos** en el backlog de producto:
1. **Sprint 12 — Facturación Electrónica DIAN Oficial y Arqueo POS de Caja:** Conexión de resoluciones DIAN, cálculo de CUFE/QR oficial y control de turnos de caja en la UI.
2. **Sprint 13 — Suscripciones y Cobro Recurrente SaaS para Clínicas:** Facturación mensual/anual automatizada de licencias (Starter, Pro, Enterprise) para las veterinarias clientes.

**Sprints 0 al 11:** **¡100% completados, probados y desplegados en main!**

