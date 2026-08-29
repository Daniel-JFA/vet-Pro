import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoDataService } from '../demo-data.service';

@Component({
  selector: 'app-demo-patients',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="patients">
      <div class="patients__header">
        <h1 class="patients__title">Pacientes</h1>
        <p class="patients__subtitle">{{ filteredPatients().length }} pacientes encontrados</p>
      </div>

      <div class="search-bar">
        <span class="search-bar__icon">🔍</span>
        <input
          class="search-bar__input"
          type="text"
          placeholder="Buscar por nombre, raza o propietario..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
        />
        @if (search()) {
          <button class="search-bar__clear" (click)="clearSearch()">✕</button>
        }
      </div>

      <div class="patients-grid">
        @for (patient of filteredPatients(); track patient.id) {
          <div class="patient-card">
            <div class="patient-card__header">
              <span class="patient-card__species-icon">{{ patient.species === 'dog' ? '🐕' : '🐈' }}</span>
              <div class="patient-card__title-block">
                <div class="patient-card__name">{{ patient.name }}</div>
                <div class="patient-card__breed">{{ patient.breed }}</div>
              </div>
              <span class="badge" [class]="getStatusClass(patient.status)">
                {{ getStatusLabel(patient.status) }}
              </span>
            </div>

            <div class="patient-card__body">
              <div class="patient-card__row">
                <span class="patient-card__field-label">Especie</span>
                <span class="patient-card__field-value">{{ patient.species === 'dog' ? 'Perro' : 'Gato' }}</span>
              </div>
              <div class="patient-card__row">
                <span class="patient-card__field-label">Sexo</span>
                <span class="patient-card__field-value">{{ patient.sex === 'male' ? 'Macho' : 'Hembra' }}</span>
              </div>
              <div class="patient-card__row">
                <span class="patient-card__field-label">Peso</span>
                <span class="patient-card__field-value">{{ patient.weight }} kg</span>
              </div>
              @if (patient.sterilized) {
                <div class="patient-card__row">
                  <span class="patient-card__field-label">Esterilizado</span>
                  <span class="patient-card__field-value patient-card__field-value--yes">Si</span>
                </div>
              }
            </div>

            <div class="patient-card__footer">
              <span class="patient-card__owner-icon">👤</span>
              <span class="patient-card__owner">{{ patient.tutor?.firstName }} {{ patient.tutor?.lastName }}</span>
              <span class="patient-card__owner-phone">{{ patient.tutor?.phone }}</span>
            </div>
          </div>
        }

        @if (filteredPatients().length === 0) {
          <div class="empty-state">
            <span class="empty-state__icon">🔍</span>
            <p class="empty-state__text">No se encontraron pacientes con "{{ search() }}"</p>
            <button class="empty-state__btn" (click)="clearSearch()">Limpiar busqueda</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .patients__title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
    .patients__subtitle { color: #64748b; font-size: 14px; margin: 0 0 20px; }
    .patients__header { margin-bottom: 20px; }

    .search-bar {
      display: flex; align-items: center; gap: 10px;
      background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px;
      padding: 10px 16px; margin-bottom: 24px; transition: border-color 0.15s;
    }
    .search-bar:focus-within { border-color: #f59e0b; }
    .search-bar__icon { font-size: 16px; }
    .search-bar__input { flex: 1; border: none; outline: none; font-size: 14px; color: #1e293b; background: transparent; }
    .search-bar__input::placeholder { color: #94a3b8; }
    .search-bar__clear { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 14px; padding: 2px 6px; border-radius: 4px; }
    .search-bar__clear:hover { background: #f1f5f9; color: #475569; }

    .patients-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }

    .patient-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); overflow: hidden; transition: box-shadow 0.15s, transform 0.15s; border: 1.5px solid transparent; }
    .patient-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); border-color: #fde68a; }
    .patient-card__header { display: flex; align-items: center; gap: 12px; padding: 16px 16px 12px; border-bottom: 1px solid #f1f5f9; }
    .patient-card__species-icon { font-size: 32px; }
    .patient-card__title-block { flex: 1; }
    .patient-card__name { font-size: 16px; font-weight: 700; color: #1e293b; }
    .patient-card__breed { font-size: 12px; color: #64748b; }
    .patient-card__body { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
    .patient-card__row { display: flex; justify-content: space-between; align-items: center; }
    .patient-card__field-label { font-size: 12px; color: #94a3b8; font-weight: 500; }
    .patient-card__field-value { font-size: 13px; color: #334155; font-weight: 500; }
    .patient-card__field-value--yes { color: #22c55e; }
    .patient-card__footer { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #f8fafc; font-size: 12px; color: #64748b; }
    .patient-card__owner-icon { font-size: 14px; }
    .patient-card__owner { font-weight: 600; color: #475569; flex: 1; }
    .patient-card__owner-phone { color: #94a3b8; }

    .badge { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .badge--active { background: #dcfce7; color: #166534; }
    .badge--inactive { background: #f1f5f9; color: #64748b; }
    .badge--deceased { background: #fee2e2; color: #991b1b; }

    .empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; background: #fff; border-radius: 12px; color: #94a3b8; }
    .empty-state__icon { font-size: 48px; }
    .empty-state__text { font-size: 15px; color: #64748b; }
    .empty-state__btn { background: #f59e0b; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .empty-state__btn:hover { background: #d97706; }
  `]
})
export class DemoPatientsComponent {
  demoData = inject(DemoDataService);
  search = signal('');
  searchTerm = '';

  filteredPatients = computed(() => {
    const term = this.search().toLowerCase().trim();
    if (!term) return this.demoData.patients;
    return this.demoData.patients.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.breed ?? '').toLowerCase().includes(term) ||
      `${p.tutor?.firstName} ${p.tutor?.lastName}`.toLowerCase().includes(term)
    );
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.search.set('');
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', deceased: 'Fallecido' };
    return labels[status] ?? status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      active: 'badge badge--active',
      inactive: 'badge badge--inactive',
      deceased: 'badge badge--deceased',
    };
    return classes[status] ?? 'badge';
  }
}
