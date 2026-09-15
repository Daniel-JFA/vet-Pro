import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PatientService } from '../../../core/services/patient.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient, Vaccine, MedicalRecord, Attachment, Species, PatientStatus } from '../../../core/models';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss'
})
export class PatientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(PatientService);
  private toast = inject(ToastService);

  patientId = signal<string | null>(null);
  patient = signal<Patient | null>(null);
  loading = signal(true);

  // Tab activo: 'general' | 'history' | 'vaccines' | 'documents'
  activeTab = signal<'general' | 'history' | 'vaccines' | 'documents'>('general');

  // Datos clínicos adicionales de la mascota
  historyRecords = signal<MedicalRecord[]>([]);
  vaccines = signal<Vaccine[]>([]);
  attachments = computed<Attachment[]>(() =>
    this.historyRecords()
      .flatMap(r => r.attachments || [])
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.patientId.set(id);
      this.loadPatientData(id);
    }
  }

  private loadPatientData(id: string) {
    this.loading.set(true);

    // Carga de Mascota básica
    this.svc.getPatient(id).subscribe({
      next: p => {
        this.patient.set(p);
        this.loadClinicalData(id);
      },
      error: () => {
        this.patient.set(null);
        this.loading.set(false);
        this.toast.error('No se pudo cargar la ficha del paciente. Verifique su conexión e intente de nuevo.');
      }
    });
  }

  private loadClinicalData(id: string) {
    // Intentar cargar historia y vacunas
    this.svc.getMedicalHistory(id).subscribe({
      next: h => this.historyRecords.set(h),
      error: () => this.toast.error('No se pudo cargar el historial clínico del paciente.')
    });

    this.svc.getVaccines(id).subscribe({
      next: v => {
        this.vaccines.set(v);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el esquema de vacunación del paciente.');
      }
    });
  }

  // Helper para calcular la edad exacta en años y meses
  calculatedAge = computed(() => {
    const p = this.patient();
    if (!p || !p.birthDate) return 'Desconocida';
    
    const birth = new Date(p.birthDate);
    const now = new Date();
    
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
      years--;
      months += 12;
    }
    
    if (years === 0) {
      return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
    return `${years} ${years === 1 ? 'año' : 'años'} ${months > 0 ? `y ${months} ${months === 1 ? 'mes' : 'meses'}` : ''}`;
  });

  speciesLabel(spec: Species): string {
    switch (spec) {
      case 'dog': return 'Perro';
      case 'cat': return 'Gato';
      case 'rabbit': return 'Conejo';
      case 'bird': return 'Ave';
      case 'reptile': return 'Reptil';
      case 'horse': return 'Caballo';
      case 'cow': return 'Vaca';
      case 'pig': return 'Cerdo';
      default: return 'Otro';
    }
  }

  statusLabel(status: PatientStatus): string {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'deceased': return 'Fallecido';
      default: return 'Desconocido';
    }
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

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
