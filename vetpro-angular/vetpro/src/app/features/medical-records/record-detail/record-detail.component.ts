import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PatientService } from '../../../core/services/patient.service';
import { ToastService } from '../../../core/services/toast.service';
import { MedicalRecord } from '../../../core/models';

@Component({
  selector: 'app-record-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './record-detail.component.html',
  styleUrl: './record-detail.component.scss'
})
export class RecordDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private patientSvc = inject(PatientService);
  private toast = inject(ToastService);

  recordId = signal<string | null>(null);
  record = signal<MedicalRecord | null>(null);
  loading = signal(true);

  // Estados de colapso para secciones
  collapsedSections = signal({
    anamnesis: false,
    physicalExam: false,
    diagnosis: false,
    treatment: false,
    observations: false,
    attachments: false
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.recordId.set(id);
      this.loadRecordDetails(id);
    }
  }

  loadRecordDetails(id: string) {
    this.loading.set(true);
    this.patientSvc.getMedicalRecord(id).subscribe({
      next: (rec) => {
        this.record.set(rec);
        this.loading.set(false);
      },
      error: () => {
        this.record.set(null);
        this.loading.set(false);
        this.toast.error('No se pudo cargar la historia clínica.');
      }
    });
  }

  toggleSection(section: string) {
    this.collapsedSections.update(states => {
      const key = section as keyof typeof states;
      return {
        ...states,
        [key]: !states[key]
      };
    });
  }

  recordTypeLabel(type: string): string {
    switch (type) {
      case 'consultation': return 'Consulta General';
      case 'surgery': return 'Cirugía';
      case 'vaccine': return 'Vacunación';
      case 'deworming': return 'Desparasitación';
      case 'lab': return 'Laboratorio';
      case 'imaging': return 'Imagenología';
      default: return 'Otro';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  printRecord() {
    window.print();
  }
}
