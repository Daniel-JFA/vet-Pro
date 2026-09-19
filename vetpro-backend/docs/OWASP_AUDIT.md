# 🛡️ VetPro SaaS — Informe de Auditoría de Seguridad OWASP (Top 10)

**Fecha:** 2026-09-19  
**Versión evaluada:** 2.0.0 (Go-Live Piloto)  
**Alcance:** Backend Express (`vetpro-backend`), Base de Datos PostgreSQL, Frontend Angular 21 (`vetpro-angular/vetpro`).

---

## 📋 Resumen Ejecutivo de Cumplimiento

| Categoría OWASP | Estado | Mecanismos de Mitigación Implementados |
|---|:---:|---|
| **A01:2021 — Broken Access Control** | ✅ CUMPLE | Multi-tenant estricto con `clinicId` en todas las consultas Prisma. Matriz RBAC centralizada (`config/permissions.ts`) en rutas sensibles. Verificación IDOR probada con tests de integración. |
| **A02:2021 — Cryptographic Failures** | ✅ CUMPLE | Contraseñas con `bcryptjs` (salt 10). JWT con `JWT_SECRET` forzado (min 32 caracteres verificado con Zod al arrancar). Tokens aislados por `audience` (`staff`, `tutor`, `platform`, `magic_link`). |
| **A03:2021 — Injection** | ✅ CUMPLE | Inyección SQL prevenida por Prisma ORM (consultas parametrizadas por defecto). XSS prevenido por sanitización contextual de Angular y directivas CSP en Helmet. Validación de archivos por firma de bytes (`image-type.ts`). |
| **A04:2021 — Insecure Design** | ✅ CUMPLE | Transacciones atómicas (`prisma.$transaction`) en facturación, pagos, anulaciones y stock. Regla de negocio de unicidad de usuario y aislamiento tenant. |
| **A05:2021 — Security Misconfiguration** | ✅ CUMPLE | Cabeceras HTTP endurecidas vía `helmet` (CSP, HSTS, frameguard, noSniff). Errores 500 sanitizados sin revelar trazas internas o queries SQL. CORS restringido a orígenes permitidos. |
| **A06:2021 — Vulnerable and Outdated Components** | ✅ CUMPLE | Dependencias verificadas con `npm audit`. Angular 21.2 y Node 20 LTS. |
| **A07:2021 — Identification & Authentication Failures** | ✅ CUMPLE | Access token de corta duración (15 min) + Refresh token rotativo en cookie `httpOnly` (7 días). Rate limiting (`express-rate-limit`) en login, register, refresh y magic-link. Revocación total en logout. |

---

## 🔍 Detalle Técnico por Control

### A01 — Broken Access Control
1. **Multi-Tenancy y Anti-IDOR:**
   - Cada consulta a nivel de base de datos incluye `where: { clinicId: req.user.clinicId }`.
   - La suite de integración en `tests/billing.integration.test.ts` verifica explícitamente que la Clínica B no puede ver ni modificar facturas, pagos o inventario de la Clínica A (retornando 404/403).
2. **Control de Acceso Basado en Roles (RBAC):**
   - Implementado en `src/config/permissions.ts` y aplicado mediante los middlewares `authMiddleware` y `roleMiddleware`.
   - Las operaciones financieras críticas (p. ej. anulación de facturas) están restringidas estrictamente al rol `admin`.
   - Personal sin privilegios clínicos o de facturación (p. ej. paseadores) no tienen acceso a pacientes ni historiales médicos.

### A02 — Cryptographic Failures
1. **Almacenamiento de Contraseñas:**
   - Hasheadas usando `bcrypt.hash(password, 10)` antes del almacenamiento en `User.passwordHash`.
2. **Gestión de Secretos:**
   - Validación al inicio mediante `src/config/env.ts` (Zod): si `JWT_SECRET` no está configurado, o en producción mide menos de 32 caracteres o coincide con cadenas inseguras conocidas, el servidor aborta el inicio inmediatamente.
3. **Aislamiento de Audiencia:**
   - Tokens firmados con audiencias estrictas (`vetpro_staff_access`, `vetpro_tutor_portal`, `vetpro_platform_admin`, `vetpro_magic_link`), impidiendo que un token de portal tutor sea aceptado en rutas de clínica o viceversa.

### A03 — Injection
1. **SQL Injection:**
   - VetPro utiliza Prisma ORM exclusivamente, evitando concatenación de cadenas SQL en consultas.
2. **Cross-Site Scripting (XSS):**
   - El frontend Angular 21 escapa por defecto todos los valores enlazados en plantillas (`{{ }}`).
   - El backend configura `helmet.contentSecurityPolicy` limitando orígenes permitidos de scripts y estilos.
3. **Inyección en Subida de Archivos:**
   - La utilidad `src/utils/image-type.ts` analiza la cabecera mágica de bytes (`FF D8 FF`, `89 50 4E 47`, etc.) para verificar que un archivo `.png` o `.jpg` sea genuinamente una imagen y no un ejecutable o script renombrado.

### A05 — Security Misconfiguration
1. **Cabeceras HTTP de Seguridad:**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Content-Security-Policy`
   - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
2. **Manejo Seguro de Excepciones:**
   - En `src/middleware/error.ts`, los errores 500 no devuelven `err.message` ni el stack trace al cliente en producción.
   - Cada error se asocia a un identificador único correlacionado `X-Request-Id` y se registra en JSON estructurado vía Pino.
3. **CORS:**
   - Restringido por defecto a los dominios configurados en `ALLOWED_ORIGINS`.

### A07 — Identification and Authentication Failures
1. **Mitigación de Ataques de Fuerza Bruta:**
   - `express-rate-limit` limita intentos a 15 por minuto por IP en:
     - `POST /api/v1/auth/login`
     - `POST /api/v1/auth/register`
     - `POST /api/v1/auth/refresh`
     - `POST /api/v1/portal/auth/magic-link`
     - `POST /api/v1/platform/auth/login`
2. **Manejo de Sesiones Moderno:**
   - Access token JWT expira en 15 minutos.
   - Refresh token de 7 días se transmite en cookie `httpOnly` con flags `SameSite=Lax` y `Secure` (en prod).
   - Rotación del refresh token en cada llamada a `/refresh`.
   - Limpieza de cookie en `/logout`.

---

## 🚀 Escaneo Automatizado con OWASP ZAP (Staging)

Para ejecutar el escaneo dinámico de vulnerabilidades contra el entorno de pruebas o staging:

```bash
# Ejecutar desde el directorio vetpro-backend
./scripts/run-zap-audit.sh http://localhost:3000 http://localhost:4200
```

El script genera los reportes en HTML y JSON (`zap-report.html`, `zap-report.json`) y valida que existan **0 vulnerabilidades de severidad Alta o Crítica**.
