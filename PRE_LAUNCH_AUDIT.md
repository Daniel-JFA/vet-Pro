# VetPro — Auditoría Pre-Lanzamiento

**Fecha:** 2026-09-15
**Alcance:** Revisión profesional de todos los módulos antes de salir a producción, buscando específicamente datos simulados/mock, flujos rotos, huecos de seguridad multi-tenant y problemas de responsive.

**Leyenda de estado:**
- ✅ **LISTO** — verificado extremo a extremo, sin datos simulados, sin bugs bloqueantes conocidos.
- 🟡 **LISTO CON OBSERVACIONES** — funciona, pero tiene un issue menor documentado (no bloqueante) o requiere una acción de negocio (no de código).
- 🔴 **CORREGIDO HOY** — se encontró un bug real durante esta auditoría y ya fue arreglado antes de este documento.
- ⛔ **OCULTADO** — no estaba listo; se removió del menú/rutas hasta que se complete.

---

## Resumen ejecutivo — qué se corrigió esta noche

1. **Veterinario asignado mostraba siempre "Dra. Laura"** en 6 lugares (todas las vistas de citas), sin importar quién estuviera realmente asignado. Corregido: ahora usa `app.vet.firstName/lastName` reales.
2. **Filtro de veterinario del calendario** usaba una lista hardcodeada de 2 vets falsos (`v1`/`v2`). Corregido: carga el staff real de la clínica.
3. **Onboarding con fallback de "éxito falso"**: si fallaba el guardado de la configuración inicial, igual mostraba "¡Clínica Lista para Operar!" como si hubiera funcionado. Corregido: ahora muestra el error real y no avanza.
4. **Onboarding descartaba silenciosamente los datos del Paso 2 (sede) y Paso 3 (veterinario adicional)** — se pedían en el formulario pero nunca se enviaban al backend. Corregido: ahora crea la sede y el veterinario adicional de verdad (con la contraseña autogenerada + correo de credenciales).
5. **Botón de "Finalizar" del onboarding estaba bloqueado** a menos que llenaras el veterinario adicional, contradiciendo el propio texto que decía que era opcional. Corregido.
6. **Portal de Tutores — el "enlace mágico" nunca llegaba a nadie**: se generaba el token pero no existía ningún canal de envío real (ni SMS, ni WhatsApp, ni correo). Corregido: ahora se envía por correo electrónico real (reusando el SMTP que ya funciona) si el tutor tiene correo registrado; si no, se le informa honestamente en vez de fingir éxito.
7. **Portal de Tutores exponía en producción, sin ningún guard, botones de "acceso demo" con el nombre y teléfono reales de una persona** (`Daniel Flórez`, `María Rodríguez`, `Diana Pérez`) directamente en el bundle del frontend. Eliminado por completo.
8. **Textos de marketing de la landing corregidos**: ya no prometen envío del portal "por WhatsApp" (ahora sí es correo, y es verdad), y la respuesta de FAQ que decía textualmente "despachador simulado" fue reescrita para no admitir eso al cliente.
9. **Precios inventados eliminados de la landing** (`$189.000` / `$299.000` COP/mes) — reemplazados por "Cotización Personalizada", ya que cada clínica/independiente define sus propios precios de atención, no la plataforma.
10. **Catálogo de servicios de facturación era fijo y compartido por toda la plataforma** (`Consulta General = $75.000` igual para cualquier clínica) — cualquier clínica que usara "Plantillas de Servicios" facturaba con precios inventados que no eran los suyos. Corregido: nueva tabla `service_catalogs` por clínica, con CRUD real y gestión inline desde la propia factura.
11. **Notificaciones (Centro + Plantillas) eran 100% simuladas** — sin backend, con un botón "Probar" que fabricaba una confirmación falsa de envío por WhatsApp usando el nombre/teléfono real del admin logueado. Ocultado del menú.
12. **"Crear tutor nuevo" desde el formulario de paciente nunca funcionaba** — generaba un ID falso en el navegador que el backend siempre rechazaba. Corregido: ahora llama al endpoint real `POST /tutors` antes de crear el paciente.
13. **Flujo de "mascota nueva" al agendar cita** (pedido explícitamente por el usuario) — implementado extremo a extremo: preguntar si es mascota nueva, capturar datos mínimos del tutor, y completar el registro formal cuando el vet inicia la atención.
14. **Endpoint de completar perfil / registro de clínica** ahora usan selects reales de Departamento/Municipio de Colombia (33 departamentos, 1120 municipios, datos DANE) en vez de texto libre.
15. **Creación de usuarios por el admin**: se quitó el campo manual de "Contraseña Inicial" — el sistema genera una contraseña temporal segura y la envía por correo; solo se muestra en pantalla si el correo falla.
16. **Hardening de auth**: normalización de email (mayúsculas/minúsculas) en el registro; `authMiddleware` ahora rechaza explícitamente tokens de super-admin de plataforma o de tutor que intenten usarse en rutas de clínica.
17. **Foto de mascota "simulada"** (asignaba una foto de stock aleatoria de Unsplash, sin upload real) — eliminada del formulario hasta que exista subida de archivos real.
18. **Dashboard**: si fallaba la carga de KPIs o de citas del día (ej. sesión de un tenant ya borrado), quedaban en pantalla los últimos números cacheados de una sesión anterior. Corregido para resetear a vacío.
19. **Factura nueva no era responsiva** en celular (tabla con anchos fijos en píxeles). Corregida con vista de tarjetas apiladas bajo 640px.

---

## Estado por módulo

### Núcleo Clínico

| Módulo | Estado | Notas |
|---|---|---|
| Pacientes | ✅ LISTO | CRUD completo, bien scoped por clínica, anti-IDOR verificado. |
| Tutores | 🟡 LISTO CON OBSERVACIÓN | Backend de edición agregado hoy (`GET/PATCH /tutors/:id`), pero **no existe página de "Tutores" en el staff app** — solo se crean inline desde el formulario de paciente. Si el día 1 alguien necesita corregir un teléfono mal escrito, hoy no hay dónde hacerlo desde la UI. Backlog cercano. |
| Citas (Appointments) | ✅ LISTO | Corregidos hoy: nombre de vet hardcodeado, filtro de vet del calendario, flujo de mascota nueva. Gaps de bajo riesgo (no explotables hoy): `PUT /appointments/:id` y `PATCH /appointments/:id/cancel` no existen en el backend, pero ningún botón de la UI los llama todavía — solo cuidado si alguien conecta un botón de "editar/cancelar cita" más adelante. |
| Historias Clínicas / Bitácora IA | ✅ LISTO | Transcripción real (Whisper/Claude) con fallback honesto a motor de reglas local si no hay API key configurada. Sin datos falsos. |
| Hospitalización / Kardex | ✅ LISTO | Diseño de solo-inserción (auditoría clínica), bien scoped. |
| Laboratorio | ✅ LISTO | Catálogo, órdenes y resultados bien conectados. |

### Negocio / Operaciones

| Módulo | Estado | Notas |
|---|---|---|
| Facturación | ✅ LISTO | Matemática de totales consistente, transacción atómica con inventario. Corregido hoy: catálogo de servicios ahora es por clínica (antes precios fijos de plataforma) y el formulario es responsive. Pendiente menor: anular una factura no revierte el movimiento de inventario (backlog, no bloqueante). |
| DIAN (Facturación Electrónica) | ⛔ OCULTADO | El código es honesto (solo marca "validada" si un Proveedor Tecnológico Autorizado confirma la transmisión real; si no, mostraba "CUFE DE PRUEBA — NO VALIDADO"), pero a pedido se ocultó el botón "Emitir Factura DIAN" y las insignias/sello fiscal en la factura (flag `dianEnabled = false` en `billing-receipt.component.ts`) hasta configurar un proveedor real. **Para reactivarlo:** configurar `DIAN_PROVIDER_URL`/`DIAN_PROVIDER_API_KEY` con un proveedor autorizado (Alegra/Siigo/Facture) y cambiar `dianEnabled` a `true`. |
| Caja / Cierre de Turno | 🟡 NEEDS FIX (backlog) | El cierre de caja no separa efectivo de tarjeta/transferencia (todo se suma como "cashSales"), y no filtra por sede — en una clínica multi-sede el arqueo de una sede mezcla las demás. El arqueo físico de efectivo no va a cuadrar si hubo pagos no-efectivo. Recomendado corregir antes de depender de este número para el cierre diario. |
| Inventario | ✅ LISTO | CRUD completo, SQL parametrizado. Código muerto sin riesgo: métodos de órdenes de compra en el frontend sin endpoint backend (no alcanzable desde ninguna pantalla). |
| CRM / Reactivación | ✅ LISTO | WhatsApp real con fallback honesto a enlaces `wa.me`. Nota: el backend tiene un bug de lógica en las cohortes de "cumpleaños"/"desparasitación" (siempre usan la cohorte de vacunas), pero **el frontend nunca ofrece esas dos opciones** — no es alcanzable por ningún usuario hoy. Cifras de "ingreso potencial recuperable" son una estimación genérica fija, no un cálculo real — aclarar en la UI en el futuro. |
| Peluquería (Grooming) | ✅ LISTO | Backend limpio, WhatsApp vía enlace manual (correcto, no finge auto-envío). |
| Paseadores / On-Demand | ✅ LISTO | Backend limpio y bien scoped. |
| Notificaciones (Centro + Plantillas) | ⛔ OCULTADO | 100% simulado, sin backend real (el propio código los marcaba como "Mock para desarrollo"). El botón de "Probar" fabricaba una confirmación falsa de envío. Removido del menú y de las rutas hoy. |

### Plataforma / Autenticación / Portal

| Módulo | Estado | Notas |
|---|---|---|
| Auth (login/registro/completar perfil) | ✅ LISTO | Verificado extremo a extremo hoy: municipio real validado contra la BD, transacciones atómicas, contraseñas autogeneradas. Hardening agregado: normalización de email, rechazo explícito de tokens de otros dominios de auth. |
| Super-Admin de Plataforma | ✅ LISTO | Aislamiento verificado en ambas direcciones (un token de plataforma no puede colarse en rutas de clínica y viceversa). Estadísticas agregadas son reales (`prisma.count()`), no inventadas. |
| Portal de Tutores | ✅ CORREGIDO HOY | El enlace mágico ahora se envía de verdad por correo. Se eliminaron los botones de "demo" con datos de una persona real expuestos sin condición en producción. |
| Onboarding | ✅ CORREGIDO HOY | Ya no finge éxito si falla, y ya no descarta los datos de sede/veterinario adicional que el propio formulario pedía. |
| Consentimientos Digitales | ✅ LISTO | Enlace público con token UUID no adivinable, valida expiración y evita refirmar. |
| Reportes | ✅ LISTO | Sin datos simulados, bien scoped por clínica. |
| Sedes (Branches) | ✅ LISTO | CRUD básico correcto. |
| Docs (Swagger) | 🟡 BAJA PRIORIDAD | URL de servidor hardcodeada a localhost (el botón "Try it out" no funcionaría en producción) y solo documenta ~5 de ~20 grupos de rutas. No está enlazado desde ningún lado del frontend — riesgo bajo de que un cliente real lo encuentre, pero conviene corregir o quitar del despliegue de producción cuando haya tiempo. |

---

## Pendientes recomendados

1. ✅ **Hecho** — Página de "Tutores" (listado + edición) en el staff app.
2. 🔲 Separar métodos de pago en el cierre de caja (efectivo vs. tarjeta vs. transferencia) y filtrar por sede.
3. 🔲 Configurar un Proveedor Tecnológico Autorizado real para reactivar DIAN (acción de negocio — necesita decisión/credenciales tuyas).
4. ✅ **Hecho** — Anular una factura ahora revierte el movimiento de inventario.
5. ✅ **Hecho** — Cohorte de "cumpleaños" del CRM implementada con datos reales; "desparasitación" retirada del enum (no explotable, sin datos para calcularla).
6. ✅ **Hecho** — URL de Swagger corregida a relativa.
7. 🔲 Subida de fotos real (mascotas) — necesita decidir infraestructura (volumen local vs. S3/R2).
