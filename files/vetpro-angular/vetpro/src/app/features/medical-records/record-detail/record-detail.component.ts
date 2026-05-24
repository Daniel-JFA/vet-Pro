import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PatientService } from '../../../core/services/patient.service';
import { MedicalRecord, Patient } from '../../../core/models';

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
        // Fallback mock data offline
        const mockRec = MOCK_RECORDS_DETAILS.find(r => r.id === id) || MOCK_RECORDS_DETAILS[0];
        this.record.set(mockRec);
        this.loading.set(false);
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

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENT: Patient = {
  id: 'p1',
  clinicId: 'c1',
  tutorId: 't1',
  name: 'Toby',
  species: 'dog',
  breed: 'Golden Retriever',
  birthDate: new Date('2022-04-12'),
  sex: 'male',
  sterilized: true,
  weight: 32.5,
  chipId: '985112003456789',
  photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150',
  status: 'active',
  createdAt: new Date(),
  tutor: {
    id: 't1',
    clinicId: 'c1',
    firstName: 'Carlos',
    lastName: 'Gómez',
    phone: '+57 312 456 7890',
    email: 'carlos.gomez@correo.co',
    documentId: '1.018.234.567',
    address: 'Calle 100 #15-30, Bogotá D.C.',
    createdAt: new Date()
  }
};

const MOCK_RECORDS_DETAILS: MedicalRecord[] = [
  {
    id: 'r1',
    clinicId: 'c1',
    patientId: 'p1',
    patient: MOCK_PATIENT,
    vetId: 'Dr(a). Diego Silva',
    type: 'consultation',
    title: 'Control de Vacunación y Control de Peso',
    anamnesis: 'Tutor asiste con Toby para control de vacunas anual. Informa que ha estado comiendo bien y su nivel de energía es alto. Sin problemas digestivos reportados en los últimos meses.',
    physicalExam: 'Paciente alerta y responsivo. Mucosas rosadas, tiempo de llenado capilar < 2s. Frecuencia cardíaca: 95 lpm, frecuencia respiratoria: 20 rpm, temperatura: 38.6°C. Peso estable de 32.5 kg. Ligera acumulación de sarro en premolares superiores.',
    diagnosis: 'Paciente clínicamente sano. Gingivitis leve grado 1.',
    treatment: 'Se realiza la aplicación de la vacuna Antirrábica Nobivac. Se aconseja iniciar profilaxis dental casera o cepillado regular en casa.',
    observations: 'Toby se portó excelente. Se le entregó galleta premio al finalizar.',
    aiGenerated: true,
    aiTranscriptionMinutes: 2.5,
    attachments: [
      { id: 'att1', recordId: 'r1', name: 'Cuadro_Hematico_Toby.pdf', type: 'pdf', url: 'https://vetpro.co/files/toby_hemo.pdf', size: 250880, uploadedAt: new Date() }
    ],
    createdAt: new Date(Date.now() - 1 * 86400000)
  },
  {
    id: 'r2',
    clinicId: 'c1',
    patientId: 'p1',
    patient: MOCK_PATIENT,
    vetId: 'Dr(a). Diego Silva',
    type: 'consultation',
    title: 'Revisión y Limpieza de Canal Auditivo',
    anamnesis: 'Tutor indica sacudidas constantes de cabeza y rascado frecuente en oreja derecha desde hace 3 días.',
    physicalExam: 'Eritema moderado en canal auditivo derecho. Presencia de cerumen denso café oscuro con olor rancio. Dolor leve a la palpación profunda.',
    diagnosis: 'Otitis externa eritemato-ceruminosa derecha.',
    treatment: '1. Limpieza profunda en clínica.\n2. Prescribir gotas óticas Otomax: 4 gotas c/12h por 10 días.',
    observations: 'Se programa control en 10 días.',
    aiGenerated: true,
    aiTranscriptionMinutes: 1.5,
    createdAt: new Date(Date.now() - 3 * 86400000)
  }
];
