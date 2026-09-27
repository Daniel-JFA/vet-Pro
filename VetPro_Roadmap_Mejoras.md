# VetPro — Propuesta de mejoras (Roadmap v3)

**Fecha:** 26 de septiembre de 2026
**Base:** `VetPro_Plan_Maestro.md` (sprints 0–13), `PRE_LAUNCH_AUDIT.md`, revisión directa del código en esta fecha, portafolios de precios de Doru (Colombia 2026) y las lecciones de la propuesta Compasión 360 (alcance cerrado, criterios de aceptación, XML DIAN, habeas data, integración contable).
**Cadencia:** sprints de 2 semanas · 1 dev fullstack · ~8 días efectivos por sprint.
**Documento hermano:** `Propios/Propuestas/VetPro_Propuesta_Comercial.md` (la propuesta que se le entrega al veterinario o la clínica).

---

## 1. Resumen

El Plan Maestro cierra en "100 % completado". El núcleo clínico y operativo sí está sólido: historias con IA por voz, agenda, facturación con caja, inventario, hospitalización, consentimientos firmados, portal del tutor, directorio público de veterinarios con verificación COMVEZCOL, pagos Wompi y 102 tests.

Pero la revisión del código de hoy encontró **cuatro problemas que impiden cobrarle a un cliente con tranquilidad**:

1. **Se puede activar un plan sin pagar**, por tres caminos distintos (sección 2.1).
2. **La IA clínica llama a un modelo que Anthropic ya retiró** (`claude-3-5-sonnet-20241022`). La Bitácora IA está funcionando con el respaldo (GPT-4o-mini o el motor local de reglas), no con el motor que se vende.
3. **Una suscripción o prueba vencida no bloquea nada**: la clínica sigue usando todo sin pagar, y el "cobro recurrente" en realidad depende de que el cliente pague a mano cada periodo.
4. **Los planes solo limitan los minutos de IA.** Usuarios y sedes son ilimitados en todos los planes, así que el plan Enterprise no ofrece nada que el Starter no tenga, fuera de los minutos.

Nada de esto es grave de corregir: cabe en **un sprint (Sprint 14)**. Pero debe estar cerrado **antes** de enviar la primera propuesta comercial con precios.

Después vienen tres sprints que convierten lo aprendido en Compasión 360 en ventaja comercial: **lectura del XML DIAN de las facturas de compra** (inventario sin digitar), **exportación contable para el contador de la clínica**, **DIAN real con proveedor** y un **panel de impacto** que le demuestra al cliente cuánto tiempo le ahorra VetPro.

---

## 2. Estado real verificado (26-sep-2026)

### 2.1 Hallazgos críticos

| # | Hallazgo | Dónde | Impacto |
|---|---|---|---|
| C1 | `POST /subscriptions/simulate-approval/:reference` no tiene ningún bloqueo de entorno, y hay un botón en la UI que lo llama | `vetpro-backend/src/routes/subscription.routes.ts:295` · `subscription-management.component.html:217` | Cualquier admin de clínica activa Enterprise gratis en producción |
| C2 | `POST /marketplace/payments/mock-simulate` **no pide autenticación** | `vetpro-backend/src/routes/marketplace.routes.ts:520` | Cualquier persona en internet puede marcar como aprobado un pago del marketplace si conoce o adivina la referencia |
| C3 | `POST /marketplace/profile/subscription` con `instantActivate: true` activa Pro Vet sin pasar por Wompi | `marketplace.routes.ts:764` | Pro Vet ($49.000/mes) gratis para cualquiera |
| C4 | Modelo `claude-3-5-sonnet-20241022` retirado | `vetpro-backend/src/services/ai.service.ts:81` | El diferenciador principal funciona con el motor de respaldo; nadie se entera porque el respaldo es silencioso |
| C5 | Ningún middleware revisa `subscriptionStatus` ni `trialEndsAt` | Backend completo | Una prueba de 14 días dura para siempre |
| C6 | Límites por plan: solo `aiMinutesLimit` se aplica | `medical-record.routes.ts:165` | Usuarios y sedes ilimitados en todos los planes |
| C7 | El mensaje de límite de IA dice "Recargue una bolsa de minutos", pero no existe la compra de bolsas | `medical-record.routes.ts:167` | El cliente queda bloqueado sin salida |
| C8 | Los backups diarios quedan **en el mismo servidor** (decisión 7.2 del Plan Maestro) | `backup-local.sh` | Si el servidor se pierde, se pierden también los respaldos |

### 2.2 Lo que está listo para vender

| Área | Estado |
|---|---|
| Historia clínica, Bitácora IA por voz (Whisper) y estructuración SOAP | ✅ Funciona (con la salvedad de C4) |
| Agenda, Kanban de citas y cita → historia → factura en 1 clic | ✅ |
| Facturación, abonos, caja por turno y por medio de pago, anulación con reversa de inventario | ✅ |
| Inventario, laboratorio, hospitalización/Kardex, peluquería y spa, paseadores/domicilio | ✅ |
| Consentimientos con firma digital por enlace | ✅ |
| Portal del tutor (enlace mágico por correo) y PWA instalable | ✅ |
| CRM, recordatorios de citas y vacunas por WhatsApp (API de Meta o enlace de 1 clic) | ✅ El envío se dispara a mano; no hay programación automática |
| Importador de pacientes y tutores desde Excel/CSV | ✅ |
| Directorio público de veterinarios, verificación COMVEZCOL, agenda web y reseñas | ✅ |
| Pagos Wompi (marketplace y suscripciones) con firma de integridad | ✅ Una vez cerrados C1–C3 |
| Recuperación de contraseña por correo | ✅ En la rama `feat/forgot-password`, pendiente de merge |
| Facturación electrónica DIAN | 🟡 El código y la UI existen, pero **no hay proveedor tecnológico conectado**. Sin proveedor, el CUFE es de prueba y no tiene validez fiscal |
| Seguridad base, multi-tenant, OWASP, Sentry, logs, CI con tests y E2E | ✅ |

---

## 3. Mercado y precios

### 3.1 Referencia: Doru (Colombia, 2026)

Doru vende **agenda, historia clínica, adjuntos, firma de documentos, notificaciones e IA por minutos**. No tiene facturación con caja, inventario, hospitalización, laboratorio, CRM, portal del tutor ni directorio público. Cobra el año como **10 meses** (2 meses gratis) y ofrece **10 % de descuento por un año por referido**.

| Minutos de IA | Doru Vet (independiente) | Doru Clínica |
|---:|---:|---:|
| 100 | $78.000 | $92.000 |
| 200 | $92.000 | $108.000 |
| 500 | $135.000 | $150.000 |
| 1.500 | $280.000 | $290.000 |

### 3.2 VetPro hoy (lo que cobra el código)

| Plan | Mensual | Minutos IA | Usuarios / sedes |
|---|---:|---:|---|
| Starter | $80.000 | 60 | Ilimitados (C6) |
| Pro / Clínica | $150.000 | 300 | Ilimitados |
| Enterprise | $300.000 | 9.999 | Ilimitados |

**Problema:** frente a Doru, el plan de entrada de VetPro cuesta más y trae menos IA (60 minutos contra 100). El veterinario independiente compara primero los minutos, porque es lo que Doru le enseñó a comparar. Además, el descuento anual (15 %) es menor que el de Doru (2 meses gratis ≈ 16,7 %).

### 3.3 Propuesta de planes

Dos líneas, como Doru, pero compitiendo por **producto completo** y no por precio:

| Plan | Para quién | Mensual | Anual (10 meses) | Minutos IA | Usuarios | Sedes |
|---|---|---:|---:|---:|---:|---:|
| **Vet Esencial** | Independiente que empieza | $79.000 | $790.000 | 200 | 1 | — |
| **Vet Pro** | Independiente consolidado o a domicilio | $139.000 | $1.390.000 | 500 | 2 (vet + auxiliar) | — |
| **Clínica** | Clínica de 1 sede | $169.000 | $1.690.000 | 600 | 6 | 1 |
| **Clínica Multisede** | Clínica o red | $319.000 | $3.190.000 | 1.800 | 15 | 3 |

- **Recarga de IA:** bolsa de 100 minutos por $19.000, sin vencimiento dentro del periodo pagado.
- **Adicionales:** usuario extra $15.000/mes; sede extra (solo Multisede) $60.000/mes.
- **Pro Vet** (destacado en el directorio, hoy $49.000 aparte) **va incluido en Vet Pro**. Es el ancla de valor para el independiente.
- **Implementación asistida** para clínicas (migración, catálogo y capacitación): $350.000 por única vez; **gratis con pago anual**.
- **Comisión del marketplace:** se mantiene el 15 %.

**Por qué funciona:**

- Vet Esencial cuesta lo mismo que el plan más barato de Doru y trae el doble de minutos.
- En clínicas, VetPro cuesta algo más que Doru, pero incluye facturación, caja, inventario, hospitalización y portal del tutor, que Doru no tiene. Se sostiene el posicionamiento premium frente a OkVet sin regalar el producto.
- Margen de IA: Whisper cuesta USD 0,006 por minuto, así que 1.800 minutos son unos USD 11 más la estructuración SOAP. Cabe con holgura en $319.000.

> Los precios son una propuesta para validar con 3–5 clientes antes de publicarlos. Cambiarlos en el código es la historia 14.5.

---

## 4. Plan de sprints

### Sprint 14 — Blindaje comercial (P0, antes de vender)

**Meta:** que no se pueda usar VetPro sin pagar, que la IA que se vende sea la que funciona y que los planes signifiquen algo.

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 14.1 | **Cerrar los tres atajos de pago (C1–C3).** `simulate-approval`, `mock-simulate` e `instantActivate` solo existen si `NODE_ENV !== 'production'` y `ENABLE_PAYMENT_SIMULATION=true`; `mock-simulate` además exige token de plataforma. El botón de simulación se oculta en el build de producción. | 0,5 | En producción las tres rutas responden 404; tests de integración para cada una; el botón no aparece en el bundle de producción |
| 14.2 | **IA vigente y vigilada (C4).** Pasar la estructuración SOAP a un modelo vigente (Claude Sonnet 5 o Haiku 4.5 según costo), con el ID en `config/env.ts`. Alerta a Sentry cada vez que responda el motor de respaldo, y mostrar al veterinario qué motor generó la nota. | 1 | Una prueba de humo diaria genera una nota SOAP con `engineSource = 'claude'`; si cae al respaldo, llega una alerta |
| 14.3 | **Vencimiento de suscripción (C5).** Middleware que, pasados 5 días de gracia, deja la clínica **en solo lectura**: puede consultar y exportar, pero no crear. Aviso por correo 7 días y 1 día antes del vencimiento. | 2 | Una clínica con la prueba vencida hace 6 días recibe 402 al crear una cita y puede seguir viendo historias |
| 14.4 | **Límites por plan y adicionales (C6, C7).** Aplicar el máximo de usuarios y sedes al crearlos; compra por Wompi de bolsas de 100 minutos, usuario adicional ($15.000/mes) y sede adicional ($60.000/mes). | 2 | Crear el usuario 7 en el plan Clínica devuelve un mensaje claro de mejora de plan; comprar una bolsa suma 100 minutos al aprobarse el pago |
| 14.5 | **Reempaque de planes** (sección 3.3): cuatro planes, anual = 10 meses, Pro Vet incluido en Vet Pro. | 1 | `PLAN_PRICING` y la pantalla `/suscripcion` muestran los cuatro planes; los tests de suscripción pasan |
| 14.6 | **Copia externa de respaldo (C8).** Replicar el `pg_dump` diario y el volumen `vetpro_uploads`, cifrados, a un segundo destino fuera del servidor (otro VPS o un disco fuera de línea); probar la restauración desde ese destino. | 1 | Restauración completa probada desde la copia externa y documentada en `PRODUCCION_RUNBOOK.txt` |
| 14.7 | **Merge de la recuperación de contraseña** (rama `feat/forgot-password`) y despliegue. | 0,5 | El flujo funciona en producción con SMTP real |

**Total: 8 días.**

**En paralelo, sin código (tú):**

- **Términos y condiciones del servicio**: suscripción, renovación, solo lectura por mora, cancelación, propiedad y exportación de datos.
- **Acuerdo de transmisión de datos personales** (Ley 1581): la clínica es *responsable* y VetPro es *encargado*. Va como anexo de la propuesta comercial.
- **Decidir el proveedor DIAN** (Alegra o Siigo) para el Sprint 16. El trámite de habilitación tarda; hay que empezarlo ya.

---

### Sprint 15 — Compras e integración contable (lo aprendido en Compasión 360)

**Meta:** que la clínica deje de digitar las facturas de sus proveedores y que su contador reciba la información lista.

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 15.1 | **Factura de compra por XML DIAN.** La clínica carga el ZIP que le envía el proveedor (distribuidora de medicamentos, laboratorio); VetPro lee el *AttachedDocument*, detecta CUFE duplicado, crea el proveedor si no existe y propone la **entrada de inventario** con cantidades y costos. El usuario confirma el cruce ítem por ítem y completa lote y vencimiento, que el XML no suele traer. | 3,5 | Con 10 facturas reales de distribuidoras veterinarias, los ítems y costos se extraen sin error y el inventario sube al confirmar |
| 15.2 | **Exportación contable por archivo** para Siigo o Alegra: ventas, recaudos por medio de pago y compras, con mapeo configurable al PUC y bitácora de lo exportado. | 3 | Un periodo exportado se importa en Siigo sin rechazo; volver a exportar no duplica |
| 15.3 | **Rentabilidad por servicio:** costo de insumos consumidos frente a precio cobrado, por servicio y por mes. | 1,5 | El reporte muestra el margen de las 10 prestaciones más frecuentes |

**Total: 8 días.** Es el argumento que Doru no puede igualar: *"además de las historias, VetPro le quita la digitación de compras y le entrega la contabilidad al contador"*.

---

### Sprint 16 — DIAN real y valor visible

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 16.1 | **Proveedor tecnológico DIAN conectado** (el elegido en el Sprint 14): emisión real, notas crédito y documento soporte en adquisiciones. | 4 | Una factura de prueba en habilitación es aceptada por la DIAN a través del proveedor; la nota crédito anula correctamente |
| 16.2 | **Panel "Impacto VetPro"** para el cliente: horas ahorradas por la IA (minutos dictados frente a tiempo típico de digitación), consultas documentadas, inasistencias evitadas por recordatorios e ingresos recuperados por el CRM. | 2 | El panel muestra datos reales del mes y se envía resumido por correo el día 1 |
| 16.3 | **Exportación completa de datos del cliente:** un ZIP con CSV por entidad y los PDF de historias y consentimientos. | 2 | La exportación de una clínica de prueba se reimporta sin pérdida en una base limpia |

**Total: 8 días.** El panel de impacto aplica la sección "Resultados esperados" de Compasión: medir línea base y resultado es lo que retiene al cliente en el mes 3.

---

### Sprint 17 — Crecimiento

| # | Historia | Días | Criterio de aceptación |
|---|---|---|---|
| 17.1 | **Referidos:** un mes gratis para quien refiere y para el referido, al primer pago del referido. | 2 | El código de referido aplica el mes gratis automáticamente |
| 17.2 | **Recordatorios automáticos programados** (hoy se disparan a mano): tarea diaria por clínica con horario configurable. | 2 | Sin intervención humana, los recordatorios de mañana salen a la hora configurada |
| 17.3 | **Migración asistida desde OkVet y Doru:** plantillas de mapeo de sus exportaciones a la importación de VetPro. | 2 | Una exportación real de cada competidor se importa con reporte de filas |
| 17.4 | **Marca de la clínica** en el portal del tutor, las facturas, los consentimientos y los correos (el logo ya existe en facturación y consentimientos). | 1 | El tutor ve el logo de la clínica en todo su recorrido |
| 17.5 | **Activación guiada:** checklist de los primeros 7 días (primera cita, primera historia con IA, primera factura, primer recordatorio) con avisos a quien se quede atascado. | 1 | El panel de plataforma muestra en qué paso está cada clínica nueva |

**Total: 8 días.**

---

## 5. Orden recomendado y fechas

| Sprint | Contenido | Inicio sugerido | Fin |
|---|---|---|---|
| 14 | Blindaje comercial | 28-sep-2026 | 9-oct-2026 |
| 15 | Compras por XML + exportación contable | 12-oct-2026 | 23-oct-2026 |
| 16 | DIAN real + impacto + exportación de datos | 26-oct-2026 | 6-nov-2026 |
| 17 | Crecimiento | 9-nov-2026 | 20-nov-2026 |

**Regla de venta:** la propuesta comercial se puede enviar al terminar el Sprint 14. Lo de los sprints 15–17 se ofrece como **"en camino"** con fecha, nunca como disponible hasta que esté en producción.

---

## 6. Métricas de éxito

- 0 rutas que activen un plan sin un pago aprobado por Wompi, verificado con tests.
- 100 % de las notas SOAP del mes generadas con el motor principal, o con alerta cuando no.
- 0 clínicas activas con prueba o suscripción vencida hace más de 5 días.
- Restauración probada desde la copia externa, una vez al mes.
- Activación: 70 % de las clínicas nuevas con primera historia IA **y** primera factura en sus primeros 7 días.
- Conversión de prueba a pago ≥ 30 %; abandono mensual < 5 %.

---

## 7. Qué se toma de la propuesta Compasión 360

| Práctica | Dónde se aplica en VetPro |
|---|---|
| Alcance escrito en dos listas: incluido y excluido | Propuesta comercial, secciones 4 y 6 |
| Criterios de aceptación verificables | La implementación asistida tiene su propio criterio (propuesta comercial, sección 7) |
| XML DIAN en lugar de OCR | Historia 15.1 (compras) |
| Exportación contable por archivo, API como evolución | Historia 15.2 |
| Habeas data con roles responsable/encargado | Anexo de transmisión de datos + propuesta comercial, sección 9 |
| Línea base e indicadores de éxito | Historia 16.2 |
| Compromisos del cliente con efecto sobre el plazo | Propuesta comercial, sección 8 |
| Costos de terceros explícitos (WhatsApp de Meta, proveedor DIAN) | Propuesta comercial, sección 11 |
| No regalar la tarifa sin dejar registro de que es una concesión | Implementación "gratis con pago anual", no "gratis" |
