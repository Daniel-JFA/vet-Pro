import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { WalkBooking, WalkStatus } from '../../../core/models';

const STATUS_LABELS: Record<WalkStatus, string> = {
  requested:  'Solicitado',
  assigned:   'Asignado',
  confirmed:  'Confirmado',
  on_the_way: 'En camino',
  walking:    'En paseo activo',
  completed:  'Completado',
  cancelled:  'Cancelado'
};

@Component({
  selector: 'app-walker-schedule',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-title">Mis Paseos</h1>
          <p class="page-subtitle">Hola, {{ auth.currentUser?.firstName }} — aquí están tus paseos asignados</p>
        </div>
      </div>

      <!-- Stats rápidos -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ pendingCount() }}</span>
          <span class="stat-label">Pendientes hoy</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ activeWalk() ? '1' : '0' }}</span>
          <span class="stat-label">En progreso</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ completedToday() }}</span>
          <span class="stat-label">Completados hoy</span>
        </div>
      </div>

      <!-- Paseo activo -->
      <div class="active-walk-card" *ngIf="activeWalk() as w">
        <div class="active-label">
          <span class="pulse-dot"></span> Paseo en curso
        </div>
        <div class="active-walk-info">
          <p class="active-address">📍 {{ w.address }}</p>
          <p class="active-time">Inicio: {{ w.startedAt | date:'HH:mm' }} — {{ w.durationMins }} min</p>
        </div>
        <button class="btn-complete" (click)="completeWalk(w.id)">
          <span class="material-symbols-outlined">check_circle</span> Finalizar paseo
        </button>
      </div>

      <!-- Lista de paseos -->
      <div *ngIf="loading()" class="loading-state">
        <span class="material-symbols-outlined spin">sync</span> Cargando paseos…
      </div>

      <div *ngIf="!loading()">
        <div *ngFor="let walk of bookings()" class="walk-card" [class]="'status-' + walk.status">
          <div class="walk-time">
            <span class="time-main">{{ walk.scheduledAt | date:'HH:mm' }}</span>
            <span class="time-date">{{ walk.scheduledAt | date:'EEE dd/MM' }}</span>
          </div>
          <div class="walk-body">
            <p class="walk-address">📍 {{ walk.address }}</p>
            <p class="walk-duration">⏱ {{ walk.durationMins }} min · {{ walk.price | currency:'COP':'symbol-narrow':'1.0-0' }}</p>
            <p class="walk-notes" *ngIf="walk.notes">💬 {{ walk.notes }}</p>
          </div>
          <div class="walk-status-col">
            <span class="status-pill" [class]="'pill-' + walk.status">
              {{ getStatusLabel(walk.status) }}
            </span>
            <button class="btn-start" *ngIf="walk.status === 'assigned' || walk.status === 'confirmed'"
                    (click)="startWalk(walk.id)">
              Iniciar
            </button>
          </div>
        </div>

        <div *ngIf="bookings().length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">directions_walk</span>
          <p>No tienes paseos asignados por ahora.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 24px; max-width: 800px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    .page-subtitle { color: #6b7280; margin: 0; }

    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                 padding: 20px; text-align: center; }
    .stat-value { display: block; font-size: 32px; font-weight: 700; color: #4f46e5; }
    .stat-label { font-size: 13px; color: #6b7280; }

    .active-walk-card { background: linear-gradient(135deg, #10b981, #059669);
                        color: #fff; border-radius: 12px; padding: 20px;
                        display: flex; align-items: center; gap: 16px;
                        margin-bottom: 24px; }
    .active-label { display: flex; align-items: center; gap: 8px; font-weight: 700;
                    font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;
                    white-space: nowrap; }
    .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: #fff;
                 animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .active-walk-info { flex: 1; }
    .active-address { margin: 0; font-size: 16px; font-weight: 600; }
    .active-time { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    .btn-complete { background: #fff; color: #059669; border: none; border-radius: 8px;
                    padding: 10px 16px; font-weight: 700; cursor: pointer;
                    display: flex; align-items: center; gap: 6px; white-space: nowrap; }

    .walk-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                 padding: 16px; display: flex; gap: 16px; align-items: flex-start;
                 margin-bottom: 12px; }
    .walk-card.status-completed { opacity: 0.6; }
    .walk-card.status-cancelled { opacity: 0.5; border-style: dashed; }
    .walk-time { text-align: center; min-width: 56px; }
    .time-main { display: block; font-size: 20px; font-weight: 700; color: #4f46e5; }
    .time-date { display: block; font-size: 11px; color: #9ca3af; }
    .walk-body { flex: 1; }
    .walk-address { margin: 0 0 4px; font-weight: 500; }
    .walk-duration { margin: 0 0 4px; color: #6b7280; font-size: 13px; }
    .walk-notes { margin: 0; font-size: 12px; color: #6b7280; font-style: italic; }
    .walk-status-col { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }

    .status-pill { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .pill-requested  { background: #fef3c7; color: #92400e; }
    .pill-assigned   { background: #dbeafe; color: #1e40af; }
    .pill-confirmed  { background: #ede9fe; color: #5b21b6; }
    .pill-on_the_way { background: #cffafe; color: #155e75; }
    .pill-walking    { background: #d1fae5; color: #065f46; }
    .pill-completed  { background: #f3f4f6; color: #374151; }
    .pill-cancelled  { background: #fee2e2; color: #991b1b; }

    .btn-start { background: #4f46e5; color: #fff; border: none; border-radius: 8px;
                 padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }

    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
    .empty-icon { font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.4; }
    .spin { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class WalkerScheduleComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  bookings = signal<WalkBooking[]>([]);
  loading = signal(false);

  activeWalk = () => this.bookings().find(b => b.status === 'walking') ?? null;
  pendingCount = () => this.bookings().filter(b => ['assigned', 'confirmed'].includes(b.status)).length;
  completedToday = () => {
    const today = new Date().toDateString();
    return this.bookings().filter(b =>
      b.status === 'completed' && new Date(b.completedAt!).toDateString() === today
    ).length;
  };

  ngOnInit() {
    this.loading.set(true);
    this.api.get<WalkBooking[]>('/v1/walkers/bookings').subscribe({
      next: data => { this.bookings.set(data); this.loading.set(false); },
      error: () => { this.bookings.set(this.demoBookings()); this.loading.set(false); }
    });
  }

  startWalk(id: string) {
    this.api.patch<WalkBooking>(`/v1/walkers/bookings/${id}/status`, { status: 'walking' }).subscribe({
      next: updated => this.bookings.update(list => list.map(b => b.id === id ? updated : b)),
      error: () => this.bookings.update(list => list.map(b => b.id === id ? { ...b, status: 'walking' as WalkStatus, startedAt: new Date() } : b))
    });
  }

  completeWalk(id: string) {
    this.api.patch<WalkBooking>(`/v1/walkers/bookings/${id}/status`, { status: 'completed' }).subscribe({
      next: updated => this.bookings.update(list => list.map(b => b.id === id ? updated : b)),
      error: () => this.bookings.update(list => list.map(b => b.id === id ? { ...b, status: 'completed' as WalkStatus, completedAt: new Date() } : b))
    });
  }

  getStatusLabel(status: WalkStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  private demoBookings(): WalkBooking[] {
    const now = new Date();
    const in1h = new Date(now.getTime() + 3600000);
    return [
      { id: 'wb1', clinicId: 'dev-clinic', tutorId: 't1',
        tutor: { id: 't1', clinicId: 'dev-clinic', firstName: 'Camila', lastName: 'Torres',
                 phone: '3001234567', createdAt: now },
        walkerId: 'dev-walker', patientIds: ['p1'],
        scheduledAt: in1h, durationMins: 30, address: 'Calle 10 #43-20, Laureles',
        status: 'assigned', price: 20000, notes: 'Max es muy juguetón, usar correa doble.',
        photos: [], createdAt: now }
    ];
  }
}
