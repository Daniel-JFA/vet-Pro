import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConsentService } from '../../../core/services/consent.service';
import { PatientService } from '../../../core/services/patient.service';
import { Patient } from '../../../core/models';

interface ConsentTemplate {
  key: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-consent-form',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './consent-form.component.html',
  styleUrl: './consent-form.component.scss'
})
export class ConsentFormComponent implements OnInit {
  private consentSvc = inject(ConsentService);
  private patientSvc = inject(PatientService);
  private router = inject(Router);

  loading = signal(true);
  submitting = signal(false);

  // Lista de mascotas/pacientes del sistema
  patients = signal<Patient[]>([]);
  selectedPatientId = signal<string>('');

  // Plantillas prediseñadas
  templates: ConsentTemplate[] = [
    {
      key: 'anesthesia',
      title: 'Autorización para Anestesia y Cirugía',
      body: 'Por medio del presente documento, yo [NOMBRE_TUTOR] autorizo a la clínica veterinaria VetPro a realizar el procedimiento quirúrgico propuesto bajo anestesia general inhalatoria para mi mascota [NOMBRE_MASCOTA]. Entiendo los riesgos implícitos, incluyendo reacciones adversas a medicamentos anestésicos, shock, paro cardiorrespiratorio o deceso, habiendo sido previamente informado del plan quirúrgico y exámenes prequirúrgicos.'
    },
    {
      key: 'hospitalization',
      title: 'Consentimiento para Hospitalización General',
      body: 'Por medio del presente documento, yo [NOMBRE_TUTOR] autorizo a la clínica veterinaria VetPro a hospitalizar a mi mascota [NOMBRE_MASCOTA] para la administración de terapia de soporte, terapia de fluidos endovenosos y monitoreo clínico. Entiendo que se me informará periódicamente de su estado y autorizo tratamientos de urgencia que sean médicamente necesarios para salvaguardar su vida.'
    },
    {
      key: 'euthanasia',
      title: 'Consentimiento de Procedimiento de Eutanasia',
      body: 'Por medio del presente documento, yo [NOMBRE_TUTOR] certifico ser el tutor legal de [NOMBRE_MASCOTA]. Autorizo de forma libre y voluntaria a los profesionales de VetPro a aplicar la eutanasia humanitaria (sobredosis anestésica controlada) a mi mascota, con el fin de evitar sufrimiento innecesario derivado de su enfermedad terminal diagnosticada.'
    }
  ];

  selectedTemplateKey = signal<string>('anesthesia');

  // Campos del formulario
  documentTitle = signal<string>('Autorización para Anestesia y Cirugía');
  documentContent = signal<string>('');
  tutorName = signal<string>('');
  tutorPhone = signal<string>('');

  // Auto-completar datos al seleccionar mascota
  selectedPatient = computed(() => {
    return this.patients().find(p => p.id === this.selectedPatientId()) || null;
  });

  ngOnInit() {
    this.loadPatients();
    this.updateTemplateContent();
  }

  loadPatients() {
    this.loading.set(true);
    this.patientSvc.getPatients().subscribe({
      next: (res) => {
        this.patients.set(res.data);
        if (res.data.length > 0) {
          this.selectedPatientId.set(res.data[0].id);
          this.onPatientChange(res.data[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        // Fallback offline mock patients
        this.patients.set(MOCK_PATIENTS_CONSENT);
        this.selectedPatientId.set(MOCK_PATIENTS_CONSENT[0].id);
        this.onPatientChange(MOCK_PATIENTS_CONSENT[0].id);
        this.loading.set(false);
      }
    });
  }

  onPatientChange(id: string) {
    this.selectedPatientId.set(id);
    const pat = this.selectedPatient();
    if (pat && pat.tutor) {
      this.tutorName.set(`${pat.tutor.firstName} ${pat.tutor.lastName}`);
      this.tutorPhone.set(pat.tutor.phone);
    }
    this.updateTemplateContent();
  }

  onTemplateChange(key: string) {
    this.selectedTemplateKey.set(key);
    const temp = this.templates.find(t => t.key === key);
    if (temp) {
      this.documentTitle.set(temp.title);
    }
    this.updateTemplateContent();
  }

  updateTemplateContent() {
    const temp = this.templates.find(t => t.key === this.selectedTemplateKey());
    if (!temp) return;

    let body = temp.body;
    const patName = this.selectedPatient()?.name || '[NOMBRE_MASCOTA]';
    const tutName = this.tutorName() || '[NOMBRE_TUTOR]';

    body = body.replace(/\[NOMBRE_MASCOTA\]/g, patName);
    body = body.replace(/\[NOMBRE_TUTOR\]/g, tutName);

    this.documentContent.set(body);
  }

  onSubmit() {
    if (!this.selectedPatientId() || !this.tutorName() || !this.documentContent()) return;

    this.submitting.set(true);

    const formData = {
      patientId: this.selectedPatientId(),
      patientName: this.selectedPatient()?.name || 'Mascota',
      tutorName: this.tutorName(),
      tutorPhone: this.tutorPhone(),
      title: this.documentTitle(),
      content: this.documentContent()
    };

    this.consentSvc.createConsentForm(formData).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.router.navigate(['/consent']);
      },
      error: () => {
        // Fallback local exitoso
        this.submitting.set(false);
        this.router.navigate(['/consent']);
      }
    });
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENTS_CONSENT: Patient[] = [
  {
    id: 'p1',
    clinicId: 'c1',
    tutorId: 't1',
    name: 'Toby',
    species: 'dog',
    breed: 'Golden Retriever',
    sex: 'male',
    sterilized: true,
    status: 'active',
    createdAt: new Date(),
    tutor: {
      id: 't1',
      clinicId: 'c1',
      firstName: 'Carlos',
      lastName: 'Gómez',
      phone: '+57 312 456 7890',
      createdAt: new Date()
    }
  }
];
