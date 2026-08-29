import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Walker, WalkBooking, WalkStatus } from '../../../core/models';

const STATUS_LABELS: Record<WalkStatus, string> = {
  requested:  'Solicitado',
  assigned:   'Asignado',
  confirmed:  'Confirmado',
  on_the_way: 'En camino',
  walking:    'En paseo',
  completed:  'Completado',
  cancelled:  'Cancelado'
};

const STATUS_COLOR: Record<WalkStatus, string> = {
  requested:  '#f59e0b',
  assigned:   '#3b82f6',
  confirmed:  '#8b5cf6',
  on_the_way: '#06b6d4',
  walking:    '#10b981',
  completed:  '#6b7280',
  cancelled:  '#ef4444'
};

@Component({
  selector: 'app-walkers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h1 class="page-title">Paseadores</h1>
          <p class="page-subtitle">Gestión de paseadores de perros y paseos programados</p>
        </div>
        <button class="btn-primary" (click)="showNewWalkerForm.set(true)">
          <span class="material-symbols-outlined">add</span> Nuevo paseador
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="activeTab() === 'walkers'" (click)="activeTab.set('walkers')">
          <span class="material-symbols-outlined">person</span> Paseadores ({{ walkers().length }})
        </button>
        <button class="tab" [class.active]="activeTab() === 'bookings'" (click)="activeTab.set('bookings')">
          <span class="material-symbols-outlined">directions_walk</span> Paseos ({{ bookings().length }})
        </button>
      </div>

      <!-- ── TAB: PASEADORES ── -->
      <div *ngIf="activeTab() === 'walkers'">
        <div *ngIf="loading()" class="loading-state">
          <span class="material-symbols-outlined spin">sync</span> Cargando paseadores…
        </div>

        <div *ngIf="!loading() && walkers().length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">directions_walk</span>
          <p>No hay paseadores registrados aún.</p>
          <button class="btn-primary" (click)="showNewWalkerForm.set(true)">Agregar primer paseador</button>
        </div>

        <div class="walkers-grid" *ngIf="!loading() && walkers().length > 0">
          <div class="walker-card" *ngFor="let w of walkers()">
            <div class="walker-avatar">
              <img *ngIf="w.photoUrl" [src]="w.photoUrl" [alt]="w.user?.firstName" />
              <span *ngIf="!w.photoUrl" class="avatar-initials">
                {{ w.user?.firstName?.[0] }}{{ w.user?.lastName?.[0] }}
              </span>
            </div>
            <div class="walker-info">
              <h3>{{ w.user?.firstName }} {{ w.user?.lastName }}</h3>
              <p class="walker-bio">{{ w.bio || 'Sin bio' }}</p>
              <div class="walker-stats">
                <span class="stat">
                  <span class="material-symbols-outlined">star</span>
                  {{ w.rating.toFixed(1) }}
                </span>
                <span class="stat">
                  <span class="material-symbols-outlined">pets</span>
                  {{ w.totalWalks }} paseos
                </span>
                <span class="stat">
                  <span class="material-symbols-outlined">attach_money</span>
                  {{ w.pricePerHour | currency:'COP':'symbol-narrow':'1.0-0' }}/h
                </span>
                <span class="stat">
                  <span class="material-symbols-outlined">group</span>
                  Máx. {{ w.maxDogs }} perros
                </span>
              </div>
              <div class="coverage-zones" *ngIf="w.coverageZones.length > 0">
                <span class="zone-chip" *ngFor="let z of w.coverageZones">{{ z }}</span>
              </div>
            </div>
            <div class="walker-actions">
              <span class="status-dot" [class.active]="w.active" [title]="w.active ? 'Activo' : 'Inactivo'"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── TAB: PASEOS ── -->
      <div *ngIf="activeTab() === 'bookings'">
        <div class="bookings-filters">
          <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilter()" class="filter-select">
            <option value="">Todos los estados</option>
            <option value="requested">Solicitados</option>
            <option value="assigned">Asignados</option>
            <option value="on_the_way">En camino</option>
            <option value="walking">En paseo</option>
            <option value="completed">Completados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        <div *ngIf="loadingBookings()" class="loading-state">
          <span class="material-symbols-outlined spin">sync</span> Cargando paseos…
        </div>

        <div *ngIf="!loadingBookings() && filteredBookings().length === 0" class="empty-state">
          <span class="material-symbols-outlined empty-icon">directions_walk</span>
          <p>No hay paseos registrados.</p>
        </div>

        <div class="bookings-table" *ngIf="!loadingBookings() && filteredBookings().length > 0">
          <table>
            <thead>
              <tr>
                <th>Fecha & Hora</th>
                <th>Tutor</th>
                <th>Paseador</th>
                <th>Duración</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let b of filteredBookings()">
                <td>{{ b.scheduledAt | date:'dd MMM yyyy HH:mm' }}</td>
                <td>{{ b.tutor?.firstName }} {{ b.tutor?.lastName }}</td>
                <td>{{ b.walker?.user?.firstName || '—' }}</td>
                <td>{{ b.durationMins }} min</td>
                <td>
                  <span class="status-badge" [style.background]="getStatusColor(b.status)">
                    {{ getStatusLabel(b.status) }}
                  </span>
                </td>
                <td>{{ b.price | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                <td>
                  <span *ngIf="b.rating">{{ b.rating }}/5 ⭐</span>
                  <span *ngIf="!b.rating" class="text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── MODAL: NUEVO PASEADOR ── -->
      <div class="modal-backdrop" *ngIf="showNewWalkerForm()" (click)="showNewWalkerForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nuevo Paseador</h2>
            <button class="close-btn" (click)="showNewWalkerForm.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-hint">
              El usuario debe existir con rol <strong>walker</strong>.
              Ingresa su ID o correo para crear su perfil de paseador.
            </p>
            <div class="form-group">
              <label>Correo del usuario walker</label>
              <input type="email" [(ngModel)]="newWalker.userEmail" placeholder="paseador@vetpro.co" />
            </div>
            <div class="form-group">
              <label>Bio</label>
              <textarea [(ngModel)]="newWalker.bio" rows="2" placeholder="Descripción del paseador…"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Precio/hora (COP)</label>
                <input type="number" [(ngModel)]="newWalker.pricePerHour" />
              </div>
              <div class="form-group">
                <label>Máx. perros por paseo</label>
                <input type="number" [(ngModel)]="newWalker.maxDogs" min="1" max="10" />
              </div>
            </div>
            <div class="form-group">
              <label>Zonas de cobertura (separadas por coma)</label>
              <input type="text" [(ngModel)]="newWalker.zonesRaw" placeholder="Laureles, El Poblado, Envigado" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showNewWalkerForm.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="createWalker()" [disabled]="savingWalker()">
              {{ savingWalker() ? 'Guardando…' : 'Crear paseador' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    .page-subtitle { color: #6b7280; margin: 0; }

    .tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
    .tab { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border: none; background: none;
           cursor: pointer; color: #6b7280; font-size: 14px; border-bottom: 2px solid transparent;
           transition: all 0.2s; }
    .tab.active { color: #4f46e5; border-bottom-color: #4f46e5; font-weight: 600; }
    .tab .material-symbols-outlined { font-size: 18px; }

    .walkers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .walker-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;
                   display: flex; gap: 16px; align-items: flex-start; }
    .walker-avatar { flex-shrink: 0; }
    .walker-avatar img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
    .avatar-initials { width: 56px; height: 56px; border-radius: 50%; background: #4f46e5;
                       color: #fff; display: flex; align-items: center; justify-content: center;
                       font-size: 20px; font-weight: 700; }
    .walker-info { flex: 1; }
    .walker-info h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .walker-bio { color: #6b7280; font-size: 13px; margin: 0 0 10px; }
    .walker-stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
    .stat { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #374151; }
    .stat .material-symbols-outlined { font-size: 16px; color: #4f46e5; }
    .coverage-zones { display: flex; flex-wrap: wrap; gap: 6px; }
    .zone-chip { background: #ede9fe; color: #5b21b6; font-size: 11px; padding: 2px 8px;
                 border-radius: 12px; font-weight: 500; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #d1d5db; }
    .status-dot.active { background: #10b981; }

    .bookings-filters { margin-bottom: 16px; }
    .filter-select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .bookings-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 12px; background: #f9fafb; color: #6b7280;
         font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px; border-top: 1px solid #f3f4f6; }
    .status-badge { display: inline-flex; padding: 3px 10px; border-radius: 12px;
                    color: #fff; font-size: 12px; font-weight: 600; }
    .text-muted { color: #9ca3af; }

    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }
    .empty-icon { font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.4; }
    .spin { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px;
                   background: #4f46e5; color: #fff; border: none; border-radius: 8px;
                   font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-primary:hover { background: #4338ca; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { padding: 10px 20px; background: #f3f4f6; color: #374151;
                     border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                      display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 480px;
             box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
    .modal-header { display: flex; justify-content: space-between; align-items: center;
                    padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
    .modal-header h2 { margin: 0; font-size: 18px; }
    .close-btn { border: none; background: none; cursor: pointer; color: #6b7280; }
    .modal-body { padding: 24px; }
    .modal-hint { background: #ede9fe; color: #5b21b6; padding: 12px; border-radius: 8px;
                  font-size: 13px; margin-bottom: 20px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid #e5e7eb;
                    display: flex; justify-content: flex-end; gap: 10px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151;
                        margin-bottom: 6px; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px 12px;
      border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class WalkersListComponent implements OnInit {
  private api = inject(ApiService);

  activeTab = signal<'walkers' | 'bookings'>('walkers');
  walkers = signal<Walker[]>([]);
  bookings = signal<WalkBooking[]>([]);
  loading = signal(false);
  loadingBookings = signal(false);
  showNewWalkerForm = signal(false);
  savingWalker = signal(false);
  filterStatus = '';

  filteredBookings = computed(() => {
    if (!this.filterStatus) return this.bookings();
    return this.bookings().filter(b => b.status === this.filterStatus);
  });

  newWalker = { userEmail: '', bio: '', pricePerHour: 25000, maxDogs: 3, zonesRaw: '' };

  ngOnInit() {
    this.loadWalkers();
    this.loadBookings();
  }

  loadWalkers() {
    this.loading.set(true);
    this.api.get<Walker[]>('/v1/walkers').subscribe({
      next: data => { this.walkers.set(data); this.loading.set(false); },
      error: () => {
        this.walkers.set(this.demoWalkers());
        this.loading.set(false);
      }
    });
  }

  loadBookings() {
    this.loadingBookings.set(true);
    this.api.get<WalkBooking[]>('/v1/walkers/bookings').subscribe({
      next: data => { this.bookings.set(data); this.loadingBookings.set(false); },
      error: () => { this.bookings.set([]); this.loadingBookings.set(false); }
    });
  }

  applyFilter() {}

  createWalker() {
    if (!this.newWalker.userEmail) return;
    this.savingWalker.set(true);
    const payload = {
      userEmail: this.newWalker.userEmail,
      bio: this.newWalker.bio,
      pricePerHour: this.newWalker.pricePerHour,
      maxDogs: this.newWalker.maxDogs,
      coverageZones: this.newWalker.zonesRaw.split(',').map(z => z.trim()).filter(Boolean)
    };
    this.api.post<Walker>('/v1/walkers', payload).subscribe({
      next: w => {
        this.walkers.update(list => [w, ...list]);
        this.showNewWalkerForm.set(false);
        this.savingWalker.set(false);
        this.newWalker = { userEmail: '', bio: '', pricePerHour: 25000, maxDogs: 3, zonesRaw: '' };
      },
      error: () => this.savingWalker.set(false)
    });
  }

  getStatusLabel(status: WalkStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status: WalkStatus): string {
    return STATUS_COLOR[status] ?? '#6b7280';
  }

  private demoWalkers(): Walker[] {
    return [
      {
        id: 'demo-w1', clinicId: 'dev-clinic', userId: 'dev-walker',
        user: { id: 'dev-walker', clinicId: 'dev-clinic', branchId: 'dev-branch',
                firstName: 'Juan', lastName: 'Pérez', email: 'paseador@vetpro.co',
                role: 'walker', active: true },
        bio: 'Apasionado por los animales, 3 años de experiencia en paseos grupales e individuales.',
        photoUrl: undefined, rating: 4.8, totalWalks: 127, pricePerHour: 25000,
        maxDogs: 3, coverageZones: ['Laureles', 'El Poblado', 'Envigado'], active: true,
        createdAt: new Date()
      }
    ];
  }
}
