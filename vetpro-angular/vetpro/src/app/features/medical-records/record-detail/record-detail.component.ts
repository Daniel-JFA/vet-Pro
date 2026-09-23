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

  shareViaWhatsApp() {
    const rec = this.record() as any;
    if (!rec) return;

    const petName = rec.patient?.name || 'su mascota';
    const tutorName = rec.patient?.tutor ? `${rec.patient.tutor.firstName} ${rec.patient.tutor.lastName}`.trim() : 'Tutor(a)';
    let rawPhone = rec.patient?.tutor?.phone || '';
    rawPhone = rawPhone.replace(/[^0-9]/g, '');
    if (rawPhone.length === 10 && !rawPhone.startsWith('57')) {
      rawPhone = '57' + rawPhone;
    }

    let text = `🐾 *¡Hola ${tutorName}!* Le compartimos el resumen médico de la consulta de *${petName}*:\n\n`;
    text += `📋 *Atención:* ${rec.title || 'Consulta Médica General'}\n`;
    if (rec.vetId) text += `👨‍⚕️ *Atendido por:* ${rec.vetId}\n`;
    if (rec.diagnosis) text += `🩺 *Diagnóstico:* ${rec.diagnosis}\n`;
    if (rec.treatment) text += `💊 *Tratamiento & Prescripción:* ${rec.treatment}\n`;
    if (rec.observations) text += `📝 *Recomendaciones:* ${rec.observations}\n\n`;
    text += `✨ *Portal del Tutor VetPro:* Ingrese para consultar su carnet de vacunas y citas en línea.\n`;
    text += `¡Muchas gracias por confiar el cuidado de ${petName} en nuestras manos!`;

    const encoded = encodeURIComponent(text);
    const url = rawPhone ? `https://wa.me/${rawPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  }
}
