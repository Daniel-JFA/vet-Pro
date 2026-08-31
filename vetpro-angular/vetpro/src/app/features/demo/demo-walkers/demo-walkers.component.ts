import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DemoDataService } from '../demo-data.service';

interface LocalBooking {
  id: string;
  clinicId: string;
  tutorId: string;
  walkerId: string;
  patientIds: string[];
  scheduledAt: Date;
  durationMins: number;
  address: string;
  status: string;
  price: number;
  notes?: string;
  rating?: number;
  review?: string;
  tutor?: { firstName: string; lastName: string };
}

@Component({
  selector: 'app-demo-walkers',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="walkers">
      @if (isWalkerRole()) {
        <!-- Walker perspective: only their own bookings -->
        <div class="walkers__header">
          <h1 class="walkers__title">Mis Paseos</h1>
          <p class="walkers__subtitle">Vista del paseador — Sebastián Ospina</p>
        </div>

        <div class="bookings-list">
          @for (booking of myBookings(); track booking.id) {
            <div class="booking-card">
              <div class="booking-card__header">
                <div class="booking-card__tutor">
                  <span class="booking-card__icon">🐕</span>
                  <div>
                    <div class="booking-card__owner">{{ booking.tutor?.firstName }} {{ booking.tutor?.lastName }}</div>
                    <div class="booking-card__address">{{ booking.address }}</div>
                  </div>
                </div>
                <span class="badge" [class]="getBookingStatusClass(booking.status)">
                  {{ getBookingStatusLabel(booking.status) }}
                </span>
              </div>
              <div class="booking-card__meta">
                <span>{{ booking.durationMins }} min</span>
                <span class="booking-card__price">{{ booking.price | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
              </div>
              <div class="booking-card__actions">
                @if (booking.status === 'assigned') {
                  <button class="btn btn--primary" (click)="startWalk(booking.id)">Iniciar paseo</button>
                }
                @if (booking.status === 'walking') {
                  <button class="btn btn--success" (click)="completeWalk(booking.id)">Completar paseo</button>
                }
                @if (booking.status === 'completed') {
                  <span class="completed-label">Paseo completado</span>
                }
              </div>
            </div>
          }

          @if (myBookings().length === 0) {
            <div class="empty-state">
              <span class="empty-state__icon">🐕</span>
              <p class="empty-state__text">No tienes paseos asignados por el momento.</p>
            </div>
          }
        </div>

      } @else {
        <!-- Admin/vet perspective: full management view -->
        <div class="walkers__header">
          <h1 class="walkers__title">Paseadores</h1>
          <p class="walkers__subtitle">Gestion de domicilios y paseadores</p>
        </div>

        <!-- Walker profile cards -->
        <section class="section">
          <h2 class="section__title">Equipo de paseadores</h2>
          <div class="walkers-grid">
            @for (walker of demoData.walkers; track walker.id) {
              <div class="walker-card">
                <div class="walker-card__avatar">
                  {{ walker.user.firstName.charAt(0) }}{{ walker.user.lastName.charAt(0) }}
                </div>
                <div class="walker-card__body">
                  <div class="walker-card__name">{{ walker.user.firstName }} {{ walker.user.lastName }}</div>
                  <div class="walker-card__bio">{{ walker.bio }}</div>
                  <div class="walker-card__stats">
                    <div class="walker-stat">
                      <span class="walker-stat__value">{{ walker.rating }}</span>
                      <span class="walker-stat__label">Calificacion</span>
                    </div>
                    <div class="walker-stat">
                      <span class="walker-stat__value">{{ walker.totalWalks }}</span>
                      <span class="walker-stat__label">Paseos</span>
                    </div>
                    <div class="walker-stat">
                      <span class="walker-stat__value">{{ walker.pricePerHour | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                      <span class="walker-stat__label">Por hora</span>
                    </div>
                    <div class="walker-stat">
                      <span class="walker-stat__value">{{ walker.maxDogs }}</span>
                      <span class="walker-stat__label">Max. perros</span>
                    </div>
                  </div>
                  <div class="walker-card__zones">
                    @for (zone of walker.coverageZones; track zone) {
                      <span class="zone-tag">{{ zone }}</span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- All bookings -->
        <section class="section">
          <h2 class="section__title">Reservas activas y recientes</h2>
          <div class="bookings-list">
            @for (booking of walkBookings(); track booking.id) {
              <div class="booking-card">
                <div class="booking-card__header">
                  <div class="booking-card__tutor">
                    <span class="booking-card__icon">🐕</span>
                    <div>
                      <div class="booking-card__owner">{{ booking.tutor?.firstName }} {{ booking.tutor?.lastName }}</div>
                      <div class="booking-card__address">{{ booking.address }}</div>
                    </div>
                  </div>
                  <span class="badge" [class]="getBookingStatusClass(booking.status)">
                    {{ getBookingStatusLabel(booking.status) }}
                  </span>
                </div>

                <div class="booking-card__meta">
                  <span class="booking-card__walker-label">Paseador: {{ getWalkerName(booking.walkerId) }}</span>
                  <span>{{ booking.durationMins }} min</span>
                  <span class="booking-card__price">{{ booking.price | currency:'COP':'symbol-narrow':'1.0-0' }}</span>
                </div>

                <div class="booking-card__actions">
                  @if (booking.status === 'assigned') {
                    <button class="btn btn--primary" (click)="startWalk(booking.id)">Iniciar paseo</button>
                  }
                  @if (booking.status === 'walking') {
                    <button class="btn btn--success" (click)="completeWalk(booking.id)">Completar paseo</button>
                  }
                  @if (booking.status === 'completed') {
                    <span class="completed-label">Completado</span>
                    @if (booking.rating) {
                      <span class="rating-label">Calificacion: {{ booking.rating }}/5</span>
                    }
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .walkers__title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
    .walkers__subtitle { color: #64748b; font-size: 14px; margin: 0 0 24px; }
    .walkers__header { margin-bottom: 8px; }

    .section { margin-bottom: 32px; }
    .section__title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }

    /* Walker grid */
    .walkers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; margin-bottom: 0; }
    .walker-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); padding: 20px; display: flex; gap: 16px; }
    .walker-card__avatar { width: 52px; height: 52px; min-width: 52px; border-radius: 50%; background: #f59e0b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; }
    .walker-card__body { flex: 1; }
    .walker-card__name { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .walker-card__bio { font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 12px; }
    .walker-card__stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .walker-stat { text-align: center; }
    .walker-stat__value { display: block; font-size: 14px; font-weight: 700; color: #1e293b; }
    .walker-stat__label { display: block; font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .walker-card__zones { display: flex; flex-wrap: wrap; gap: 6px; }
    .zone-tag { background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }

    /* Bookings */
    .bookings-list { display: flex; flex-direction: column; gap: 12px; }
    .booking-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); padding: 16px 20px; }
    .booking-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .booking-card__tutor { display: flex; align-items: center; gap: 10px; flex: 1; }
    .booking-card__icon { font-size: 28px; }
    .booking-card__owner { font-weight: 600; color: #1e293b; font-size: 14px; }
    .booking-card__address { font-size: 12px; color: #64748b; }
    .booking-card__meta { display: flex; align-items: center; gap: 16px; font-size: 13px; color: #64748b; margin-bottom: 12px; }
    .booking-card__walker-label { flex: 1; font-weight: 500; }
    .booking-card__price { font-weight: 700; color: #22c55e; }
    .booking-card__actions { display: flex; align-items: center; gap: 10px; }

    /* Buttons */
    .btn { padding: 8px 18px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .btn--primary { background: #f59e0b; color: #fff; }
    .btn--primary:hover { background: #d97706; }
    .btn--success { background: #22c55e; color: #fff; }
    .btn--success:hover { background: #16a34a; }
    .completed-label { color: #22c55e; font-size: 13px; font-weight: 600; }
    .rating-label { color: #f59e0b; font-size: 13px; font-weight: 600; }

    /* Badges */
    .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .badge--walking { background: #dbeafe; color: #1d4ed8; }
    .badge--assigned { background: #fef9c3; color: #854d0e; }
    .badge--completed { background: #dcfce7; color: #166534; }
    .badge--requested { background: #f1f5f9; color: #475569; }
    .badge--cancelled { background: #fee2e2; color: #991b1b; }

    /* Empty state */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; background: #fff; border-radius: 12px; color: #94a3b8; }
    .empty-state__icon { font-size: 48px; }
    .empty-state__text { font-size: 15px; color: #64748b; }
  `]
})
export class DemoWalkersComponent {
  demoData = inject(DemoDataService);

  walkBookings = signal<LocalBooking[]>(
    this.demoData.walkBookings.map(b => ({ ...b })) as LocalBooking[]
  );

  isWalkerRole = computed(() => this.demoData.currentRole() === 'walker');

  // Walker perspective: only show assigned/walking bookings for walker w1
  myBookings = computed(() =>
    this.walkBookings().filter(b => b.walkerId === 'w1' && b.status !== 'completed')
  );

  startWalk(id: string): void {
    this.walkBookings.update(bookings =>
      bookings.map(b => b.id === id ? { ...b, status: 'walking' } : b)
    );
  }

  completeWalk(id: string): void {
    this.walkBookings.update(bookings =>
      bookings.map(b => b.id === id ? { ...b, status: 'completed' } : b)
    );
  }

  getWalkerName(walkerId: string): string {
    const w = this.demoData.walkers.find(x => x.id === walkerId);
    return w ? `${w.user.firstName} ${w.user.lastName}` : '—';
  }

  getBookingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      walking: 'En paseo',
      assigned: 'Asignado',
      completed: 'Completado',
      requested: 'Solicitado',
      confirmed: 'Confirmado',
      on_the_way: 'En camino',
      cancelled: 'Cancelado',
    };
    return labels[status] ?? status;
  }

  getBookingStatusClass(status: string): string {
    const classes: Record<string, string> = {
      walking: 'badge badge--walking',
      assigned: 'badge badge--assigned',
      completed: 'badge badge--completed',
      requested: 'badge badge--requested',
      cancelled: 'badge badge--cancelled',
    };
    return classes[status] ?? 'badge';
  }
}
