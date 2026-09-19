import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabService, LabOrder, LabTestCatalogItem } from '../../../core/services/lab.service';

@Component({
  selector: 'app-lab-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lab-container">
      <!-- Header -->
      <div class="lab-header">
        <div>
          <div class="badge-lab">🔬 MÓDULO CLÍNICO DE LABORATORIO & DIAGNÓSTICO</div>
          <h1 class="page-title">Órdenes de Laboratorio e Imagenología</h1>
          <p class="page-subtitle">
            Gestión de perfiles hematológicos, bioquímicos, urianálisis y estudios ecográficos con
            validación de rangos por especie.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="activeTab.set('catalog')">
            <span class="material-symbols-outlined">menu_book</span>
            Catálogo de Pruebas
          </button>
          <button class="btn btn-primary" (click)="openNewOrderModal()">
            <span class="material-symbols-outlined">add_circle</span>
            Nueva Orden
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-bar">
        <button
          class="tab-btn"
          [class.active]="activeTab() === 'orders'"
          (click)="activeTab.set('orders')"
        >
          📋 Órdenes de Pacientes ({{ orders().length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab() === 'catalog'"
          (click)="activeTab.set('catalog')"
        >
          🧪 Catálogo de Pruebas y Rangos ({{ catalog().length }})
        </button>
      </div>

      <!-- TAB 1: ÓRDENES -->
      @if (activeTab() === 'orders') {
        <div class="tab-content">
          @if (isLoading()) {
            <div class="loading-box">Cargando órdenes de laboratorio...</div>
          }
          @if (!isLoading() && orders().length === 0) {
            <div class="empty-box">
              <span class="material-symbols-outlined icon-empty">biotech</span>
              <p>No hay órdenes de laboratorio registradas aún.</p>
              <button class="btn btn-primary" (click)="openNewOrderModal()">
                Crear Primera Orden
              </button>
            </div>
          }
          <div class="orders-grid">
            @for (o of orders(); track o) {
              <div class="order-card" [class.completed]="o.status === 'completed'">
                <div class="order-top">
                  <span class="order-code">{{ o.orderNumber }}</span>
                  <span class="status-badge" [ngClass]="o.status">{{
                    formatStatus(o.status)
                  }}</span>
                </div>
                <div class="order-pet">
                  <span class="pet-emoji">{{ o.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                  <div>
                    <h4 class="pet-name">{{ o.patient.name }}</h4>
                    <p class="pet-sub">
                      {{ o.patient.breed || 'Mestizo' }} • Tutor: {{ o.patient.tutor?.firstName }}
                      {{ o.patient.tutor?.lastName }}
                    </p>
                  </div>
                </div>
                <div class="order-meta">
                  <span><strong>Muestra:</strong> {{ o.sampleType || 'Sangre EDTA' }}</span>
                  <span
                    ><strong>Médico:</strong> Dr(a). {{ o.vet.firstName }}
                    {{ o.vet.lastName }}</span
                  >
                  <span
                    ><strong>Fecha:</strong> {{ o.orderedAt | date: 'dd/MM/yyyy, hh:mm a' }}</span
                  >
                </div>
                @if (o.results && o.results.length > 0) {
                  <div class="results-preview">
                    <span class="preview-title">Pruebas en la orden ({{ o.results.length }}):</span>
                    <div class="chips-list">
                      @for (r of o.results.slice(0, 4); track r) {
                        <span class="test-chip" [ngClass]="r.flag">
                          {{ r.testName }}:
                          {{
                            r.valueMeasured ? r.valueMeasured + ' ' + (r.unit || '') : 'Pendiente'
                          }}
                        </span>
                      }
                      @if (o.results.length > 4) {
                        <span class="more-chip">+{{ o.results.length - 4 }} más</span>
                      }
                    </div>
                  </div>
                }
                <div class="order-actions">
                  <button class="btn-action" (click)="openResultsModal(o)">
                    <span class="material-symbols-outlined">{{
                      o.status === 'completed' ? 'visibility' : 'edit_note'
                    }}</span>
                    {{ o.status === 'completed' ? 'Ver Resultados' : 'Cargar Resultados' }}
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- TAB 2: CATÁLOGO DE PRUEBAS -->
      @if (activeTab() === 'catalog') {
        <div class="tab-content">
          <div class="catalog-table-box">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre del Examen</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Rango Ref. Caninos</th>
                  <th>Rango Ref. Felinos</th>
                  <th>Precio Venta</th>
                </tr>
              </thead>
              <tbody>
                @for (item of catalog(); track item) {
                  <tr>
                    <td>
                      <strong>{{ item.code }}</strong>
                    </td>
                    <td>{{ item.name }}</td>
                    <td>
                      <span class="cat-pill">{{ item.category }}</span>
                    </td>
                    <td>{{ item.unit || '-' }}</td>
                    <td>
                      {{ item.canineRefText || item.canineRefMin + ' - ' + item.canineRefMax }}
                    </td>
                    <td>
                      {{ item.felineRefText || item.felineRefMin + ' - ' + item.felineRefMax }}
                    </td>
                    <td>{{ item.salePrice | currency: 'COP' : '$' : '1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- MODAL DIGITACIÓN DE RESULTADOS -->
      @if (selectedOrderModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>
                Resultados: {{ selectedOrderModal()?.orderNumber }} ({{
                  selectedOrderModal()?.patient?.name
                }})
              </h3>
              <button class="close-btn" (click)="selectedOrderModal.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                Digite los valores analíticos obtenidos. El sistema contrastará automáticamente
                contra el rango de referencia de la especie.
              </p>
              <table class="results-table">
                <thead>
                  <tr>
                    <th>Analito / Prueba</th>
                    <th>Valor Medido</th>
                    <th>Unidad</th>
                    <th>Rango de Referencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (res of activeOrderResults(); track res) {
                    <tr>
                      <td>
                        <strong>{{ res.testName }}</strong>
                      </td>
                      <td>
                        <input
                          type="text"
                          [(ngModel)]="res.valueMeasured"
                          class="input-val"
                          placeholder="Ej: 14.5"
                        />
                      </td>
                      <td>{{ res.unit }}</td>
                      <td>{{ res.refRangeText || 'Rango clínico normal' }}</td>
                      <td>
                        <span class="flag-badge" [ngClass]="res.flag || 'normal'">
                          {{
                            res.flag === 'low'
                              ? 'Bajo ⬇'
                              : res.flag === 'high'
                                ? 'Alto ⬆'
                                : 'Normal ✓'
                          }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="selectedOrderModal.set(null)">
                Cancelar
              </button>
              <button class="btn btn-primary" (click)="saveResults()">
                <span class="material-symbols-outlined">save</span>
                Guardar y Finalizar Examen
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .lab-container {
        padding: 24px;
        max-width: 1300px;
        margin: 0 auto;
      }
      .lab-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .badge-lab {
        font-size: 11px;
        font-weight: 700;
        color: #0284c7;
        background: #e0f2fe;
        padding: 4px 10px;
        border-radius: 20px;
        display: inline-block;
        margin-bottom: 6px;
      }
      .page-title {
        margin: 0 0 6px;
        font-size: 24px;
        font-weight: 800;
        color: #0f172a;
      }
      .page-subtitle {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        max-width: 700px;
      }
      .header-actions {
        display: flex;
        gap: 10px;
      }
      .btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      .btn-primary {
        background: #0284c7;
        color: #fff;
        &:hover {
          background: #0369a1;
        }
      }
      .btn-secondary {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
      }
      .tab-bar {
        display: flex;
        gap: 12px;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 20px;
      }
      .tab-btn {
        background: none;
        border: none;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      .tab-btn.active {
        color: #0284c7;
        border-bottom-color: #0284c7;
      }
      .orders-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 18px;
      }
      .order-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .order-card.completed {
        border-left: 4px solid #16a34a;
      }
      .order-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .order-code {
        font-size: 12px;
        font-weight: 800;
        color: #0284c7;
      }
      .status-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
      }
      .status-badge.pending {
        background: #fef3c7;
        color: #b45309;
      }
      .status-badge.completed {
        background: #dcfce7;
        color: #15803d;
      }
      .order-pet {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .pet-emoji {
        font-size: 26px;
      }
      .pet-name {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
      }
      .pet-sub {
        margin: 2px 0 0;
        font-size: 12px;
        color: #64748b;
      }
      .order-meta {
        font-size: 12px;
        color: #475569;
        display: flex;
        flex-direction: column;
        gap: 3px;
        background: #f8fafc;
        padding: 8px;
        border-radius: 6px;
      }
      .results-preview {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .preview-title {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
      }
      .chips-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .test-chip {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #f1f5f9;
        color: #334155;
      }
      .test-chip.high {
        background: #fee2e2;
        color: #dc2626;
        font-weight: 700;
      }
      .test-chip.low {
        background: #e0e7ff;
        color: #4338ca;
        font-weight: 700;
      }
      .more-chip {
        font-size: 11px;
        color: #64748b;
      }
      .order-actions {
        margin-top: auto;
      }
      .btn-action {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px;
        background: #f0f9ff;
        color: #0284c7;
        border: 1px solid #bae6fd;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        &:hover {
          background: #e0f2fe;
        }
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
        font-size: 13px;
      }
      .data-table th {
        background: #f8fafc;
        padding: 10px 14px;
        text-align: left;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
      }
      .data-table td {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }
      .cat-pill {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        background: #e2e8f0;
        color: #475569;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-card {
        background: #fff;
        border-radius: 12px;
        max-width: 750px;
        width: 95%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
      }
      .modal-body {
        padding: 20px;
        overflow-y: auto;
      }
      .modal-footer {
        padding: 14px 20px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .results-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .results-table th {
        text-align: left;
        padding: 8px;
        background: #f8fafc;
        color: #64748b;
      }
      .results-table td {
        padding: 8px;
        border-bottom: 1px solid #f1f5f9;
      }
      .input-val {
        width: 90px;
        padding: 6px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        font-weight: 700;
      }
      .flag-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .flag-badge.normal {
        background: #dcfce7;
        color: #15803d;
      }
      .flag-badge.high {
        background: #fee2e2;
        color: #dc2626;
      }
      .flag-badge.low {
        background: #e0e7ff;
        color: #4338ca;
      }
    `,
  ],
})
export class LabOrdersComponent implements OnInit {
  private labService = inject(LabService);

  activeTab = signal<'orders' | 'catalog'>('orders');
  isLoading = signal<boolean>(false);
  orders = signal<LabOrder[]>([]);
  catalog = signal<LabTestCatalogItem[]>([]);
  selectedOrderModal = signal<LabOrder | null>(null);
  activeOrderResults = signal<any[]>([]);

  ngOnInit() {
    this.loadCatalog();
    this.loadOrders();
  }

  loadCatalog() {
    this.labService.getCatalog().subscribe({
      next: (data) => this.catalog.set(data),
      error: (e) => console.warn('[Lab] Error catálogo:', e),
    });
  }

  loadOrders() {
    this.isLoading.set(true);
    this.labService.getOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.isLoading.set(false);
      },
      error: (e) => {
        console.warn('[Lab] Error órdenes:', e);
        this.isLoading.set(false);
      },
    });
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendiente ⏳';
      case 'sample_taken':
        return 'Muestra Tomada 🩸';
      case 'in_analysis':
        return 'En Análisis 🔬';
      case 'completed':
        return 'Completado ✓';
      case 'cancelled':
        return 'Cancelado ✕';
      default:
        return status;
    }
  }

  openResultsModal(order: LabOrder) {
    this.selectedOrderModal.set(order);
    this.activeOrderResults.set(JSON.parse(JSON.stringify(order.results || [])));
  }

  saveResults() {
    const order = this.selectedOrderModal();
    if (!order) return;

    this.labService
      .saveResults(order.id, {
        status: 'completed',
        results: this.activeOrderResults().map((r) => ({
          labTestCatalogId: r.labTestCatalogId,
          testName: r.testName,
          valueMeasured: r.valueMeasured || 'Normal',
          unit: r.unit,
          interpretation: r.interpretation,
        })),
      })
      .subscribe({
        next: () => {
          alert('Resultados de laboratorio guardados y validados exitosamente.');
          this.selectedOrderModal.set(null);
          this.loadOrders();
        },
        error: () => alert('Error al guardar resultados.'),
      });
  }

  openNewOrderModal() {
    alert(
      'Para emitir una nueva orden de laboratorio, abra la consulta o el perfil del paciente y presione "Ordenar Examen".',
    );
  }
}
