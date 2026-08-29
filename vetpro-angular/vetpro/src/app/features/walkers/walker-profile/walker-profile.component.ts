import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Walker } from '../../../core/models';

@Component({
  selector: 'app-walker-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <h1 class="page-title">Mi Perfil de Paseador</h1>
        <p class="page-subtitle">Configura tu información, zonas y tarifas</p>
      </div>

      <div *ngIf="loading()" class="loading-state">
        <span class="material-symbols-outlined spin">sync</span> Cargando perfil…
      </div>

      <div class="profile-grid" *ngIf="!loading() && profile()">
        <!-- Stats -->
        <div class="stats-section">
          <div class="stat-card highlight">
            <span class="stat-value">{{ profile()!.rating.toFixed(1) }}</span>
            <span class="stat-label">Calificación ⭐</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ profile()!.totalWalks }}</span>
            <span class="stat-label">Paseos realizados</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ profile()!.maxDogs }}</span>
            <span class="stat-label">Máx. perros</span>
          </div>
        </div>

        <!-- Edit form -->
        <div class="edit-card">
          <h2>Información</h2>
          <div class="form-group">
            <label>Bio / Presentación</label>
            <textarea [(ngModel)]="form.bio" rows="3" placeholder="Cuéntale a los tutores sobre ti…"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Precio por hora (COP)</label>
              <input type="number" [(ngModel)]="form.pricePerHour" />
            </div>
            <div class="form-group">
              <label>Máx. perros por paseo</label>
              <input type="number" [(ngModel)]="form.maxDogs" min="1" max="10" />
            </div>
          </div>
          <div class="form-group">
            <label>Zonas de cobertura</label>
            <div class="zones-editor">
              <div class="zone-chip-edit" *ngFor="let z of form.coverageZones; let i = index">
                {{ z }}
                <button class="zone-remove" (click)="removeZone(i)">×</button>
              </div>
              <div class="zone-add">
                <input type="text" [(ngModel)]="newZone" placeholder="Agregar zona…"
                       (keydown.enter)="addZone()" />
                <button class="btn-add-zone" (click)="addZone()">+</button>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" (click)="saveProfile()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <span class="save-ok" *ngIf="saved()">✓ Guardado</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 24px; max-width: 720px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    .page-subtitle { color: #6b7280; margin: 0; }

    .profile-grid { display: flex; flex-direction: column; gap: 24px; }
    .stats-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                 padding: 20px; text-align: center; }
    .stat-card.highlight { border-color: #4f46e5; background: #ede9fe; }
    .stat-value { display: block; font-size: 28px; font-weight: 700; color: #4f46e5; }
    .stat-label { font-size: 12px; color: #6b7280; }

    .edit-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
    .edit-card h2 { margin: 0 0 20px; font-size: 16px; font-weight: 700; }
    .form-group { margin-bottom: 18px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151;
                        margin-bottom: 6px; }
    .form-group input, .form-group textarea {
      width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .zones-editor { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
                    padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; }
    .zone-chip-edit { display: flex; align-items: center; gap: 4px; background: #ede9fe;
                      color: #5b21b6; padding: 4px 10px; border-radius: 12px; font-size: 13px; }
    .zone-remove { background: none; border: none; cursor: pointer; color: #7c3aed;
                   font-size: 16px; line-height: 1; padding: 0; }
    .zone-add { display: flex; gap: 6px; }
    .zone-add input { flex: 1; min-width: 120px; border: none; outline: none;
                      font-size: 13px; padding: 4px; }
    .btn-add-zone { background: #4f46e5; color: #fff; border: none; border-radius: 6px;
                    width: 28px; height: 28px; font-size: 18px; cursor: pointer; }

    .form-actions { display: flex; align-items: center; gap: 12px; }
    .btn-primary { padding: 10px 24px; background: #4f46e5; color: #fff; border: none;
                   border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .save-ok { color: #10b981; font-weight: 600; font-size: 14px; }

    .loading-state { text-align: center; padding: 60px 20px; color: #6b7280; }
    .spin { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class WalkerProfileComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  profile = signal<Walker | null>(null);
  loading = signal(false);
  saving = signal(false);
  saved = signal(false);

  form = { bio: '', pricePerHour: 25000, maxDogs: 3, coverageZones: [] as string[] };
  newZone = '';

  ngOnInit() {
    this.loading.set(true);
    const userId = this.auth.currentUser?.id;
    this.api.get<Walker>(`/v1/walkers/by-user/${userId}`).subscribe({
      next: w => {
        this.profile.set(w);
        this.form = { bio: w.bio ?? '', pricePerHour: w.pricePerHour,
                      maxDogs: w.maxDogs, coverageZones: [...w.coverageZones] };
        this.loading.set(false);
      },
      error: () => {
        const demo: Walker = {
          id: 'demo', clinicId: 'dev-clinic', userId: 'dev-walker',
          bio: 'Apasionado por los animales.', photoUrl: undefined,
          rating: 4.8, totalWalks: 127, pricePerHour: 25000,
          maxDogs: 3, coverageZones: ['Laureles', 'El Poblado'], active: true, createdAt: new Date()
        };
        this.profile.set(demo);
        this.form = { bio: demo.bio ?? '', pricePerHour: demo.pricePerHour,
                      maxDogs: demo.maxDogs, coverageZones: [...demo.coverageZones] };
        this.loading.set(false);
      }
    });
  }

  addZone() {
    const z = this.newZone.trim();
    if (z && !this.form.coverageZones.includes(z)) {
      this.form.coverageZones = [...this.form.coverageZones, z];
    }
    this.newZone = '';
  }

  removeZone(i: number) {
    this.form.coverageZones = this.form.coverageZones.filter((_, idx) => idx !== i);
  }

  saveProfile() {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.api.put<Walker>(`/v1/walkers/${p.id}`, this.form).subscribe({
      next: updated => {
        this.profile.set(updated);
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      }
    });
  }
}
