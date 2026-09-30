/**
 * E2E contra el backend REAL (sin mocks de la API).
 *
 * El 2026-09-30 una clínica reportó que no podía registrar mascotas: el botón
 * "Guardar Expediente" nunca llegaba al servidor y, aunque llegara, el backend
 * rechazaba la fecha de nacimiento. Las pruebas de e2e.spec.ts simulan la API,
 * así que no lo detectaron. Este archivo recorre los flujos de alta de una
 * clínica nueva de punta a punta y falla si un formulario no envía nada al
 * backend o si el backend lo rechaza.
 *
 * Ejecutar con el stack levantado (frontend + backend + base de datos vacía):
 *   E2E_REAL=1 PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test e2e/real-backend.spec.ts --project=chromium
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';

test.skip(!process.env['E2E_REAL'], 'Requiere un backend real: define E2E_REAL=1 y PLAYWRIGHT_BASE_URL');
test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const admin = {
  email: `e2e_${stamp}@vetpro.test`,
  password: 'Prueba123!segura',
};

let page: Page;
let invoiceId: string;
let consentId: string;
const pageErrors: string[] = [];
const failedApiCalls: string[] = [];

async function registerClinic(request: APIRequestContext) {
  const res = await request.post('/api/v1/auth/register', {
    data: {
      clinicName: `Clínica E2E ${stamp}`,
      businessType: 'clinic',
      firstName: 'Ana',
      lastName: 'Prueba',
      email: admin.email,
      password: admin.password,
      phone: '3001234567',
      municipioId: '05001',
      nit: '900123456-7',
      documentType: 'CC',
      documentNumber: `10${String(stamp).slice(-8)}`,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** Espera la respuesta de la API que dispara `action` y comprueba su código. */
async function expectApi(method: string, urlPart: string, action: () => Promise<unknown>, status = [200, 201]) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && r.url().includes(urlPart), { timeout: 10_000 }),
    action(),
  ]);
  expect(status, `${method} ${urlPart} → ${res.status()} ${await res.text().catch(() => '')}`).toContain(res.status());
  return res.json().catch(() => null);
}

test.beforeAll(async ({ browser, request }) => {
  await registerClinic(request);
  page = await browser.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('dialog', (d) => d.accept());
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400 && r.status() !== 401) {
      failedApiCalls.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`);
    }
  });
});

test.afterAll(async () => {
  await page?.close();
});

test.afterEach(async () => {
  // Ninguna llamada a la API debe fallar y el navegador no debe lanzar errores de JS
  expect(failedApiCalls, 'llamadas a la API con error').toEqual([]);
  expect(pageErrors, 'errores de JavaScript en la página').toEqual([]);
});

test('inicia sesión y completa el onboarding', async () => {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/onboarding/);

  // Paso 1: empresa
  await page.locator('input[placeholder="Ej: 900.123.456-7"]').fill('900123456-7');
  await page.locator('input[type="tel"]').fill('3001234567');
  const selects = page.locator('select');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/geo/municipios')),
    selects.nth(0).selectOption({ index: 1 }),
  ]);
  await expect(selects.nth(1).locator('option').nth(1)).toBeAttached();
  await selects.nth(1).selectOption({ index: 1 });
  await page.getByRole('button', { name: /Siguiente Paso/ }).click();

  // Paso 2: sede
  await page.getByPlaceholder('Ej: Sede Principal Norte').fill('Sede Centro');
  await page.locator('input[type="text"]:visible').last().fill('Calle 10 # 20-30');
  await page.getByRole('button', { name: /Siguiente Paso/ }).click();

  // Paso 3: sin veterinario adicional
  await expectApi('PATCH', '/api/v1/auth/clinic', () => page.getByRole('button', { name: /Finalizar Configuración/ }).click(), [200]);
  await page.getByRole('button', { name: /Comenzar a usar VetPro/ }).click();
  await page.waitForURL(/dashboard|complete-profile/);
});

test('el onboarding no se repite en otro navegador', async ({ browser }) => {
  const other = await browser.newPage();
  await other.goto('/auth/login');
  await other.locator('input[type="email"]').fill(admin.email);
  await other.locator('input[type="password"]').fill(admin.password);
  await other.locator('button[type="submit"]').click();
  await other.waitForURL(/dashboard|complete-profile|verify-card|onboarding/);
  expect(other.url()).not.toContain('onboarding');
  await other.close();
});

test('registra tutor nuevo + mascota desde "Nuevo paciente"', async () => {
  await page.goto('/patients/new');
  // Clínica sin tutores: el formulario abre directo en "Nuevo tutor"
  await page.locator('input[formControlName="name"]').first().fill('Toby');
  await page.locator('input[type="date"][formControlName="birthDate"]').fill('2024-05-01');
  const tutor = page.locator('.tutor-new-container');
  await tutor.locator('input[formControlName="firstName"]').fill('Laura');
  await tutor.locator('input[formControlName="lastName"]').fill('Gómez');
  await tutor.locator('input[formControlName="phone"]').fill('3005556677');

  const saveBtn = page.getByRole('button', { name: /Guardar Expediente/ });
  const [tutorRes] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/v1/tutors')),
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/v1/patients')),
    saveBtn.click(),
  ]);
  expect(tutorRes.status()).toBe(201);
  await expect(page.getByText('Paciente registrado exitosamente.')).toBeVisible();
});

test('abre la ficha de la mascota con historial y vacunas', async () => {
  await page.goto('/patients');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/vaccines') && r.status() === 200),
    page.waitForResponse((r) => r.url().includes('/medical-records/patient/') && r.status() === 200),
    page.getByText('Toby').first().click(),
  ]);
  await expect(page.getByText(/No se pudo cargar/)).toHaveCount(0);
});

test('registra una segunda mascota con tutor existente', async () => {
  await page.goto('/patients/new');
  await page.locator('select[formControlName="tutorId"]').selectOption({ index: 1 });
  await page.locator('input[formControlName="name"]').first().fill('Luna');
  await page.locator('select[formControlName="species"]').selectOption('cat');
  await expectApi('POST', '/api/v1/patients', () => page.getByRole('button', { name: /Guardar Expediente/ }).click(), [201]);
});

test('crea un usuario del equipo', async () => {
  await page.goto('/users');
  await page.locator('.btn-primary').filter({ hasText: /Nuevo|Agregar|Usuario/ }).first().click();
  const modal = page.locator('.modal-body');
  await modal.locator('input[placeholder="Ej: Santiago"]').fill('Carlos');
  await modal.locator('input[placeholder="Ej: Gómez"]').fill('Veterinario');
  await modal.locator('input[type="email"]').fill(`vet_${stamp}@vetpro.test`);
  await expectApi('POST', '/api/v1/auth/users', () => page.getByRole('button', { name: 'Crear Usuario' }).click(), [201]);
});

test('agenda una cita y la edita', async () => {
  await page.goto('/appointments/new');
  await page.locator('select[formControlName="patientId"]').selectOption({ index: 1 });
  await page.locator('select[formControlName="vetId"]').selectOption({ index: 1 });
  await page.locator('input[formControlName="date"]').fill('2026-12-15');
  await page.locator('select[formControlName="time"]').selectOption('10:30');
  const created = await expectApi('POST', '/api/v1/appointments', () => page.locator('button[type="submit"]').click(), [201]);

  await page.goto(`/appointments/${created.id}/edit`);
  await expect(page.locator('input[formControlName="date"]')).toHaveValue('2026-12-15');
  await page.locator('select[formControlName="time"]').selectOption('11:00');
  await expectApi('PUT', `/api/v1/appointments/${created.id}`, () => page.locator('button[type="submit"]').click(), [200]);
});

test('crea un producto de inventario', async () => {
  await page.goto('/inventory/new');
  await page.locator('input[formControlName="sku"]').fill(`SKU-${stamp}`);
  await page.locator('input[formControlName="name"]').fill('Amoxicilina 500mg');
  await page.locator('.tab', { hasText: 'Precios' }).click();
  await page.locator('input[formControlName="costPrice"]').fill('1000');
  await page.locator('input[formControlName="salePrice"]').fill('2500');
  await page.locator('.tab', { hasText: 'Stock' }).click();
  await page.locator('input[formControlName="currentStock"]').fill('20');
  await expectApi('POST', '/api/v1/inventory/products', () => page.locator('button[type="submit"]').click(), [201]);
});

test('emite una factura al tutor', async () => {
  await page.goto('/billing/new');
  await page.locator('select[name="tutorId"]').selectOption({ index: 1 });
  const row = page.locator('.items-table tbody tr').first();
  await row.locator('input').nth(0).fill('Consulta General');
  await row.locator('input').nth(2).fill('50000');
  const invoice = await expectApi('POST', '/api/v1/billing/invoices', () => page.locator('button[type="submit"]').click(), [201]);
  invoiceId = invoice.id;
});

test('crea un consentimiento informado', async () => {
  await page.goto('/consent/new');
  await page.locator('select[name="patientId"]').selectOption({ index: 1 });
  await page.locator('input[name="tutorName"]').fill('Laura Gómez');
  const content = page.locator('textarea[name="documentContent"]');
  // El documento nombra a la clínica real, no "VetPro"
  await expect(content).toHaveValue(new RegExp(`Clínica E2E ${stamp}`));
  const consent = await expectApi('POST', '/api/v1/consent-forms', () => page.locator('button[type="submit"]').click(), [201]);
  consentId = consent.id;
});

test('registra una historia clínica manual', async () => {
  await page.goto('/patients');
  await page.getByText('Toby').first().click();
  await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
  const patientId = page.url().split('/').pop();
  await page.goto(`/medical-records/new/${patientId}`);
  await page.locator('input[placeholder^="Ej. Vacunación Anual"]').fill('Consulta general');
  await page.locator('textarea[placeholder^="Ingresa los antecedentes"]').fill('Tutor reporta decaimiento de 2 días.');
  await page.locator('textarea[placeholder^="Diagnóstico presuntivo"]').fill('Gastroenteritis leve');
  const record = await expectApi('POST', '/api/v1/medical-records', () =>
    page.getByRole('button', { name: 'Guardar en Expediente' }).first().click(), [201]);
  // Una historia escrita a mano no es "Bitácora de Voz"
  expect(record.aiGenerated).toBe(false);
});

test('hospitaliza, medica, registra evolución y da de alta', async () => {
  await page.goto('/hospitalization');
  await page.getByRole('button', { name: /Ingresar Paciente a Camas/ }).click();
  await page.locator('select[name="admitPatient"]').selectOption({ index: 1 });
  // Clínica sin jaulas: se crea una desde el mismo modal
  await page.locator('input[name="newBedCode"]').fill('J-01');
  await page.locator('input[name="newBedName"]').fill('Jaula perros');
  await expectApi('POST', '/api/v1/hospitalizations/beds', () => page.getByRole('button', { name: 'Crear jaula' }).click(), [201]);
  await page.locator('textarea[name="admitReason"]').fill('Deshidratación moderada');
  await page.locator('input[name="medDrug"]').fill('Maropitant');
  await page.locator('input[name="medDose"]').fill('1 mg/kg');
  await expectApi('POST', '/api/v1/hospitalizations/admit', () => page.getByRole('button', { name: 'Guardar' }).click(), [201]);

  const card = page.locator('.cage-card').first();
  await expect(card).toContainText('Deshidratación moderada');
  await expectApi('POST', '/doses/administer', () => card.getByRole('button', { name: /Administrar/ }).first().click(), [200, 201]);
  await expect(card.getByRole('button', { name: /Aplicada/ }).first()).toBeVisible();

  await card.getByRole('button', { name: /Medicamento/ }).click();
  await page.locator('input[name="medDrug"]').fill('Omeprazol');
  await page.locator('input[name="medDose"]').fill('1 mg/kg');
  await expectApi('POST', '/medications', () => page.getByRole('button', { name: 'Guardar' }).click(), [201]);

  await card.getByRole('button', { name: /Evolución/ }).click();
  await page.locator('textarea[name="evoNotes"]').fill('Paciente más alerta, tolera agua.');
  await expectApi('POST', '/evolutions', () => page.getByRole('button', { name: 'Guardar' }).click(), [201]);

  await card.getByRole('button', { name: /Dar de alta/ }).click();
  await page.locator('textarea[name="dischargeSummary"]').fill('Alta con tratamiento oral 5 días.');
  await expectApi('POST', '/discharge', () => page.getByRole('button', { name: 'Guardar' }).click(), [200, 201]);
  await expect(page.locator('.cage-card')).toHaveCount(0);

  // La jaula queda en limpieza y se puede volver a habilitar
  await page.getByRole('button', { name: /Ingresar Paciente a Camas/ }).click();
  await expectApi('PATCH', '/beds/', () => page.getByRole('button', { name: 'Marcar como lista' }).click(), [200]);
  await expect(page.locator('select[name="admitBed"] option', { hasText: 'J-01' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancelar' }).click();
});

test('crea una orden de laboratorio y registra resultados', async () => {
  await page.goto('/labs');
  await page.getByRole('button', { name: /Nueva Orden/ }).first().click();
  await page.locator('select[name="orderPatient"]').selectOption({ index: 1 });
  await page.locator('.test-option input[type="checkbox"]').first().check();
  await expectApi('POST', '/api/v1/labs/orders', () => page.getByRole('button', { name: 'Crear orden' }).click(), [201]);

  await page.locator('.btn-action').first().click();
  const inputs = page.locator('.results-table input');
  // Sin valor no se guarda (antes se inventaba "Normal")
  await page.getByRole('button', { name: /Guardar y Finalizar/ }).click();
  await expect(page.locator('.results-table')).toBeVisible();
  for (let i = 0; i < (await inputs.count()); i++) await inputs.nth(i).fill('14.5');
  await expectApi('PATCH', '/results', () => page.getByRole('button', { name: /Guardar y Finalizar/ }).click(), [200]);
});

test('registra un ingreso a peluquería', async () => {
  await page.goto('/grooming');
  await page.getByRole('button', { name: /Ingresar a Spa/ }).click();
  await page.locator('select[name="groomPatient"]').selectOption({ index: 1 });
  await expectApi('POST', '/api/v1/grooming', () => page.getByRole('button', { name: 'Registrar ingreso' }).click(), [201]);
});

test('edita la mascota y el tutor', async () => {
  await page.goto('/patients');
  await page.getByText('Toby').first().click();
  await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
  await page.goto(page.url() + '/edit');
  await page.locator('input[formControlName="weight"]').fill('12.5');
  await expectApi('PUT', '/api/v1/patients/', () => page.getByRole('button', { name: /Guardar Expediente/ }).click(), [200]);

  await page.goto('/tutors');
  await page.locator('button[title="Editar tutor"]').first().click();
  await page.locator('.modal-body input[type="email"], input[type="email"]').last().fill('laura@correo.co');
  await expectApi('PATCH', '/api/v1/tutors/', () => page.getByRole('button', { name: /Guardar/ }).last().click(), [200]);
});

test('emite y cobra la factura', async () => {
  await page.goto(`/billing/${invoiceId}`);
  await expect(page.getByText('FAC-', { exact: false }).first()).toBeVisible();
  // La factura muestra a la clínica como emisor, no datos fijos de "VETPRO SAS"
  await expect(page.locator('.sheet-header')).toContainText(`Clínica E2E ${stamp}`);
  await expect(page.locator('#print-area')).not.toContainText('900.123.456-1');
  const issued = page.getByRole('button', { name: /Formalizar y Emitir/ });
  if (await issued.isVisible()) {
    await expectApi('PATCH', '/issue', () => issued.click(), [200]);
  }
  await page.getByRole('button', { name: /Abonar \/ Pagar/ }).click();
  await expectApi('PATCH', '/pay', () => page.getByRole('button', { name: 'Confirmar Acreditación' }).click(), [200]);
});

test('el tutor firma el consentimiento (y no se acepta en blanco)', async () => {
  await page.goto(`/consent/sign/${consentId}`);
  const signBtn = page.getByRole('button', { name: /Enviar Firma Autorizada/ });
  await signBtn.click();
  await expect(page.getByText('Dibuja tu firma en el recuadro antes de firmar.')).toBeVisible();

  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 10 });
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expectApi('PATCH', '/sign', () => signBtn.click(), [200]);
});

test('exporta el reporte a Excel', async () => {
  await page.goto('/reports');
  await expectApi('GET', '/reports/export/excel', () => page.locator('.export-btn').click(), [200]);
});

test('edita una plantilla de WhatsApp', async () => {
  await page.goto('/notifications/templates');
  const body = page.locator('#template-body-textarea');
  await body.fill((await body.inputValue()) + ' ¡Te esperamos!');
  await expectApi('PUT', '/notifications/templates/', () => page.getByRole('button', { name: /Guardar/ }).first().click(), [200]);
});

test('registra un paseador', async () => {
  await page.goto('/users');
  await page.locator('.btn-primary').filter({ hasText: /Nuevo|Agregar|Usuario/ }).first().click();
  const modal = page.locator('.modal-body');
  await modal.locator('input[placeholder="Ej: Santiago"]').fill('Pedro');
  await modal.locator('input[placeholder="Ej: Gómez"]').fill('Paseador');
  await modal.locator('input[type="email"]').fill(`walker_${stamp}@vetpro.test`);
  await modal.locator('select.select-role').selectOption('walker');
  await expectApi('POST', '/api/v1/auth/users', () => page.getByRole('button', { name: 'Crear Usuario' }).click(), [201]);

  await page.goto('/walkers');
  await page.locator('.btn-primary').first().click();
  await page.locator('input[placeholder="paseador@vetpro.co"]').fill(`walker_${stamp}@vetpro.test`);
  await expectApi('POST', '/api/v1/walkers', () => page.locator('.modal .btn-primary').last().click(), [201]);
});

test('una clínica nueva se registra desde el formulario público', async ({ browser }) => {
  const reg = await browser.newPage();
  const regErrors: string[] = [];
  reg.on('pageerror', (e) => regErrors.push(e.message));
  await reg.goto('/auth/register');
  await reg.locator('input[formControlName="clinicName"]').fill(`Veterinaria Registro ${stamp}`);
  await reg.locator('input[formControlName="firstName"]').fill('Marta');
  await reg.locator('input[formControlName="lastName"]').fill('Registro');
  await reg.locator('input[formControlName="email"]').fill(`registro_${stamp}@vetpro.test`);
  await reg.locator('input[formControlName="password"]').fill('Prueba123!segura');
  await reg.locator('input[formControlName="phone"]').fill('3009998877');
  await Promise.all([
    reg.waitForResponse((r) => r.url().includes('/geo/municipios')),
    reg.locator('select[formControlName="departamentoCode"]').selectOption({ index: 1 }),
  ]);
  await expect(reg.locator('select[formControlName="municipioId"] option').nth(1)).toBeAttached();
  await reg.locator('select[formControlName="municipioId"]').selectOption({ index: 1 });
  await reg.locator('input[formControlName="nit"]').fill('901234567-8');
  await reg.locator('input[formControlName="dataProcessingConsent"]').check();
  const [res] = await Promise.all([
    reg.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/api/v1/auth/register')),
    reg.locator('button[type="submit"]').click(),
  ]);
  expect(res.status(), await res.text()).toBe(201);
  await reg.waitForURL(/onboarding|dashboard|complete-profile/);
  expect(regErrors).toEqual([]);
  await reg.close();
});

// Todas las pantallas de la clínica deben cargar sin errores de API ni de JavaScript
const screens = [
  '/dashboard', '/patients', '/tutors', '/appointments', '/appointments/calendar', '/appointments/new',
  '/medical-records', '/medical-records/hospitalization', '/hospitalization', '/labs',
  '/inventory', '/inventory/new', '/inventory/alerts', '/inventory/movements',
  '/billing', '/billing/new', '/consent', '/consent/new',
  '/reports', '/crm', '/notifications', '/notifications/templates', '/notifications/crm-reactivation',
  '/grooming', '/walkers', '/users', '/perfil-profesional', '/suscripcion',
];
for (const path of screens) {
  test(`carga la pantalla ${path}`, async () => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/auth\/login/);
    await expect(page.getByText(/No se pudo cargar|Error al cargar/)).toHaveCount(0);
  });
}
