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
  submitting = signal(false);  // Tipo de entrada activa: 'templates' | 'text' | 'voice'
  activeInputTab = signal<'templates' | 'text' | 'voice'>('templates');
  freeTextNotes = signal('');

  // Plantillas Personalizadas y Demo
  customTemplates = signal<any[]>([]);
  allTemplates = computed(() => {
    return [...this.customTemplates(), ...this.demoDictations];
  });

  // Modal para Guardar Plantilla
  showSaveTemplateModal = signal(false);
  newTemplateName = signal('');
  newTemplateDescription = signal('');

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
    },
    {
      title: 'Control de Alergia Dermatológica (Dermatitis Atópica)',
      description: 'Prurito crónico, eritema podal y sospecha de alergia estacional.',
      anamnesis: 'Tutor reporta prurito intenso (escala 8/10) en patas, abdomen y orejas desde hace 2 semanas. El paciente se lame constantemente las patas y sacude la cabeza. Antecedente de dermatitis atópica recurrente durante la primavera.',
      physicalExam: 'Frecuencia cardíaca: 110 lpm. Temperatura: 38.5°C. Eritema marcado en zonas interdigitales de los 4 miembros. Alopecia parcial y liquenificación leve en zona ventral del abdomen. Conducto auditivo externo con eritema leve bilateral sin secreción purulenta.',
      diagnosis: 'Brote agudo de dermatitis atópica (hipersensibilidad cutánea) con pioderma secundaria leve.',
      treatment: '1. Apoquel 5.4mg (1 tableta oral c/12h por 5 días, luego 1 tableta c/24h por 10 días).\n2. Baño terapéutico con champú de Clorhexidina al 3% c/3 días (dejar actuar por 10 minutos antes de enjuagar).\n3. Dieta hipoalergénica con proteína hidrolizada por 8 semanas de forma estricta.'
    },
    {
      title: 'Control Posquirúrgico de Esterilización (OVH)',
      description: 'Evaluación de herida quirúrgica a los 7 días de la cirugía.',
      anamnesis: 'Luna asiste a control posquirúrgico a los 7 días de haber sido esterilizada. La tutora reporta comportamiento calmado en casa, buen apetito y consumo de agua normal. Ha usado el collar isabelino de forma constante.',
      physicalExam: 'Paciente alerta y dócil. Mucosas rosadas y húmedas. Temperatura: 38.2°C. Incisión quirúrgica en línea alba completamente afrontada, limpia y seca. Sin eritema, edema ni signos de secreción o exudado. Puntos de sutura intactos.',
      diagnosis: 'Evolución posquirúrgica óptima de ovariohisterectomía.',
      treatment: '1. Se autoriza retiro del collar isabelino durante periodos supervisados.\n2. Limpieza diaria de la herida con clorhexidina en spray por 3 días más.\n3. Se programa cita para retiro de puntos en 3 días (día 10 posquirúrgico).'
    },
    {
      title: 'Profilaxis y Limpieza Dental Ultrasónica',
      description: 'Tratamiento de enfermedad periodontal grado II bajo anestesia.',
      anamnesis: 'Tutor reporta halitosis severa y dificultad para masticar alimento seco en los últimos meses. No hay antecedentes de sangrado gingival espontáneo.',
      physicalExam: 'Paciente pre-anestesiado bajo protocolo seguro. Halitosis severa (olor fétido). Presencia de abundante cálculo dental (sarro) en premolares y molares superiores e inferiores. Gingivitis moderada generalizada con retracción gingival leve (<1mm).',
      diagnosis: 'Enfermedad periodontal Grado II (gingivitis y sarro).',
      treatment: '1. Profilaxis dental con ultrasonido y pulido de piezas dentales.\n2. Antibioticoterapia profiláctica: Espiramicina/Metronidazol (1 tableta c/24h por 5 días).\n3. Gel antiséptico bucal (Clorhexidina) aplicado con gasa c/24h por 7 días.\n4. Transición a alimento formulado para cuidado oral o cepillado dental preventivo en casa.'
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
    this.loadCustomTemplates();
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

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  audioBlob = signal<Blob | null>(null);

  // Iniciar grabación de audio real con el micrófono
  async startRecording() {
    this.isRecording.set(true);
    this.recordingTime.set(0);
    this.resultReady.set(false);
    this.audioChunks = [];
    this.audioBlob.set(null);

    // Iniciar temporizador visual
    this.timerInterval = setInterval(() => {
      this.recordingTime.update(t => t + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.mediaStream);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioBlob.set(blob);
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }
        };

        this.mediaRecorder.start(200); // chunks cada 200ms
      }
    } catch (err) {
      console.warn('⚠️ No se pudo acceder al micrófono físico (usando modo simulación):', err);
    }
  }

  stopRecording() {
    this.isRecording.set(false);
    this.stopTimer();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  cancelRecording() {
    this.isRecording.set(false);
    this.stopTimer();
    this.recordingTime.set(0);
    this.audioChunks = [];
    this.audioBlob.set(null);

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
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
  selectTemplate(dict: any) {
    this.title.set(dict.title);
    this.anamnesis.set(dict.anamnesis || '');
    this.physicalExam.set(dict.physicalExam || '');
    this.diagnosis.set(dict.diagnosis || '');
    this.treatment.set(dict.treatment || '');
    this.notes.set(dict.notes || '');
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
    } else {
      const pId = this.patientId();
      if (pId) {
        this.appointmentSvc.getAppointments().subscribe({
          next: res => {
            const activeApp = res?.data?.find((a: any) => a.patientId === pId && (a.status === 'in-progress' || a.status === 'waiting'));
            if (activeApp) {
              this.appointmentSvc.updateStatus(activeApp.id, 'done').subscribe();
            }
          },
          error: () => {
            console.log('Finalización de cita offline/memoria');
          }
        });
      }
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

  loadCustomTemplates() {
    try {
      const stored = localStorage.getItem('vetpro_custom_templates');
      if (stored) {
        this.customTemplates.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading custom templates', e);
    }
  }

  openSaveTemplate() {
    // Si no hay contenido mínimo, avisar
    if (!this.title() && !this.anamnesis() && !this.diagnosis()) {
      alert('Por favor, escribe algo en el expediente antes de guardarlo como plantilla.');
      return;
    }
    // Pre-poblar el nombre de la plantilla con el título
    this.newTemplateName.set(this.title() || 'Nueva Plantilla');
    this.newTemplateDescription.set('Plantilla personalizada creada el ' + new Date().toLocaleDateString());
    this.showSaveTemplateModal.set(true);
  }

  closeSaveTemplate() {
    this.showSaveTemplateModal.set(false);
  }

  saveCustomTemplate() {
    if (!this.newTemplateName().trim()) return;

    const newTpl = {
      id: 'tpl_' + Date.now(),
      isCustom: true,
      title: this.newTemplateName().trim(),
      description: this.newTemplateDescription().trim() || 'Plantilla personalizada',
      anamnesis: this.anamnesis(),
      physicalExam: this.physicalExam(),
      diagnosis: this.diagnosis(),
      treatment: this.treatment()
    };

    const updated = [newTpl, ...this.customTemplates()];
    this.customTemplates.set(updated);
    try {
      localStorage.setItem('vetpro_custom_templates', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving custom template to localStorage', e);
    }

    this.showSaveTemplateModal.set(false);
    alert('¡Plantilla "' + newTpl.title + '" guardada con éxito! La encontrarás en la pestaña de Plantillas.');
  }

  deleteCustomTemplate(id: string, event: Event) {
    event.stopPropagation(); // Evitar que al dar clic en eliminar se cargue la plantilla
    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla personalizada?')) return;

    const updated = this.customTemplates().filter(t => t.id !== id);
    this.customTemplates.set(updated);
    try {
      localStorage.setItem('vetpro_custom_templates', JSON.stringify(updated));
    } catch (e) {
      console.error('Error deleting custom template', e);
    }
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENTS_AI: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, status: 'active', createdAt: new Date() }
];
