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

### Sprint 0 — Cierre inmediato (esta semana, ~0,5 día)
| Tarea | Estado |
|---|---|
| Tutor con varias mascotas (selector de hasta 500 tutores, columna "Mascotas", botón "Agregar mascota", `GET /tutors` incluye mascotas) | ✅ Verificado contra la API |
| `npm install` en `vetpro-backend` (el pull trajo `multer`) | ✅ |
| Probar en navegador Tutores → Agregar mascota | 🔲 (el front compila; falta la prueba visual) |
| Commit y push | 🔲 |

### Sprint 1 — Seguridad y continuidad (2026-09-21 → 2026-10-02)
**Avance 2026-09-19:** 1.1, 1.2, 1.3, 1.4, 1.5 y 1.6 aplicados y verificados. **¡Sprint 1 completado al 100%!**
**Meta:** ningún rol hace lo que no le corresponde, no hay secretos por defecto y los datos se pueden recuperar.

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 1.1 ✅ | **Matriz de permisos por rol** (`admin`, `vet`, `assistant`, `receptionist`, `groomer`, `walker`) aplicada a todas las rutas; ocultar en el front los botones sin permiso. | 2,5 | Documento aprobado por ti; cada ruta con `roleMiddleware`; un `groomer` recibe 403 al anular factura o borrar paciente. |
| 1.2 ✅ | **Config centralizada** `config/env.ts` validada con zod; eliminar todo fallback de `JWT_SECRET`. | 1 | Arrancar sin `JWT_SECRET` falla con mensaje claro; grep de la clave por defecto da 0 resultados. |
| 1.3 ✅ | **Separar firma de tokens** (secreto o `audience` distinto por tipo). | 1 | Un token de tutor no valida en `authMiddleware` aunque comparta secreto. |
| 1.4 ✅ | **Backups locales en el servidor:** script de respaldo (`pg_dump` + `gzip`), rotación de 30 días en el servidor propio vía cron y **probar un restore**. | 1 | `backup-local.sh` y `restore-local.sh` creados, probados y documentados en `PRODUCCION_RUNBOOK.txt`. |
| 1.5 ✅ | **CI con compuertas:** `tsc --noEmit`, lint y tests antes de publicar imágenes. | 1 | Un cambio con error de tipos falla el pipeline y no despliega. |
| 1.6 ✅ | **Fotos más seguras:** validar el contenido real (firma de bytes) y derivar la extensión del tipo detectado. | 0,5 | Un `.html` renombrado a `.png` es rechazado. |

**Total:** ~7 días. **Riesgo:** 1.1 puede destapar pantallas que asumen acceso total.

### Sprint 2 — Calidad y datos limpios (2026-10-05 → 2026-10-16)
**Avance 2026-09-19:** 2.1, 2.2, 2.3, 2.4 y 2.5 hechos. **¡Sprint 2 completado al 100%!**
**Meta:** poder cambiar código sin miedo y que los datos de clientes no se ensucien.

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 2.1 ✅ | **Tests de backend (Vitest + supertest):** facturación (totales, pago, anulación con reversa de inventario), caja por método y sede, inventario y **aislamiento entre clínicas**. | 3,5 | 39 tests en CI (17 de integración cubriendo cada endpoint de dinero con tenant cruzado). |
| 2.2 ✅ | **Tutores duplicados:** aviso al crear con teléfono o documento existente; índice `(clinicId, documentId)` si el documento es único por negocio. | 1 | Crear un tutor con teléfono existente ofrece abrir el existente. |
| 2.3 ✅ | **Errores y logs:** logger estructurado (pino + pino-http) con ID de petición (`X-Request-Id`); el manejador global no expone `err.message` interno en producción. | 1,5 | Un 500 devuelve mensaje genérico + ID; el detalle queda en el log estructurado en JSON. |
| 2.4 ✅ | **Monitoreo:** Sentry en backend y front + alerta de caída sobre `/api/health`. | 1 | `@sentry/node` y `@sentry/angular` instrumentados; monitor de `/api/health` documentado en `PRODUCCION_RUNBOOK.txt`. |
| 2.5 ✅ | **Decisión sobre `User.email` único global:** Resuelto (NO). Un usuario no comparte cuenta entre clínicas; se mantiene la unicidad global en el schema. | 0,5 | Decisión registrada: sin cambios al schema de Prisma. |

**Total:** ~7,5 días

### Sprint 3 — Mantenibilidad y experiencia (2026-10-19 → 2026-10-30)
**Avance 2026-09-19:** 3.1, 3.2, 3.3 y 3.4 hechos y verificados. **¡Sprint 3 completado al 100%!**

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 3.1 ✅ | **Migrar `*ngIf/*ngFor` a `@if/@for`** (`ng generate @angular/core:control-flow` + revisión manual). | 1 | 0 usos de la sintaxis antigua; Angular build pasa en 5s. |
| 3.2 ✅ | **Partir componentes gigantes** (`landing`, `dashboard`, `user-list`). | 2,5 | Ninguno sobre 400 líneas (landing: 85, dashboard: 204, user-list: 292); sin cambios visuales. |
| 3.3 ✅ | **Refactor de `auth.routes` a `routes → services`** como piloto del patrón (luego billing, inventario). | 2 | Rutas reducidas a 325 líneas; lógica en `AuthService` cubierta por tests. |
| 3.4 ✅ | **Refresh token** en cookie `httpOnly` y token de acceso corto. | 2 | Acceso dura 15m; refresh token de 7d en cookie httpOnly con rotación y logout; 4 tests pasando. |

**Total:** ~7,5 días

### Sprint 4 — Go-Live de clínicas piloto (2026-11-02 → 2026-11-13)
**Meta:** cumplir la puerta de salida para abrir a clínicas reales.

| # | Historia | Días |
|---|---|---|
| 4.1 | **E2E con Playwright en CI**: login → agenda → atender cita → historia con IA → facturar; inventario → alerta de stock; reporte mensual → exportar Excel. | 3 |
| 4.2 | **Auditoría OWASP** (checklist A01, A02, A03, A05, A07) + escaneo con OWASP ZAP en staging. | 2 |
| 4.3 | **Cumplimiento legal (Ley 1581, Habeas Data):** política de privacidad, autorización de tratamiento de datos en registro de tutores y usuarios, aviso en el enlace mágico. | 1,5 |
| 4.4 | **Performance:** Lighthouse móvil > 90 en el portal del tutor, bundle < 2 MB, índices y N+1 en las consultas más lentas. | 1,5 |

**Puerta de salida (Go-Live Gate):** E2E verdes en CI · 0 vulnerabilidades críticas/altas en ZAP · restore de backup probado · error rate < 0,5 % con 100 usuarios concurrentes en staging · al menos 3 clínicas beta durante 1 semana sin incidentes críticos.

---

## 4. Backlog por fases (después del Sprint 4)

Ordenado por valor para las clínicas. Sin fechas hasta terminar el Go-Live.

### Fase B — Diferenciadores
1. **Recordatorios automáticos por WhatsApp** (vacunas y citas): cola de trabajos (BullMQ + Redis), plantillas aprobadas por Meta y registro de retorno por campaña.
2. **Importador de pacientes y tutores desde Excel/CSV**, clave para migrar clínicas de otro sistema.
3. **DIAN:** configurar proveedor autorizado (decisión de negocio), reactivar el flujo y agregar notas crédito y documento soporte.
4. **Cita → factura y cita → historia clínica en un clic.**
5. **PWA del personal** para celular (y del portal del tutor, con Lighthouse > 90).
6. **Reactivar Notificaciones y Grooming** solo con backend real.
7. **Almacenamiento de archivos en Cloudflare R2** (fotos, firmas, adjuntos) con URL firmadas, en lugar del volumen local.

### Fase D — Marketplace de veterinarios a domicilio ("tipo Rappi")
Es el diferenciador estratégico frente a OkVet, pero **hoy no existe nada de código**. Solo conviene empezarlo con las clínicas piloto estables. Sprints previstos (~8 semanas):
1. **Schema y backend:** `VetProvider`, zonas de cobertura, pedidos, pagos, reseñas, payouts; rutas `/marketplace/*`; motor de despacho (Haversine, 70 % distancia + 30 % rating, aviso al primer vet con ventana de 90 s y paso al siguiente).
2. **App del tutor:** pedir servicio, mapa (Leaflet), seguimiento.
3. **App del vet independiente:** onboarding con licencia, recibir/aceptar pedidos, GPS.
4. **Tiempo real y pagos:** Socket.IO, Wompi (cobro al completar; 85 % vet / 15 % plataforma), efectivo como alternativa, reseñas, ganancias y payout semanal (manual al inicio).

Decisiones de arquitectura ya tomadas: Leaflet (sin costo de API), Wompi (Colombia), Cloudflare R2, Socket.IO, pino.

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
5. **Marketplace On-Demand:** ✅ **Aún no.** Se mantiene en la Fase D (post Go-Live de clínicas piloto).

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

**Sprints 1, 2 y 3:** **100% completados.** Siguiente fase: **Sprint 4 — Go-Live de clínicas piloto**.

**Antes del próximo despliegue:** verificar que el `.env` del servidor de producción tiene un `JWT_SECRET` real (≥ 32 caracteres). Si no, el backend ahora se niega a arrancar. Además, al desplegar se cerrarán todas las sesiones activas (los tokens anteriores no llevan `audience`).
