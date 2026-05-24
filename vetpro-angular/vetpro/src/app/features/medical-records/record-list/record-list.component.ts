import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { MedicalRecord, Patient } from '../../../core/models';

@Component({
  selector: 'app-record-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './record-list.component.html',
  styleUrl: './record-list.component.scss'
})
export class RecordListComponent implements OnInit {
  private patientSvc = inject(PatientService);

  loading = signal(true);
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
    // Para simplificar, obtenemos los registros clínicos simulando atenciones
    // Carga inicial offline con Mock
    setTimeout(() => {
      this.records.set(MOCK_ALL_RECORDS);
      this.loading.set(false);
    }, 400);
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

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENTS_LIST: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p2', clinicId: 'c1', tutorId: 't2', name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p3', clinicId: 'c1', tutorId: 't3', name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, status: 'active', createdAt: new Date() }
];

const MOCK_ALL_RECORDS: MedicalRecord[] = [
  {
    id: 'r1',
    clinicId: 'c1',
    patientId: 'p1',
    patient: MOCK_PATIENTS_LIST[0],
    vetId: 'v1',
    type: 'consultation',
    title: 'Control de Vacunación y Control de Peso',
    diagnosis: 'Paciente clínicamente sano. Gingivitis leve grado 1.',
    aiGenerated: true,
    createdAt: new Date(Date.now() - 1 * 86400000)
  },
  {
    id: 'r2',
    clinicId: 'c1',
    patientId: 'p2',
    patient: MOCK_PATIENTS_LIST[1],
    vetId: 'v2',
    type: 'consultation',
    title: 'Revisión y Limpieza de Canal Auditivo',
    diagnosis: 'Otitis externa leve en oído derecho.',
    aiGenerated: true,
    createdAt: new Date(Date.now() - 3 * 86400000)
  },
  {
    id: 'r3',
    clinicId: 'c1',
    patientId: 'p1',
    patient: MOCK_PATIENTS_LIST[0],
    vetId: 'v2',
    type: 'consultation',
    title: 'Cuadro Agudo de Gastroenteritis Leve',
    diagnosis: 'Gastroenteritis bacteriana aguda por indiscreción alimentaria.',
    aiGenerated: false,
    createdAt: new Date(Date.now() - 15 * 86400000)
  },
  {
    id: 'r4',
    clinicId: 'c1',
    patientId: 'p3',
    patient: MOCK_PATIENTS_LIST[2],
    vetId: 'v1',
    type: 'surgery',
    title: 'Procedimiento Quirúrgico de Orquiectomía',
    diagnosis: 'Castración electiva completada.',
    aiGenerated: false,
    createdAt: new Date(Date.now() - 45 * 86400000)
  }
];
