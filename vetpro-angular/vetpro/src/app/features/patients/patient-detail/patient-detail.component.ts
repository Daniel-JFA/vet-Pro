import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PatientService } from '../../../core/services/patient.service';
import { Patient, Tutor, Vaccine, MedicalRecord, Attachment, Species, PatientStatus } from '../../../core/models';

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

  patientId = signal<string | null>(null);
  patient = signal<Patient | null>(null);
  loading = signal(true);

  // Tab activo: 'general' | 'history' | 'vaccines' | 'documents'
  activeTab = signal<'general' | 'history' | 'vaccines' | 'documents'>('general');

  // Datos clínicos adicionales de la mascota (Mock para offline)
  historyRecords = signal<MedicalRecord[]>([]);
  vaccines = signal<Vaccine[]>([]);
  attachments = signal<Attachment[]>([]);

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
        // Fallback en caso de offline
        const mockP = MOCK_PATIENTS_DETAIL.find(p => p.id === id) || MOCK_PATIENTS_DETAIL[0];
        this.patient.set(mockP);
        this.loadClinicalData(id);
      }
    });
  }

  private loadClinicalData(id: string) {
    // Intentar cargar historia y vacunas
    this.svc.getMedicalHistory(id).subscribe({
      next: h => this.historyRecords.set(h),
      error: () => this.historyRecords.set(MOCK_HISTORY)
    });

    this.svc.getVaccines(id).subscribe({
      next: v => this.vaccines.set(v),
      error: () => {
        this.vaccines.set(MOCK_VACCINES);
        this.attachments.set(MOCK_ATTACHMENTS);
        this.loading.set(false);
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

// ── MOCK DATA ─────────────────────────────────

const MOCK_TUTOR_DETAIL: Tutor = {
  id: 't1',
  clinicId: 'c1',
  firstName: 'Carlos',
  lastName: 'Gómez',
  email: 'carlos.gomez@correo.co',
  phone: '+57 312 456 7890',
  documentId: '1.018.234.567',
  address: 'Calle 100 #15-30, Apto 502, Bogotá D.C.',
  createdAt: new Date()
};

const MOCK_PATIENTS_DETAIL: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTOR_DETAIL, name: 'Toby', species: 'dog', breed: 'Golden Retriever', birthDate: new Date('2022-04-12'), sex: 'male', sterilized: true, weight: 32.5, chipId: '985112003456789', photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150', status: 'active', allergies: 'Alergia alimentaria (pollo), hipersensibilidad a pulgas.', notes: 'Toby es un perro muy dócil, pero suele ponerse nervioso al subir a la báscula metálica. Requiere premios.', createdAt: new Date() }
];

const MOCK_HISTORY: MedicalRecord[] = [
  {
    id: 'r1',
    clinicId: 'c1',
    patientId: 'p1',
    vetId: 'v1',
    type: 'consultation',
    title: 'Control de Vacunación y Control de Peso',
    anamnesis: 'Tutor asiste con Toby para control de vacunas anual. Informa que ha estado comiendo bien y su nivel de energía es alto. Sin problemas digestivos reportados en los últimos meses.',
    physicalExam: 'Paciente alerta y responsivo. Mucosas rosadas, tiempo de llenado capilar < 2s. Frecuencia cardíaca: 95 lpm, frecuencia respiratoria: 20 rpm, temperatura: 38.6°C. Peso estable de 32.5 kg. Ligera acumulación de sarro en premolares superiores.',
    diagnosis: 'Paciente clínicamente sano. Gingivitis leve grado 1.',
    treatment: 'Se realiza la aplicación de la vacuna Antirrábica Nobivac. Se aconseja iniciar profilaxis dental casera o cepillado regular.',
    aiGenerated: true,
    aiTranscriptionMinutes: 2.5,
    createdAt: new Date(Date.now() - 15 * 86400000)
  },
  {
    id: 'r2',
    clinicId: 'c1',
    patientId: 'p1',
    vetId: 'v2',
    type: 'consultation',
    title: 'Cuadro Agudo de Gastroenteritis Leve',
    anamnesis: 'Carlos reporta que Toby presentó dos episodios de emesis líquida (bilis) en la madrugada y deposición blanda. Apetito disminuido hoy. Pudo haber ingerido pasto húmedo en el parque.',
    physicalExam: 'Paciente algo decaído. Deshidratación estimada del 5%. Abdomen blando, dolor a la palpación profunda en fosa epigástrica. Mucosas ligeramente secas.',
    diagnosis: 'Gastroenteritis infecciosa leve / indiscreción alimentaria.',
    treatment: '1. Hidratación oral con suero electrolítico en casa.\n2. Inyección SC de Metoclopramida (antiemético) en clínica.\n3. Prescripción de Amoxicilina 500mg oral (1 tableta cada 12h por 7 días).\n4. Dieta blanda (arroz blanco con pechuga de pollo hervida) por 3 días.',
    aiGenerated: false,
    createdAt: new Date(Date.now() - 90 * 86400000)
  }
];

const MOCK_VACCINES: Vaccine[] = [
  { id: 'vac1', patientId: 'p1', name: 'Vacuna Antirrábica (Nobivac)', brand: 'MSD Animal Health', batch: 'RAB-2026X', appliedAt: new Date(Date.now() - 15 * 86400000), nextDueAt: new Date(Date.now() + 350 * 86400000), vetId: 'v1', notes: 'Aplicada en miembro posterior derecho SC.' },
  { id: 'vac2', patientId: 'p1', name: 'Vacuna Múltiple Canina (DHPPI+L)', brand: 'Zoetis', batch: 'MULT-990A', appliedAt: new Date(Date.now() - 180 * 86400000), nextDueAt: new Date(Date.now() + 185 * 86400000), vetId: 'v1', notes: 'Refuerzo anual aplicado con éxito.' }
];

const MOCK_ATTACHMENTS: Attachment[] = [
  { id: 'att1', recordId: 'r1', name: 'Cuadro_Hematico_Toby.pdf', type: 'pdf', url: 'https://vetpro.co/files/toby_hemo.pdf', size: 250880, uploadedAt: new Date(Date.now() - 15 * 86400000) },
  { id: 'att2', recordId: 'r2', name: 'Ecografia_Abdominal.png', type: 'image', url: 'https://images.unsplash.com/photo-1579684389782-64d84b5e901d?auto=format&fit=crop&q=80&w=300', size: 1258291, uploadedAt: new Date(Date.now() - 90 * 86400000) }
];
