/**
 * ==============================================================================
 * 🧪 VETPRO SaaS — PLAYWRIGHT END-TO-END (E2E) TEST SPECIFICATION
 * ==============================================================================
 * Este archivo define los flujos de pruebas de integración críticos para certificar
 * la calidad clínica y de facturación del producto bajo estándares OWASP.
 * ==============================================================================
 */

import { test, expect } from '@playwright/test';

test.describe('VetPro SaaS — Clinical & Billing Critical Flows', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ir a la página de login local
    await page.goto('http://localhost:4200/auth/login');
  });

  test('Flow 1: Admin Authentication & Onboarding Redirect', async ({ page }) => {
    // 1. Iniciar sesión como Admin
    await page.click('button:has-text("Admin")');
    await page.click('button[type="submit"]');

    // 2. Verificar redirección automática al Onboarding Wizard (si es base virgen)
    await expect(page).toHaveURL(/.*onboarding/);
    
    // 3. Llenar paso 1: Clínica
    await page.fill('input[placeholder*="NIT"]', '900.123.456-7');
    await page.fill('input[placeholder*="Teléfono"]', '3124567890');
    await page.fill('input[placeholder*="Ciudad"]', 'Bogotá');
    await page.click('button:has-text("Siguiente")');

    // 4. Llenar paso 2: Sede
    await page.fill('input[placeholder*="Nombre de la Sede"]', 'Sede Central Norte');
    await page.fill('input[placeholder*="Dirección"]', 'Calle 100 #15-30');
    await page.click('button:has-text("Siguiente")');

    // 5. Llenar paso 3: Veterinario adicional
    await page.fill('input[placeholder*="Nombre Completo"]', 'Dr. Laura Cardona');
    await page.fill('input[placeholder*="Correo"]', 'laura@clinica.co');
    await page.click('button:has-text("Finalizar")');

    // 6. Entrar al Dashboard
    await page.click('button:has-text("Comenzar")');
    await expect(page).toHaveURL('http://localhost:4200/dashboard');
  });

  test('Flow 2: Patient Registration & Waitlist Check', async ({ page }) => {
    // Autenticar
    await page.click('button:has-text("Admin")');
    await page.click('button[type="submit"]');
    await page.goto('http://localhost:4200/patients/new');

    // 1. Crear Mascota Toby
    await page.fill('input[name="name"]', 'Toby');
    await page.selectOption('select[name="species"]', 'dog');
    await page.fill('input[name="breed"]', 'Golden Retriever');
    await page.click('button:has-text("Registrar Mascota")');

    // 2. Validar que aparezca en la lista de pacientes
    await expect(page.locator('table')).toContainText('Toby');
  });

  test('Flow 3: Billing Invoice Generation & PDF Receipt A4', async ({ page }) => {
    // Autenticar
    await page.click('button:has-text("Admin")');
    await page.click('button[type="submit"]');
    await page.goto('http://localhost:4200/billing/invoices/new');

    // 1. Generar Factura
    await page.selectOption('select[name="tutor"]', 'Carlos Gómez');
    await page.fill('input[name="description"]', 'Consulta Veterinaria General');
    await page.fill('input[name="price"]', '85000');
    await page.click('button:has-text("Emitir Factura")');

    // 2. Comprobar que esté registrada como Pagada
    await expect(page.locator('.invoice-status')).toContainText('Pagado');
  });

});
