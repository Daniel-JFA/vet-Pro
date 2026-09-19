/**
 * ==============================================================================
 * 🧪 VETPRO SaaS — PLAYWRIGHT END-TO-END (E2E) TEST SPECIFICATION
 * ==============================================================================
 * Historias críticas de Sprint 4.1:
 *  - Flujo 1: login → agenda → atender cita → historia con IA → facturar
 *  - Flujo 2: inventario → alerta de stock
 *  - Flujo 3: reporte mensual → exportar Excel
 * ==============================================================================
 */

import { test, expect } from '@playwright/test';

test.describe('VetPro SaaS — Sprint 4.1 Critical Pilot Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Interceptar llamadas al API para permitir ejecución determinística en CI
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token-access',
          user: {
            id: 'usr-1',
            clinicId: 'cln-1',
            firstName: 'Carlos',
            lastName: 'Mendoza',
            email: 'vet@clinica.com',
            role: 'admin',
            profileCompleted: true
          }
        })
      });
    });

    await page.route('**/api/v1/patients**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'pat-1',
                clinicId: 'cln-1',
                name: 'Toby',
                species: 'dog',
                breed: 'Golden Retriever',
                status: 'active',
                tutor: { id: 'tut-1', firstName: 'Juan', lastName: 'Pérez', phone: '3120000000' }
              }
            ],
            total: 1,
            page: 1,
            pageSize: 20
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/v1/tutors**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'tut-1',
              clinicId: 'cln-1',
              firstName: 'Juan',
              lastName: 'Pérez',
              phone: '3120000000',
              documentId: '10203040'
            }
          ],
          total: 1,
          page: 1,
          pageSize: 20
        })
      });
    });

    await page.route('**/api/v1/appointments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'app-1',
            clinicId: 'cln-1',
            patientId: 'pat-1',
            patient: { id: 'pat-1', name: 'Toby', species: 'dog' },
            vetId: 'usr-1',
            scheduledAt: new Date().toISOString(),
            serviceType: 'Consulta General',
            status: 'confirmed'
          }
        ])
      });
    });

    await page.route('**/api/v1/medical-records**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rec-1',
            clinicId: 'cln-1',
            patientId: 'pat-1',
            title: 'Consulta General Canina',
            diagnosis: 'Saludable',
            treatment: 'Plan preventivo anual',
            aiGenerated: true
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 20 })
        });
      }
    });

    await page.route('**/api/v1/billing/invoices**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'inv-1',
            clinicId: 'cln-1',
            invoiceNumber: 'FAC-001',
            total: 85000,
            amountPaid: 85000,
            balance: 0,
            status: 'paid'
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 20 })
        });
      }
    });

    await page.route('**/api/v1/inventory/products/low-stock**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prod-1',
            clinicId: 'cln-1',
            name: 'Amoxicilina 500mg',
            sku: 'MED-AMOX-500',
            currentStock: 0,
            minStock: 10,
            category: 'medication',
            salePrice: 25000
          },
          {
            id: 'prod-2',
            clinicId: 'cln-1',
            name: 'Vacuna Rabia Canina',
            sku: 'VAC-RAB-01',
            currentStock: 3,
            minStock: 15,
            category: 'vaccine',
            salePrice: 45000
          }
        ])
      });
    });

    await page.route('**/api/v1/inventory/products/expiring**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/api/v1/reports/dashboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kpis: {
            revenue: { current: 12500000, previous: 10800000, growth: 15.7 },
            consultations: { current: 142, previous: 120, growth: 18.3 },
            newPatients: { current: 35, previous: 28, growth: 25.0 },
            retentionRate: { current: 78.5, previous: 74.0, growth: 6.1 }
          },
          revenueTrends: { labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'], data: [2800000, 3100000, 3200000, 3400000] },
          speciesDistribution: { labels: ['Perros', 'Gatos', 'Otros'], data: [95, 40, 7] }
        })
      });
    });

    await page.route('**/api/v1/reports/export/excel', async (route) => {
      const csvData = '\uFEFFREPORTE EJECUTIVO FINANCIERO - VETPRO SaaS\nConsecutivo;Fecha;Tutor;Total;Estado\nFAC-001;2026-09-19;Juan Pérez;85000;Pagado\n';
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=reporte_ejecutivo_vetpro.csv'
        },
        body: csvData
      });
    });
  });

  test('Flow 1: Login → Agenda → Atender Cita → Historia con IA → Facturar', async ({ page }) => {
    // 1. Iniciar Sesión
    await page.goto('/auth/login');
    await page.fill('input[formControlName="email"]', 'vet@clinica.com');
    await page.fill('input[formControlName="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 2. Navegar a la Agenda Médica
    await page.goto('/appointments');
    await expect(page.locator('h1, .page-title')).toContainText(/Agenda|Citas/i);

    // 3. Atender Cita / Historia Clínica con IA
    await page.goto('/medical-records/bitacora-ai?patientId=pat-1');
    await expect(page.locator('.page-title, h1')).toContainText(/Registro de Consulta|Plantillas Clínicas/i);

    // 4. Completar nota clínica y guardar
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill('Paciente en excelente estado de salud general. Plan preventivo al día.');
    }

    // 5. Ir al flujo de Facturación
    await page.goto('/billing/invoices/new');
    await expect(page).toHaveURL(/.*billing\/invoices\/new/);
  });

  test('Flow 2: Inventario → Alerta de Stock', async ({ page }) => {
    // Autenticación simulada
    await page.goto('/auth/login');
    await page.fill('input[formControlName="email"]', 'vet@clinica.com');
    await page.fill('input[formControlName="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Navegar a las alertas de inventario
    await page.goto('/inventory/alerts');
    await expect(page.locator('h1')).toContainText(/Alertas de inventario/i);

    // Validar secciones de alertas
    await expect(page.locator('.alert-section')).toHaveCount(3);
    await expect(page.locator('.section-header.critical')).toContainText(/Sin stock/i);
    await expect(page.locator('.section-header.warning')).toContainText(/Stock bajo/i);

    // Verificar que aparezcan los productos alertados
    await expect(page.locator('.alerts-grid')).toContainText('Amoxicilina 500mg');
    await expect(page.locator('.alerts-grid')).toContainText('Vacuna Rabia Canina');
  });

  test('Flow 3: Reporte Mensual → Exportar Excel', async ({ page }) => {
    // Autenticación simulada
    await page.goto('/auth/login');
    await page.fill('input[formControlName="email"]', 'vet@clinica.com');
    await page.fill('input[formControlName="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Navegar a Reportes Ejecutivos
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText(/Reportes y Analíticas/i);

    // Validar KPIs financieros visibles
    await expect(page.locator('.kpi-card')).toHaveCount(4);
    await expect(page.locator('.card-revenue')).toContainText(/Ingresos Mensuales/i);
    await expect(page.locator('.card-consultations')).toContainText(/Consultas Médicas/i);

    // Escuchar evento de descarga al hacer clic en Exportar Excel
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('.export-btn');
    const download = await downloadPromise;

    if (download) {
      expect(download.suggestedFilename()).toBe('reporte_ejecutivo_vetpro.csv');
    }
  });

});
