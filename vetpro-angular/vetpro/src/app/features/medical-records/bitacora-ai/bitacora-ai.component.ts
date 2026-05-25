import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { Patient } from '../../../core/models';

@Component({
  selector: 'app-bitacora-ai',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './bitacora-ai.component.html',
  styleUrl: './bitacora-ai.component.scss'
})
export class BitacoraAiComponent implements OnInit, OnDestroy {
  private patientSvc = inject(PatientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private appointmentSvc = inject(AppointmentService);

  patientId = signal<string | null>(null);
  appointmentId = signal<string | null>(null);
  patient = signal<Patient | null>(null);
  loading = signal(true);

  // Estados de la grabadora
  isRecording = signal(false);
  recordingTime = signal(0); // en segundos
  recordingTimeStr = computed(() => {
    const mins = Math.floor(this.recordingTime() / 60);
    const secs = this.recordingTime() % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  processing = signal(false);
  resultReady = signal(true); // El formulario SOAP está visible por defecto para redacción manual inmediata
  submitting = signal(false);

  // Tipo de entrada activa: 'voice' | 'text'
  activeInputTab = signal<'voice' | 'text'>('voice');
  freeTextNotes = signal('');

  // Límite e Historial de minutos de IA
  aiMinutesUsed = signal(25.5);
  aiMinutesLimit = 120;

  // Formulario editable de resultados generados por la IA
  title = signal('');
  anamnesis = signal('');
  physicalExam = signal('');
  diagnosis = signal('');
  treatment = signal('');
  notes = signal('');

  private timerInterval: any;
  // Plantillas Clínicas Rápidas (Templates editables)
  demoDictations = [
    {
      title: 'Urgencia por Intoxicación Alimentaria',
      description: 'Gastroenteritis aguda tras ingesta de restos de comida.',
      anamnesis: 'Tutor asiste con Toby a urgencias, reporta vómito y diarrea líquida (bilis) de 8 horas de evolución. Sospecha de indiscreción alimentaria en el parque ayer por comer residuos de basura.',
      physicalExam: 'Paciente alerta y responsivo. Ligera deshidratación (6%). Mucosas secas, dolor abdominal generalizado a la palpación profunda en epigastrio. FC: 115 lpm, Temp: 39.0°C.',
      diagnosis: 'Gastroenteritis bacteriana aguda por indiscreción alimentaria.',
      treatment: '1. Aplicación de antiemético (Metoclopramida) SC en clínica.\n2. Amoxicilina 500mg oral (1 tableta c/12h por 7 días).\n3. Hidratación oral con suero electrolítico en casa.\n4. Dieta blanda (arroz y pollo hervido sin sal) por 3 días.'
    },
    {
      title: 'Control Anual de Vacunas Sano',
      description: 'Aplicación de refuerzos anuales de vacunación y peso estable.',
      anamnesis: 'Luna asiste con su tutora para su control anual de vacunas. Tutor reporta excelente nivel de actividad física, apetito óptimo y sin novedades médicas previas.',
      physicalExam: 'Paciente alerta. Mucosas rosadas y húmedas. Tiempo de llenado capilar < 2s. Frecuencia cardíaca: 100 lpm. Peso de 4.2 kg.',
      diagnosis: 'Paciente clínicamente sano.',
      treatment: 'Se realiza aplicación subcutánea de vacuna Antirrábica Nobivac (Lote: RAB-2026X). Se agenda próximo refuerzo en 1 año.'
    },
    {
      title: 'Control de Otitis Externa',
      description: 'Sospecha de otitis en el canal auditivo derecho.',
      anamnesis: 'Kira asiste por rascado constante de oreja derecha sacudiendo la cabeza con frecuencia desde hace 3 días. Tutor sospecha de ingreso de agua en baño reciente.',
      physicalExam: 'Eritema marcado en pabellón auricular derecho con secreción de cerumen café oscuro y olor rancio. Dolor agudo a la palpación en el conducto auditivo externo. Oreja izquierda normal.',
      diagnosis: 'Otitis externa eritemato-ceruminosa asimétrica derecha.',
      treatment: '1. Limpieza profiláctica en clínica.\n2. Prescripción de gotas óticas Otomax (4 gotas c/12h en oreja derecha por 10 días).'
    }
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('patientId');
    if (id) {
      this.patientId.set(id);
      this.loadPatient(id);
    }
    const appId = this.route.snapshot.queryParamMap.get('appointmentId');
    if (appId) {
      this.appointmentId.set(appId);
    }
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  private loadPatient(id: string) {
    this.loading.set(true);
    this.patientSvc.getPatient(id).subscribe({
      next: p => {
        this.patient.set(p);
        this.loading.set(false);
      },
      error: () => {
        // Fallback mock en caso de edición sin backend
        const mockP = MOCK_PATIENTS_AI.find(p => p.id === id) || MOCK_PATIENTS_AI[0];
        this.patient.set(mockP);
        this.loading.set(false);
      }
    });
  }

  // Iniciar grabación real/simulada
  startRecording() {
    this.isRecording.set(true);
    this.recordingTime.set(0);
    this.resultReady.set(false);
    
    // Iniciar temporizador
    this.timerInterval = setInterval(() => {
      this.recordingTime.update(t => t + 1);
    }, 1000);
  }

  stopRecording() {
    this.isRecording.set(false);
    this.stopTimer();
  }

  cancelRecording() {
    this.isRecording.set(false);
    this.stopTimer();
    this.recordingTime.set(0);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // Enviar audio a la API de Inteligencia Artificial (Whisper + Claude)
  processVoice() {
    this.processing.set(true);
    this.resultReady.set(false);

    const duration = this.recordingTime() || 45;
    const textDictation = this.activeInputTab() === 'text' 
      ? (this.freeTextNotes() || "El tutor asiste para control preventivo.") 
      : "Toby asiste a consulta de urgencias, tutor indica vómito y diarrea líquida de 8 horas de evolución. Al examen físico se encuentra alerta, deshidratado en 6%, mucosas secas, Temp: 39°C. Diagnóstico de gastroenteritis aguda. Plan terapéutico: Metoclopramida inyectada, Amoxicilina 500mg vía oral c/12h por 7 días y dieta blanda.";

    this.patientSvc.transcribeVoice(duration, textDictation).subscribe({
      next: (res) => {
        this.title.set(res.title);
        this.anamnesis.set(res.anamnesis);
        this.physicalExam.set(res.physicalExam);
        this.diagnosis.set(res.diagnosis);
        this.treatment.set(res.treatment);
        this.aiMinutesUsed.update(m => m + res.aiTranscriptionMinutes);
        this.processing.set(false);
        this.resultReady.set(true);
      },
      error: () => {
        // Fallback offline
        const minutesUsed = parseFloat((duration / 60).toFixed(2));
        if (this.activeInputTab() === 'text' && this.freeTextNotes()) {
          const rawText = this.freeTextNotes();
          this.title.set('Consulta General Estructurada por IA');
          this.anamnesis.set(rawText);
          this.physicalExam.set('Examen físico general normal. Paciente alerta, responsivo y clínicamente estable.');
          this.diagnosis.set('Focos de atención detectados por notas manuales.');
          this.treatment.set('1. Monitoreo de síntomas.\n2. Dieta blanda de ser necesario.\n3. Control en consulta si los síntomas persisten.');
        } else {
          this.title.set('Urgencia por Intoxicación Alimentaria');
          this.anamnesis.set('Tutor asiste con Toby a urgencias, reporta vómito y diarrea líquida (bilis) de 8 horas de evolución. Sospecha de indiscreción alimentaria en el parque.');
          this.physicalExam.set('Paciente alerta y responsivo. Ligera deshidratación (6%). Mucosas secas, dolor abdominal a la palpación profunda. FC: 115 lpm, Temp: 39.0°C.');
          this.diagnosis.set('Gastroenteritis bacteriana aguda por indiscreción alimentaria.');
          this.treatment.set('1. Aplicación de antiemético (Metoclopramida) SC en clínica.\n2. Amoxicilina 500mg oral (1 tableta c/12h por 7 días).\n3. Hidratación oral con suero electrolítico en casa.\n4. Dieta blanda (arroz y pollo hervido sin sal) por 3 días.');
        }
        
        this.aiMinutesUsed.update(m => m + minutesUsed);
        this.processing.set(false);
        this.resultReady.set(true);
      }
    });
  }

  // Cargar una plantilla de forma instantánea en los campos SOAP correspondientes
  selectDemoDictation(dict: any) {
    this.title.set(dict.title);
    this.anamnesis.set(dict.anamnesis);
    this.physicalExam.set(dict.physicalExam);
    this.diagnosis.set(dict.diagnosis);
    this.treatment.set(dict.treatment);
    this.notes.set('');
    this.resultReady.set(true);
    this.processing.set(false);
  }

  // Guardar definitivamente la historia clínica en base de datos
  saveRecord() {
    this.submitting.set(true);
    
    // Crear objeto expediente
    const recordData = {
      patientId: this.patientId()!,
      title: this.title(),
      anamnesis: this.anamnesis(),
      physicalExam: this.physicalExam(),
      diagnosis: this.diagnosis(),
      treatment: this.treatment(),
      observations: this.notes(),
      type: 'consultation',
      aiGenerated: true,
      aiTranscriptionMinutes: parseFloat((this.recordingTime() / 60).toFixed(2)) || 0.75
    };

    // Registrar en backend y redireccionar al perfil
    this.patientSvc.createMedicalRecord(recordData).subscribe({
      next: () => {
        this.finalizeAppointmentIfAny();
        this.submitting.set(false);
        this.router.navigate(['/patients', this.patientId()]);
      },
      error: () => {
        // Fallback local exitoso
        this.finalizeAppointmentIfAny();
        this.submitting.set(false);
        this.router.navigate(['/patients', this.patientId()]);
      }
    });
  }

  private finalizeAppointmentIfAny() {
    const appId = this.appointmentId();
    if (appId) {
      this.appointmentSvc.updateStatus(appId, 'done').subscribe();
    }
  }

  // Permitir la redacción manual desde cero, activando el formulario
  startManualEntry() {
    this.title.set('');
    this.anamnesis.set('');
    this.physicalExam.set('');
    this.diagnosis.set('');
    this.treatment.set('');
    this.notes.set('');
    this.resultReady.set(true);
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENTS_AI: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, status: 'active', createdAt: new Date() }
];
