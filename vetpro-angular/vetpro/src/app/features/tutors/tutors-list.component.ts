import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PatientService } from '../../core/services/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { Tutor } from '../../core/models';

@Component({
  selector: 'app-tutors-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tutors-page">
      <header class="page-header">
        <div>
          <h1>Tutores</h1>
          <p>Dueños de mascotas registrados en tu clínica.</p>
        </div>
        <div class="search-box">
          <span class="material-symbols-outlined">search</span>
          <input type="text" [(ngModel)]="search" placeholder="Buscar por nombre, teléfono o documento..." />
        </div>
      </header>

      <div class="loading-state" *ngIf="loading()">
        <div class="spinner"></div>
      </div>

      <div class="table-wrapper" *ngIf="!loading()">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Mascotas</th>
              <th>Teléfono</th>
              <th>Correo</th>
              <th>Documento</th>
              <th>Dirección</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let t of filtered()">
              <td><strong>{{ t.firstName }} {{ t.lastName }}</strong></td>
              <td>
                <span *ngFor="let p of t.patients; let last = last">{{ p.name }}{{ last ? '' : ', ' }}</span>
                <span *ngIf="!t.patients?.length">—</span>
              </td>
              <td>{{ t.phone }}</td>
              <td>{{ t.email || '—' }}</td>
              <td>{{ t.documentId || '—' }}</td>
              <td>{{ t.address || '—' }}</td>
              <td class="actions-col">
                <button class="btn-icon" (click)="addPet(t)" title="Agregar mascota">
                  <span class="material-symbols-outlined">pets</span>
                </button>
                <button class="btn-icon" (click)="openEdit(t)" title="Editar tutor">
                  <span class="material-symbols-outlined">edit</span>
                </button>
              </td>
            </tr>
            <tr *ngIf="!filtered().length">
              <td colspan="7" class="empty-row">No hay tutores que coincidan con la búsqueda.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MODAL: EDITAR TUTOR -->
      <div *ngIf="editing()" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Editar Tutor</h3>
            <button class="close-btn" (click)="editing.set(null)">✕</button>
          </div>

          <div class="modal-body" *ngIf="editing() as t">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="t.firstName" />
              </div>
              <div class="form-group">
                <label>Apellido *</label>
                <input type="text" [(ngModel)]="t.lastName" />
              </div>
            </div>
            <div class="form-group">
              <label>Teléfono *</label>
              <input type="tel" [(ngModel)]="t.phone" />
            </div>
            <div class="form-group">
              <label>Correo</label>
              <input type="email" [(ngModel)]="t.email" />
            </div>
            <div class="form-group">
              <label>Documento</label>
              <input type="text" [(ngModel)]="t.documentId" />
            </div>
            <div class="form-group">
              <label>Dirección</label>
              <input type="text" [(ngModel)]="t.address" />
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="t.notes" rows="2"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="editing.set(null)" [disabled]="saving()">Cancelar</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tutors-page {
      padding: 24px;
      font-family: inherit;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;

      h1 { font-size: 1.4rem; font-weight: 800; margin: 0; color: var(--text-color, #0f172a); }
      p { font-size: 0.85rem; color: var(--text-color-secondary, #64748b); margin: 4px 0 0; }
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 10px;
      padding: 8px 14px;
      min-width: 280px;

      span { color: #94a3b8; }
      input { border: none; outline: none; background: transparent; font-size: 0.9rem; width: 100%; color: var(--text-color, #0f172a); }
    }
    .loading-state {
      display: flex;
      justify-content: center;
      padding: 60px;
      .spinner {
        width: 36px; height: 36px;
        border: 3px solid rgba(16,185,129,0.2);
        border-top-color: #10b981;
        border-radius: 50%;
        animation: spin 1s infinite linear;
      }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .table-wrapper {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 14px;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
    th {
      text-align: left;
      padding: 12px 16px;
      background: var(--surface-ground, #f8fafc);
      color: #64748b;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-bottom: 1px solid var(--surface-border, #e2e8f0);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--surface-border, #f1f5f9);
      color: var(--text-color, #1e293b);
    }
    .actions-col { text-align: right; }
    .btn-icon {
      border: none;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: inline-flex;
      &:hover { background: #f1f5f9; color: #10b981; }
    }
    .empty-row { text-align: center; color: #94a3b8; padding: 32px; }

    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-box {
      background: var(--surface-card, #fff);
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid var(--surface-border, #e2e8f0);
      h3 { margin: 0; font-size: 1.05rem; color: var(--text-color, #0f172a); }
    }
    .close-btn { border: none; background: none; font-size: 1.1rem; cursor: pointer; color: #94a3b8; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .form-row { display: flex; gap: 12px; }
    .form-group {
      display: flex; flex-direction: column; gap: 5px; flex: 1;
      label { font-size: 0.78rem; font-weight: 700; color: #475569; }
      input, textarea {
        border: 1px solid var(--surface-border, #cbd5e1);
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 0.88rem;
        font-family: inherit;
        outline: none;
        color: var(--text-color, #0f172a);
        background: var(--surface-card, #fff);
        &:focus { border-color: #10b981; }
      }
    }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--surface-border, #e2e8f0);
    }
    .btn {
      padding: 9px 18px; border-radius: 8px; font-size: 0.87rem; font-weight: 600;
      cursor: pointer; border: none;
      &.btn-primary { background: #10b981; color: #fff; &:disabled { opacity: 0.6; } }
      &.btn-secondary { background: #f1f5f9; color: #475569; }
    }
  `]
})
export class TutorsListComponent implements OnInit {
  private svc = inject(PatientService);
  private toast = inject(ToastService);
  private router = inject(Router);

  tutors = signal<Tutor[]>([]);
  loading = signal(true);
  search = signal('');
  editing = signal<Tutor | null>(null);
  saving = signal(false);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.tutors();
    return this.tutors().filter(t =>
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      (t.documentId || '').toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getTutors({ pageSize: 500 }).subscribe({
      next: (res) => {
        this.tutors.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el listado de tutores.');
      }
    });
  }

  addPet(t: Tutor) {
    this.router.navigate(['/patients/new'], { queryParams: { tutorId: t.id } });
  }

  openEdit(t: Tutor) {
    this.editing.set({ ...t });
  }

  save() {
    const t = this.editing();
    if (!t) return;
    if (!t.firstName || !t.lastName || !t.phone) {
      this.toast.error('Nombre, apellido y teléfono son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.svc.updateTutor(t.id, {
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      documentId: t.documentId,
      address: t.address,
      notes: t.notes
    }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.tutors.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.editing.set(null);
        this.toast.success('Tutor actualizado exitosamente.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'No se pudo actualizar el tutor.');
      }
    });
  }
}
