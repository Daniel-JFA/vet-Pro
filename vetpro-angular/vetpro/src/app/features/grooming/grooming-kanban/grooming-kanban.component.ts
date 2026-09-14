import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroomingService, GroomingItem } from '../../../core/services/grooming.service';

@Component({
  selector: 'app-grooming-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grooming-page">
      <!-- Header -->
      <div class="grooming-header">
        <div>
          <div class="badge-spa">✂️ ESTÉTICA CANINA, FELINA & SPA</div>
          <h1 class="page-title">Flujo de Peluquería & Notificaciones WhatsApp</h1>
          <p class="page-subtitle">Seguimiento por estaciones (baño, corte, acabado) y aviso automatizado por WhatsApp al tutor cuando la mascota está lista.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="openCheckInModal()">
            <span class="material-symbols-outlined">add_circle</span>
            Ingresar a Spa
          </button>
        </div>
      </div>

      <!-- Kanban Pipeline Grid -->
      <div class="kanban-board">
        <!-- 1. RECIBIDO -->
        <div class="kanban-col">
          <div class="col-header checked_in">
            <span>📥 Recibido ({{ getByStatus('checked_in').length }})</span>
          </div>
          <div class="cards-list">
            <div *ngFor="let item of getByStatus('checked_in')" class="pet-card">
              <div class="card-top">
                <span class="pet-emoji">{{ item.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                <div>
                  <h4 class="card-name">{{ item.patient.name }}</h4>
                  <span class="card-sub">{{ item.patient.breed || 'Mestizo' }}</span>
                </div>
              </div>
              <div class="card-body">
                <p class="service-type"><strong>{{ item.serviceType }}</strong></p>
                <p *ngIf="item.medicatedShampoo" class="shampoo-tag">🧴 {{ item.medicatedShampoo }}</p>
                <p class="tutor-phone">👤 {{ item.patient.tutor.firstName }} • 📱 {{ item.patient.tutor.phone }}</p>
              </div>
              <div class="card-actions">
                <button class="btn-step" (click)="advanceStatus(item, 'bathing')">
                  Pasar a Baño 🛁 ➔
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. EN BAÑO -->
        <div class="kanban-col">
          <div class="col-header bathing">
            <span>🛁 En Baño ({{ getByStatus('bathing').length }})</span>
          </div>
          <div class="cards-list">
            <div *ngFor="let item of getByStatus('bathing')" class="pet-card">
              <div class="card-top">
                <span class="pet-emoji">{{ item.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                <div>
                  <h4 class="card-name">{{ item.patient.name }}</h4>
                  <span class="card-sub">{{ item.patient.breed || 'Mestizo' }}</span>
                </div>
              </div>
              <div class="card-body">
                <p class="service-type"><strong>{{ item.serviceType }}</strong></p>
                <p *ngIf="item.medicatedShampoo" class="shampoo-tag">🧴 {{ item.medicatedShampoo }}</p>
              </div>
              <div class="card-actions">
                <button class="btn-step" (click)="advanceStatus(item, 'drying_styling')">
                  Secado & Corte ✂️ ➔
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. SECADO Y CORTE -->
        <div class="kanban-col">
          <div class="col-header drying">
            <span>✂️ Secado & Corte ({{ getByStatus('drying_styling').length }})</span>
          </div>
          <div class="cards-list">
            <div *ngFor="let item of getByStatus('drying_styling')" class="pet-card">
              <div class="card-top">
                <span class="pet-emoji">{{ item.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                <div>
                  <h4 class="card-name">{{ item.patient.name }}</h4>
                  <span class="card-sub">{{ item.patient.breed || 'Mestizo' }}</span>
                </div>
              </div>
              <div class="card-body">
                <p class="service-type"><strong>{{ item.serviceType }}</strong></p>
                <p *ngIf="item.behaviorNotes" class="note-pill">⚠️ {{ item.behaviorNotes }}</p>
              </div>
              <div class="card-actions">
                <button class="btn-step btn-ready" (click)="advanceStatus(item, 'ready_for_pickup')">
                  ¡Listo para Recoger! 🔔 ➔
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. LISTO PARA RECOGER (ALERTA WHATSAPP) -->
        <div class="kanban-col">
          <div class="col-header ready">
            <span>🔔 Listo p/ Recoger ({{ getByStatus('ready_for_pickup').length }})</span>
          </div>
          <div class="cards-list">
            <div *ngFor="let item of getByStatus('ready_for_pickup')" class="pet-card ready-border">
              <div class="card-top">
                <span class="pet-emoji">{{ item.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                <div>
                  <h4 class="card-name">{{ item.patient.name }}</h4>
                  <span class="card-sub">{{ item.patient.breed || 'Mestizo' }}</span>
                </div>
              </div>
              <div class="card-body">
                <p class="ready-alert">✨ ¡Sesión finalizada y perfumado!</p>
                <p class="tutor-phone">👤 {{ item.patient.tutor.firstName }} • {{ item.patient.tutor.phone }}</p>
              </div>
              <div class="card-actions vertical">
                <button class="btn-whatsapp" (click)="sendWhatsAppNotice(item)">
                  💬 Enviar WhatsApp al Tutor
                </button>
                <button class="btn-step btn-delivered" (click)="advanceStatus(item, 'delivered')">
                  Marcar Entregado ✓
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. ENTREGADO -->
        <div class="kanban-col">
          <div class="col-header delivered">
            <span>✅ Entregado ({{ getByStatus('delivered').length }})</span>
          </div>
          <div class="cards-list">
            <div *ngFor="let item of getByStatus('delivered')" class="pet-card delivered-dim">
              <div class="card-top">
                <span class="pet-emoji">{{ item.patient.species === 'cat' ? '🐱' : '🐶' }}</span>
                <div>
                  <h4 class="card-name">{{ item.patient.name }}</h4>
                  <span class="card-sub">{{ item.serviceType }} • {{ item.price | currency:'COP':'$':'1.0-0' }}</span>
                </div>
              </div>
              <p class="delivered-time">Entregado con éxito ✓</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .grooming-page { padding: 24px; max-width: 1440px; margin: 0 auto; }
    .grooming-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .badge-spa { font-size: 11px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 6px; }
    .page-title { margin: 0 0 6px; font-size: 24px; font-weight: 800; color: #0f172a; }
    .page-subtitle { margin: 0; font-size: 13px; color: #64748b; max-width: 700px; }
    .btn-primary { background: #d97706; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; display: flex; align-items: center; gap: 6px; &:hover { background: #b45309; } }
    .kanban-board { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; overflow-x: auto; min-height: 500px; }
    .kanban-col { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
    .col-header { padding: 12px 14px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
    .col-header.checked_in { background: #f1f5f9; color: #475569; }
    .col-header.bathing { background: #e0f2fe; color: #0369a1; }
    .col-header.drying { background: #fef3c7; color: #b45309; }
    .col-header.ready { background: #fce7f3; color: #be185d; }
    .col-header.delivered { background: #dcfce7; color: #15803d; }
    .cards-list { padding: 12px; display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; }
    .pet-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .pet-card.ready-border { border: 2px solid #ec4899; }
    .pet-card.delivered-dim { opacity: 0.7; }
    .card-top { display: flex; align-items: center; gap: 8px; }
    .pet-emoji { font-size: 22px; }
    .card-name { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    .card-sub { font-size: 11px; color: #64748b; }
    .service-type { margin: 0; font-size: 12px; color: #334155; }
    .shampoo-tag { margin: 2px 0 0; font-size: 11px; color: #0284c7; background: #f0f9ff; padding: 2px 6px; border-radius: 4px; display: inline-block; }
    .note-pill { margin: 2px 0 0; font-size: 11px; color: #b45309; }
    .tutor-phone { margin: 4px 0 0; font-size: 11px; color: #64748b; }
    .card-actions { display: flex; gap: 6px; margin-top: 4px; }
    .card-actions.vertical { flex-direction: column; }
    .btn-step { width: 100%; padding: 6px 10px; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; text-align: center; &:hover { background: #e2e8f0; } }
    .btn-step.btn-ready { background: #fdf2f8; color: #db2777; border-color: #fbcfe8; }
    .btn-step.btn-delivered { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
    .btn-whatsapp { width: 100%; padding: 7px; font-size: 11px; font-weight: 700; background: #25d366; color: #fff; border: none; border-radius: 6px; cursor: pointer; text-align: center; &:hover { background: #1eb956; } }
    .ready-alert { font-size: 11px; font-weight: 700; color: #db2777; margin: 0; }
    .delivered-time { font-size: 11px; color: #16a34a; font-weight: 600; margin: 4px 0 0; }
  `]
})
export class GroomingKanbanComponent implements OnInit {
  private groomingService = inject(GroomingService);

  services = signal<GroomingItem[]>([
    {
      id: 'g-1',
      patientId: 'p1',
      patient: { id: 'p1', name: 'Max', species: 'dog', breed: 'Shih Tzu', tutor: { id: 't1', firstName: 'Laura', lastName: 'Restrepo', phone: '3104561234' } },
      branch: { id: 'b1', name: 'Sede Principal' },
      serviceType: 'Baño Completo + Corte Asiático',
      medicatedShampoo: 'Aroma Lavanda',
      status: 'checked_in',
      price: 55000,
      checkedInAt: new Date().toISOString()
    },
    {
      id: 'g-2',
      patientId: 'p2',
      patient: { id: 'p2', name: 'Copito', species: 'cat', breed: 'Persa', tutor: { id: 't2', firstName: 'Juan', lastName: 'Botero', phone: '3209876543' } },
      branch: { id: 'b1', name: 'Sede Principal' },
      serviceType: 'Deslanado Profundo y Baño Seco',
      status: 'bathing',
      price: 65000,
      checkedInAt: new Date().toISOString()
    },
    {
      id: 'g-3',
      patientId: 'p3',
      patient: { id: 'p3', name: 'Rocky', species: 'dog', breed: 'Schnauzer', tutor: { id: 't3', firstName: 'Sofía', lastName: 'Dávila', phone: '3167894561' } },
      branch: { id: 'b1', name: 'Sede Principal' },
      serviceType: 'Corte Estándar de Raza Schnauzer',
      behaviorNotes: 'Nervioso en patas',
      status: 'drying_styling',
      price: 50000,
      checkedInAt: new Date().toISOString()
    },
    {
      id: 'g-4',
      patientId: 'p4',
      patient: { id: 'p4', name: 'Milo', species: 'dog', breed: 'Poodle', tutor: { id: 't4', firstName: 'Esteban', lastName: 'Duque', phone: '3112345678' } },
      branch: { id: 'b1', name: 'Sede Principal' },
      serviceType: 'Baño Medicado Dermatológico',
      medicatedShampoo: 'Clorhexidina 3%',
      status: 'ready_for_pickup',
      price: 60000,
      checkedInAt: new Date().toISOString()
    }
  ]);

  ngOnInit() {
    this.loadServices();
  }

  loadServices() {
    this.groomingService.getServices().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.services.set(data);
        }
      },
      error: (e) => console.warn('[Grooming] Usando estado local:', e)
    });
  }

  getByStatus(status: string): GroomingItem[] {
    return this.services().filter(s => s.status === status);
  }

  advanceStatus(item: GroomingItem, newStatus: any) {
    this.groomingService.updateStatus(item.id, { status: newStatus }).subscribe({
      next: (res) => {
        this.services.update(list => list.map(s => s.id === item.id ? { ...s, status: newStatus } : s));
        if (res.whatsappNotification) {
          if (confirm(`¡Mascota lista! ¿Desea abrir WhatsApp para notificar a ${item.patient.tutor.firstName}?`)) {
            window.open(res.whatsappNotification.waLink, '_blank');
          }
        }
      },
      error: () => {
        this.services.update(list => list.map(s => s.id === item.id ? { ...s, status: newStatus } : s));
      }
    });
  }

  sendWhatsAppNotice(item: GroomingItem) {
    const phone = item.patient.tutor.phone.replace(/[^0-9]/g, '');
    const message = `¡Hola ${item.patient.tutor.firstName}! 🛁 Te contamos que ${item.patient.name} ya terminó su sesión de spa en la veterinaria y está listo(a) para que lo recojas. ¡Quedó hermoso(a) y oliendo delicioso! ✨🐾`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  openCheckInModal() {
    alert('Ingreso a peluquería: Seleccione un paciente en recepción o cita para iniciar su sesión de spa.');
  }
}
