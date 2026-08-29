import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface NotificationItem {
  id: string;
  recipientName: string;
  recipientPhone: string;
  channel: 'whatsapp' | 'email' | 'sms';
  trigger: 'appointment_reminder_24h' | 'appointment_reminder_2h' | 'vaccine_due' | 'invoice_receipt' | 'marketing_reactivation';
  status: 'delivered' | 'sent' | 'failed' | 'pending';
  patientName: string;
  sentAt: Date;
  messageSnippet: string;
}

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="notif-center-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-titles">
          <h1 class="page-title">Centro de Notificaciones & WhatsApp</h1>
          <p class="page-subtitle">Monitorea y gestiona el envío de recordatorios automáticos y campañas de fidelización.</p>
        </div>
        <div class="header-actions">
          <a routerLink="/notifications/crm-reactivation" class="btn btn-crm">
            <span class="material-symbols-outlined">campaign</span>
            Reactivar Inactivos (CRM)
          </a>
          <a routerLink="/notifications/templates" class="btn btn-secondary">
            <span class="material-symbols-outlined">edit_note</span>
            Plantillas
          </a>
          <button class="btn btn-primary" (click)="testSendNotification()">
            <span class="material-symbols-outlined">send</span>
            Prueba
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper bg-green">
            <span class="material-symbols-outlined">mark_chat_read</span>
          </div>
          <div class="stat-details">
            <span class="stat-label">WhatsApp Entregados</span>
            <span class="stat-value">{{ deliveredCount() }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper bg-blue">
            <span class="material-symbols-outlined">schedule_send</span>
          </div>
          <div class="stat-details">
            <span class="stat-label">Programados (Próximas 24h)</span>
            <span class="stat-value">{{ pendingCount() }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper bg-purple">
            <span class="material-symbols-outlined">verified</span>
          </div>
          <div class="stat-details">
            <span class="stat-label">Tasa de Confirmación</span>
            <span class="stat-value">94.2%</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrapper bg-orange">
            <span class="material-symbols-outlined">warning</span>
          </div>
          <div class="stat-details">
            <span class="stat-label">Fallidos / Reintentos</span>
            <span class="stat-value">{{ failedCount() }}</span>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-box">
            <span class="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Buscar por tutor, mascota o teléfono..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>

          <div class="filter-tabs">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'all'"
              (click)="activeTab.set('all')"
            >
              Todos ({{ notifications().length }})
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'delivered'"
              (click)="activeTab.set('delivered')"
            >
              Entregados
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'pending'"
              (click)="activeTab.set('pending')"
            >
              En Cola
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'failed'"
              (click)="activeTab.set('failed')"
            >
              Fallidos
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Destinatario / Tutor</th>
                <th>Mascota</th>
                <th>Canal & Tipo</th>
                <th>Mensaje / Resumen</th>
                <th>Estado</th>
                <th>Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let notif of filteredNotifications()">
                <td>
                  <div class="recipient-info">
                    <span class="recipient-name">{{ notif.recipientName }}</span>
                    <span class="recipient-phone">{{ notif.recipientPhone }}</span>
                  </div>
                </td>
                <td>
                  <span class="patient-badge">🐾 {{ notif.patientName }}</span>
                </td>
                <td>
                  <div class="channel-info">
                    <span class="channel-tag" [class.whatsapp]="notif.channel === 'whatsapp'">
                      💬 {{ notif.channel | uppercase }}
                    </span>
                    <span class="trigger-label">{{ formatTrigger(notif.trigger) }}</span>
                  </div>
                </td>
                <td>
                  <span class="snippet" [title]="notif.messageSnippet">{{ notif.messageSnippet }}</span>
                </td>
                <td>
                  <span class="status-badge" [ngClass]="notif.status">
                    {{ formatStatus(notif.status) }}
                  </span>
                </td>
                <td>
                  <span class="date-text">{{ notif.sentAt | date:'medium' }}</span>
                </td>
              </tr>
              <tr *ngIf="filteredNotifications().length === 0">
                <td colspan="6" class="empty-row">
                  <span class="material-symbols-outlined">notifications_off</span>
                  <p>No se encontraron notificaciones con los filtros seleccionados.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notif-center-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }

    .page-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
    }

    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      &:hover { background: #1d4ed8; }
    }

    .btn-crm {
      background: #9333ea;
      color: #ffffff;
      &:hover { background: #7e22ce; }
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      &:hover { background: #e2e8f0; }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .stat-icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      &.bg-green { background: #dcfce7; color: #16a34a; }
      &.bg-blue { background: #dbeafe; color: #2563eb; }
      &.bg-purple { background: #f3e8ff; color: #9333ea; }
      &.bg-orange { background: #ffedd5; color: #ea580c; }
    }

    .stat-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
    }

    .table-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .table-toolbar {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid #f1f5f9;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 14px;
      border-radius: 8px;
      width: 320px;
      max-width: 100%;
      input {
        border: none;
        background: transparent;
        outline: none;
        font-size: 13px;
        width: 100%;
      }
    }

    .filter-tabs {
      display: flex;
      gap: 6px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 8px;
    }

    .tab-btn {
      border: none;
      background: transparent;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      &.active {
        background: #ffffff;
        color: #0f172a;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      th {
        text-align: left;
        padding: 12px 20px;
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
      }
      td {
        padding: 14px 20px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }
    }

    .recipient-name {
      display: block;
      font-weight: 600;
      color: #0f172a;
    }
    .recipient-phone {
      font-size: 12px;
      color: #64748b;
    }

    .patient-badge {
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 500;
    }

    .channel-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      &.whatsapp { background: #dcfce7; color: #15803d; }
    }

    .trigger-label {
      display: block;
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    .snippet {
      max-width: 250px;
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #475569;
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      &.delivered { background: #dcfce7; color: #16a34a; }
      &.sent { background: #dbeafe; color: #2563eb; }
      &.pending { background: #fef3c7; color: #d97706; }
      &.failed { background: #fee2e2; color: #dc2626; }
    }

    .empty-row {
      text-align: center;
      padding: 40px !important;
      color: #94a3b8;
      span { font-size: 40px; }
      p { margin: 8px 0 0; }
    }
  `]
})
export class NotificationCenterComponent {
  searchTerm = signal('');
  activeTab = signal<'all' | 'delivered' | 'pending' | 'failed'>('all');

  notifications = signal<NotificationItem[]>([
    {
      id: 'notif-1',
      recipientName: 'Carlos Gómez',
      recipientPhone: '+57 312 456 7890',
      channel: 'whatsapp',
      trigger: 'appointment_reminder_24h',
      status: 'delivered',
      patientName: 'Toby',
      sentAt: new Date(Date.now() - 2 * 3600000),
      messageSnippet: 'Hola Carlos, te recordamos tu cita mañana a las 10:00 AM con Toby en VetPro.'
    },
    {
      id: 'notif-2',
      recipientName: 'María Rodríguez',
      recipientPhone: '+57 315 789 1234',
      channel: 'whatsapp',
      trigger: 'vaccine_due',
      status: 'delivered',
      patientName: 'Luna',
      sentAt: new Date(Date.now() - 5 * 3600000),
      messageSnippet: 'Hola María, la vacuna antirrábica de Luna vence en 5 días. Agenda aquí: https://vetpro.co/b/luna'
    },
    {
      id: 'notif-3',
      recipientName: 'Andrés Morales',
      recipientPhone: '+57 300 123 4567',
      channel: 'whatsapp',
      trigger: 'appointment_reminder_2h',
      status: 'pending',
      patientName: 'Simba',
      sentAt: new Date(Date.now() + 1 * 3600000),
      messageSnippet: 'Tu turno para Simba en VetPro es en 2 horas. Te esperamos.'
    },
    {
      id: 'notif-4',
      recipientName: 'Laura Ospina',
      recipientPhone: '+57 310 987 6543',
      channel: 'whatsapp',
      trigger: 'marketing_reactivation',
      status: 'delivered',
      patientName: 'Kira',
      sentAt: new Date(Date.now() - 24 * 3600000),
      messageSnippet: '¡Hola Laura! Hace 6 meses no vemos a Kira. Agenda su chequeo preventivo con 15% off.'
    },
    {
      id: 'notif-5',
      recipientName: 'David Henao',
      recipientPhone: '+57 320 555 1212',
      channel: 'whatsapp',
      trigger: 'invoice_receipt',
      status: 'failed',
      patientName: 'Max',
      sentAt: new Date(Date.now() - 12 * 3600000),
      messageSnippet: 'Comprobante de factura FAC-000042 por $145.000 COP adjunto.'
    }
  ]);

  deliveredCount = computed(() => this.notifications().filter(n => n.status === 'delivered').length);
  pendingCount = computed(() => this.notifications().filter(n => n.status === 'pending').length);
  failedCount = computed(() => this.notifications().filter(n => n.status === 'failed').length);

  filteredNotifications = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const tab = this.activeTab();

    return this.notifications().filter(n => {
      const matchSearch =
        !q ||
        n.recipientName.toLowerCase().includes(q) ||
        n.patientName.toLowerCase().includes(q) ||
        n.recipientPhone.includes(q);

      const matchTab = tab === 'all' || n.status === tab;

      return matchSearch && matchTab;
    });
  });

  formatTrigger(trigger: string): string {
    switch (trigger) {
      case 'appointment_reminder_24h': return 'Recordatorio 24h';
      case 'appointment_reminder_2h': return 'Aviso 2h antes';
      case 'vaccine_due': return 'Vacuna por vencer';
      case 'invoice_receipt': return 'Recibo de Factura';
      case 'marketing_reactivation': return 'Reactivación Inactivos';
      default: return trigger;
    }
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'delivered': return 'Entregado';
      case 'sent': return 'Enviado';
      case 'pending': return 'Programado';
      case 'failed': return 'Fallido';
      default: return status;
    }
  }

  testSendNotification() {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      recipientName: 'Daniel Flórez (Admin)',
      recipientPhone: '+57 312 211 5299',
      channel: 'whatsapp',
      trigger: 'appointment_reminder_24h',
      status: 'delivered',
      patientName: 'Toby',
      sentAt: new Date(),
      messageSnippet: 'Mensaje de prueba exitoso enviado desde el panel de VetPro vía WhatsApp Cloud API.'
    };

    this.notifications.update(list => [newNotif, ...list]);
  }
}
