import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface HomeVisitAppointment {
  id: string;
  tutorName: string;
  tutorPhone: string;
  patientId: string;
  patientName: string;
  patientSpecies: string;
  patientBreed: string;
  serviceType: string;
  address: string;
  city: string;
  notesAddress?: string;
  travelFee: number;
  serviceFee: number;
  scheduledTime: string;
  trackingStatus: 'assigned' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed';
  paymentStatus: 'pending' | 'paid';
}

export interface MobileInventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
}

@Component({
  selector: 'app-ondemand-route',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ondemand-container">
      <!-- Top Mobile Header -->
      <div class="route-header">
        <div class="header-main">
          <span class="badge-live">🛵 MODO DOMICILIOS EN VIVO</span>
          <h1 class="header-title">Ruta del Veterinario</h1>
          <p class="header-subtitle">Gestión de consultas a domicilio, navegación GPS, cobro digital y maletín móvil.</p>
        </div>

        <div class="header-actions">
          <button class="btn btn-inventory" (click)="showInventoryModal.set(true)">
            <span class="material-symbols-outlined">medical_services</span>
            Mi Maletín ({{ mobileInventory().length }} items)
          </button>
        </div>
      </div>

      <!-- Route Overview Stats -->
      <div class="stats-row">
        <div class="mini-stat">
          <span class="mini-label">Servicios Hoy</span>
          <span class="mini-val">{{ appointments().length }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Pendientes</span>
          <span class="mini-val text-amber">{{ pendingCount() }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Completados</span>
          <span class="mini-val text-green">{{ completedCount() }}</span>
        </div>
        <div class="mini-stat">
          <span class="mini-label">Total Recaudado</span>
          <span class="mini-val text-blue">\${{ totalEarnings() | number:'1.0-0' }} COP</span>
        </div>
      </div>

      <!-- Visits List / Mobile Cards -->
      <div class="visits-feed">
        <div
          *ngFor="let visit of appointments(); let i = index"
          class="visit-card"
          [class.active-card]="visit.trackingStatus === 'on_the_way' || visit.trackingStatus === 'arrived' || visit.trackingStatus === 'in_progress'"
          [class.completed-card]="visit.trackingStatus === 'completed'"
        >
          <!-- Card Header -->
          <div class="card-top">
            <div class="visit-number">#{{ i + 1 }} • {{ visit.scheduledTime }}</div>
            <span class="status-chip" [ngClass]="visit.trackingStatus">
              {{ formatTrackingStatus(visit.trackingStatus) }}
            </span>
          </div>

          <!-- Patient & Tutor Info -->
          <div class="patient-info-row">
            <div class="avatar-pet">{{ visit.patientSpecies === 'cat' ? '🐱' : '🐶' }}</div>
            <div class="pet-details">
              <h3 class="pet-name">{{ visit.patientName }} <span class="breed">({{ visit.patientBreed }})</span></h3>
              <p class="service-name">🩺 {{ visit.serviceType }}</p>
            </div>
          </div>

          <!-- Address & GPS Navigation -->
          <div class="location-box">
            <div class="address-text">
              <span class="material-symbols-outlined loc-icon">pin_drop</span>
              <div>
                <strong>{{ visit.address }}</strong>
                <span class="city-sub">{{ visit.city }} <span *ngIf="visit.notesAddress">• {{ visit.notesAddress }}</span></span>
              </div>
            </div>

            <div class="nav-buttons-grid" *ngIf="visit.trackingStatus !== 'completed'">
              <a [href]="getWazeUrl(visit.address)" target="_blank" class="nav-btn waze-btn">
                <span class="material-symbols-outlined">navigation</span> Waze
              </a>
              <a [href]="getGoogleMapsUrl(visit.address)" target="_blank" class="nav-btn gmaps-btn">
                <span class="material-symbols-outlined">map</span> Google Maps
              </a>
              <a [href]="'tel:' + visit.tutorPhone" class="nav-btn call-btn">
                <span class="material-symbols-outlined">call</span> Llamar
              </a>
            </div>
          </div>

          <!-- Action Progress Buttons -->
          <div class="card-actions">
            <!-- Step 1: Start Moving -->
            <button
              *ngIf="visit.trackingStatus === 'assigned'"
              class="action-btn btn-start"
              (click)="updateStatus(visit.id, 'on_the_way')"
            >
              <span class="material-symbols-outlined">two_wheeler</span>
              Voy en Camino al Domicilio
            </button>

            <!-- Step 2: Arrived -->
            <button
              *ngIf="visit.trackingStatus === 'on_the_way'"
              class="action-btn btn-arrived"
              (click)="updateStatus(visit.id, 'arrived')"
            >
              <span class="material-symbols-outlined">door_front</span>
              Llegué a la Puerta del Tutor
            </button>

            <!-- Step 3: Start Consultation & Open AI Voice -->
            <div class="in-consult-actions" *ngIf="visit.trackingStatus === 'arrived' || visit.trackingStatus === 'in_progress'">
              <button class="action-btn btn-ai-voice" (click)="openAiRecord(visit.patientId)">
                <span class="material-symbols-outlined">mic</span>
                Abrir Bitácora IA por Voz
              </button>

              <button class="action-btn btn-pay" (click)="openPaymentModal(visit)">
                <span class="material-symbols-outlined">point_of_sale</span>
                Cobrar Consulta (\${{ (visit.serviceFee + visit.travelFee) | number:'1.0-0' }})
              </button>
            </div>

            <!-- Completed Indicator -->
            <div *ngIf="visit.trackingStatus === 'completed'" class="completed-summary">
              <span class="material-symbols-outlined check-icon">check_circle</span>
              <span>Atención finalizada y pagada con éxito.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal: Cobro Digital en Sitio (QR Nequi/Daviplata + Link) -->
      <div class="modal-backdrop" *ngIf="activePaymentVisit()" (click)="activePaymentVisit.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>💳 Cobro Digital en Sitio</h3>
            <button class="close-btn" (click)="activePaymentVisit.set(null)">✕</button>
          </div>

          <div class="modal-body" *ngIf="activePaymentVisit() as v">
            <div class="total-to-pay">
              <span class="total-label">Total a Pagar (Consulta + Domicilio):</span>
              <span class="total-number">\${{ (v.serviceFee + v.travelFee) | number:'1.0-0' }} COP</span>
            </div>

            <!-- QR Code Simulation for Nequi / Bancolombia -->
            <div class="qr-box">
              <div class="qr-frame">
                <span class="material-symbols-outlined qr-icon">qr_code_2</span>
                <p class="qr-sub">Escanea con Nequi, Daviplata o Bancolombia</p>
              </div>
              <span class="qr-key">Llave / Celular: <strong>{{ v.tutorPhone }}</strong></span>
            </div>

            <!-- Payment Action Buttons -->
            <div class="pay-actions-list">
              <button class="btn btn-whatsapp-pay" (click)="sendPaymentWhatsApp(v)">
                <span class="material-symbols-outlined">send_to_mobile</span>
                Enviar Link de Pago por WhatsApp (Wompi/Bold)
              </button>

              <button class="btn btn-confirm-cash" (click)="confirmPaymentReceived(v.id)">
                <span class="material-symbols-outlined">payments</span>
                Confirmar Pago Recibido (Efectivo / Transferencia)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal: Maletín Móvil del Veterinario -->
      <div class="modal-backdrop" *ngIf="showInventoryModal()" (click)="showInventoryModal.set(false)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>🎒 Maletín Móvil de Insumos</h3>
            <button class="close-btn" (click)="showInventoryModal.set(false)">✕</button>
          </div>

          <div class="modal-body">
            <p class="modal-desc">Insumos y fármacos cargados para la jornada móvil de hoy:</p>
            
            <div class="inventory-list">
              <div *ngFor="let item of mobileInventory()" class="inventory-row">
                <div class="item-name">
                  <strong>{{ item.name }}</strong>
                  <span class="item-cat">{{ item.category }}</span>
                </div>
                <div class="item-qty">
                  <span class="qty-pill">{{ item.quantity }} {{ item.unit }}</span>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary w-full" (click)="showInventoryModal.set(false)">
                Cerrar Maletín
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ondemand-container {
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .route-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }

    .badge-live {
      display: inline-block;
      background: #fee2e2;
      color: #dc2626;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .header-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }

    .header-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }

    .btn-inventory {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      &:hover { background: #e2e8f0; }
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #ffffff;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .mini-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .mini-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .mini-val {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      &.text-amber { color: #d97706; }
      &.text-green { color: #16a34a; }
      &.text-blue { color: #2563eb; }
    }

    .visits-feed {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .visit-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      transition: all 0.2s ease;

      &.active-card {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }

      &.completed-card {
        opacity: 0.75;
        background: #f8fafc;
      }
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .visit-number {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
    }

    .status-chip {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      &.assigned { background: #f1f5f9; color: #475569; }
      &.on_the_way { background: #dbeafe; color: #1d4ed8; }
      &.arrived { background: #fef3c7; color: #b45309; }
      &.in_progress { background: #fae8ff; color: #86198f; }
      &.completed { background: #dcfce7; color: #15803d; }
    }

    .patient-info-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-pet {
      font-size: 28px;
      width: 44px;
      height: 44px;
      background: #f1f5f9;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pet-name {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      .breed { font-size: 13px; font-weight: 400; color: #64748b; }
    }

    .service-name {
      margin: 2px 0 0;
      font-size: 13px;
      color: #2563eb;
      font-weight: 600;
    }

    .location-box {
      background: #f8fafc;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .address-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      color: #1e293b;
      .loc-icon { color: #ef4444; font-size: 18px; }
      .city-sub { display: block; font-size: 11px; color: #64748b; }
    }

    .nav-buttons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      span { font-size: 16px; }
    }

    .waze-btn { background: #33ccff; color: #003344; }
    .gmaps-btn { background: #4285f4; color: #ffffff; }
    .call-btn { background: #22c55e; color: #ffffff; }

    .action-btn {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }

    .btn-start { background: #2563eb; color: #ffffff; &:hover { background: #1d4ed8; } }
    .btn-arrived { background: #d97706; color: #ffffff; &:hover { background: #b45309; } }
    
    .in-consult-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-ai-voice { background: #9333ea; color: #ffffff; &:hover { background: #7e22ce; } }
    .btn-pay { background: #16a34a; color: #ffffff; &:hover { background: #15803d; } }

    .completed-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #16a34a;
      .check-icon { font-size: 20px; }
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 420px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      align-items: center;
      h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
      .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; }
    }

    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .total-to-pay {
      background: #f8fafc;
      border-radius: 10px;
      padding: 12px;
      text-align: center;
      .total-label { display: block; font-size: 12px; color: #64748b; }
      .total-number { font-size: 24px; font-weight: 800; color: #0f172a; }
    }

    .qr-box {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      .qr-icon { font-size: 80px; color: #1e293b; }
      .qr-sub { font-size: 12px; color: #64748b; margin: 4px 0 8px; }
      .qr-key { font-size: 13px; color: #0f172a; }
    }

    .pay-actions-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-whatsapp-pay {
      background: #25d366;
      color: #ffffff;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    .btn-confirm-cash {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    .inventory-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 250px;
      overflow-y: auto;
    }

    .inventory-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .item-name {
      display: flex;
      flex-direction: column;
      strong { font-size: 13px; color: #0f172a; }
      .item-cat { font-size: 11px; color: #64748b; }
    }

    .qty-pill {
      background: #dbeafe;
      color: #1e40af;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
    }

    .w-full { width: 100%; }

    @media (max-width: 600px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .nav-buttons-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class OndemandRouteComponent {
  private router = inject(Router);
  auth = inject(AuthService);

  showInventoryModal = signal(false);
  activePaymentVisit = signal<HomeVisitAppointment | null>(null);

  appointments = signal<HomeVisitAppointment[]>([
    {
      id: 'dom-1',
      tutorName: 'Carlos Gómez',
      tutorPhone: '3124567890',
      patientId: 'p1',
      patientName: 'Toby',
      patientSpecies: 'dog',
      patientBreed: 'Golden Retriever',
      serviceType: 'Vacunación Múltiple + Chequeo General',
      address: 'Calle 100 #15-30, Apto 402',
      city: 'Bogotá',
      notesAddress: 'Timbre dañado, llamar al llegar',
      travelFee: 25000,
      serviceFee: 85000,
      scheduledTime: '09:00 AM',
      trackingStatus: 'on_the_way',
      paymentStatus: 'pending'
    },
    {
      id: 'dom-2',
      tutorName: 'María Rodríguez',
      tutorPhone: '3157891234',
      patientId: 'p2',
      patientName: 'Luna',
      patientSpecies: 'cat',
      patientBreed: 'Siamés',
      serviceType: 'Toma de Muestra de Sangre & Perfil Renal',
      address: 'Carrera 7 #127-45, Torre 2 Apto 801',
      city: 'Bogotá',
      travelFee: 20000,
      serviceFee: 110000,
      scheduledTime: '11:30 AM',
      trackingStatus: 'assigned',
      paymentStatus: 'pending'
    },
    {
      id: 'dom-3',
      tutorName: 'Andrés Morales',
      tutorPhone: '3001234567',
      patientId: 'p3',
      patientName: 'Simba',
      patientSpecies: 'dog',
      patientBreed: 'Bulldog Francés',
      serviceType: 'Desparasitación & Fórmulas Respiratorias',
      address: 'Calle 140 #9-20',
      city: 'Bogotá',
      travelFee: 15000,
      serviceFee: 75000,
      scheduledTime: '02:00 PM',
      trackingStatus: 'assigned',
      paymentStatus: 'pending'
    }
  ]);

  mobileInventory = signal<MobileInventoryItem[]>([
    { id: 'inv-1', name: 'Vacuna Séxtuple Canina (Nobivac)', category: 'Biológicos', quantity: 5, unit: 'dosis' },
    { id: 'inv-2', name: 'Vacuna Triple Felina', category: 'Biológicos', quantity: 3, unit: 'dosis' },
    { id: 'inv-3', name: 'Microchip ISO Identificación', category: 'Insumos', quantity: 4, unit: 'und' },
    { id: 'inv-4', name: 'Jeringas 3ml + Aguja 21G', category: 'Descartables', quantity: 20, unit: 'und' },
    { id: 'inv-5', name: 'Tubos Vacutainer Tapa Lila (EDTA)', category: 'Laboratorio', quantity: 10, unit: 'und' },
    { id: 'inv-6', name: 'Metoclopramida 10mg Ampollas', category: 'Fármacos', quantity: 4, unit: 'amp' },
    { id: 'inv-7', name: 'Meloxicam 0.5% Gotas Orales', category: 'Fármacos', quantity: 2, unit: 'frasco' }
  ]);

  pendingCount = computed(() => this.appointments().filter(a => a.trackingStatus !== 'completed').length);
  completedCount = computed(() => this.appointments().filter(a => a.trackingStatus === 'completed').length);
  totalEarnings = computed(() =>
    this.appointments()
      .filter(a => a.trackingStatus === 'completed')
      .reduce((acc, curr) => acc + curr.serviceFee + curr.travelFee, 0)
  );

  formatTrackingStatus(status: string): string {
    switch (status) {
      case 'assigned': return 'Asignado';
      case 'on_the_way': return 'En Camino 🛵';
      case 'arrived': return 'En la Puerta 🚪';
      case 'in_progress': return 'En Consulta 🩺';
      case 'completed': return 'Finalizado ✅';
      default: return status;
    }
  }

  getWazeUrl(address: string): string {
    return `https://waze.com/ul?q=${encodeURIComponent(address + ', Colombia')}&navigate=yes`;
  }

  getGoogleMapsUrl(address: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Colombia')}`;
  }

  updateStatus(id: string, newStatus: any) {
    this.appointments.update(list =>
      list.map(item => item.id === id ? { ...item, trackingStatus: newStatus } : item)
    );
  }

  openAiRecord(patientId: string) {
    this.router.navigate(['/medical-records/new', patientId]);
  }

  openPaymentModal(visit: HomeVisitAppointment) {
    this.activePaymentVisit.set(visit);
  }

  sendPaymentWhatsApp(visit: HomeVisitAppointment) {
    const total = visit.serviceFee + visit.travelFee;
    const text = encodeURIComponent(
      `Hola ${visit.tutorName}, gracias por atender a ${visit.patientName}. Aquí puedes pagar el valor de $${total.toLocaleString()} COP de tu consulta a domicilio: https://pay.wompi.co/l/vetpro-${visit.id}`
    );
    window.open(`https://wa.me/57${visit.tutorPhone.replace(/\\D/g, '')}?text=${text}`, '_blank');
  }

  confirmPaymentReceived(id: string) {
    this.appointments.update(list =>
      list.map(item =>
        item.id === id
          ? { ...item, trackingStatus: 'completed', paymentStatus: 'paid' }
          : item
      )
    );
    this.activePaymentVisit.set(null);
  }
}
