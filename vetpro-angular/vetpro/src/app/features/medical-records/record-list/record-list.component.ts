import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { ToastService } from '../../../core/services/toast.service';
import { MedicalRecord } from '../../../core/models';

@Component({
  selector: 'app-record-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './record-list.component.html',
  styleUrl: './record-list.component.scss'
})
export class RecordListComponent implements OnInit {
  private patientSvc = inject(PatientService);
  private toast = inject(ToastService);

  loading = signal(true);
  loadError = signal(false);
  search = signal('');
  typeFilter = signal<string>('all');
  records = signal<MedicalRecord[]>([]);

  filteredRecords = computed(() => {
    let list = this.records();
    const q = this.search().trim().toLowerCase();

    if (q) {
      list = list.filter(r => 
        r.title.toLowerCase().includes(q) ||
        (r.diagnosis && r.diagnosis.toLowerCase().includes(q)) ||
        (r.patient && r.patient.name.toLowerCase().includes(q))
      );
    }

    if (this.typeFilter() !== 'all') {
      list = list.filter(r => r.type === this.typeFilter());
    }

    return list;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.patientSvc.getAllMedicalRecords({ pageSize: 100 }).subscribe({
      next: res => {
        this.records.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.toast.error('No se pudo cargar el listado de historias clínicas. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  recordTypeLabel(type: string): string {
    switch (type) {
      case 'consultation': return 'Consulta';
      case 'surgery': return 'Cirugía';
      case 'vaccine': return 'Vacunación';
      case 'deworming': return 'Desparasitación';
      case 'lab': return 'Laboratorio';
      case 'imaging': return 'Imagenología';
      default: return 'Otro';
    }
  }

  trackById(_: number, r: MedicalRecord) {
    return r.id;
  }
}
