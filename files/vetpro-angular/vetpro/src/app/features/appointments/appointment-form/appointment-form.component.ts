import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { Appointment, Patient, User } from '../../../core/models';

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './appointment-form.component.html',
  styleUrl: './appointment-form.component.scss'
})
export class AppointmentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(AppointmentService);
  private patientSvc = inject(PatientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  appointmentId = signal<string | null>(null);
  loading = signal(false);
  submitting = signal(false);

  // Listados relacionales
  patients = signal<Patient[]>([]);
  vets = signal<User[]>([
    { id: 'v1', clinicId: 'c1', firstName: 'Andrés', lastName: 'Espinoza', email: 'admin@vetpro.co', role: 'admin', active: true },
    { id: 'v2', clinicId: 'c1', firstName: 'Laura', lastName: 'Cardona', email: 'vet@vetpro.co', role: 'vet', active: true }
  ]);

  form!: FormGroup;

  services = [
    'Consulta General',
    'Control de Paciente',
    'Cirugía / Procedimiento quirúrgico',
    'Vacunación',
    'Desparasitación',
    'Toma de Muestras / Laboratorio',
    'Estudio de Imagenología'
  ];

  times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];

  ngOnInit() {
    this.initForm();
    this.loadPatients();

    // Comprobar parámetros de ruteo para pre-llenado desde el calendario
    const queryDate = this.route.snapshot.queryParamMap.get('date');
    const queryTime = this.route.snapshot.queryParamMap.get('time');

    if (queryDate) this.form.get('date')?.setValue(queryDate);
    if (queryTime) this.form.get('time')?.setValue(queryTime);

    // Comprobar si estamos en modo edición
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.appointmentId.set(id);
      this.loadAppointment(id);
    }
  }

  private initForm() {
    this.form = this.fb.group({
      patientId: ['', Validators.required],
      vetId: ['', Validators.required],
      serviceType: ['Consulta General', Validators.required],
      date: ['', Validators.required],
      time: ['09:00', Validators.required],
      durationMinutes: [30, [Validators.required, Validators.min(5)]],
      reason: ['', Validators.maxLength(500)],
      notes: ['', Validators.maxLength(500)]
    });
  }

  private loadPatients() {
    this.patientSvc.getPatients().subscribe({
      next: res => this.patients.set(res.data),
      error: () => this.patients.set(MOCK_PATIENTS_FORM)
    });
  }

  private loadAppointment(id: string) {
    this.loading.set(true);
    this.svc.getAppointment(id).subscribe({
      next: app => {
        this.fillForm(app);
        this.loading.set(false);
      },
      error: () => {
        // Fallback local en caso de error
        const mockApp = MOCK_APPOINTMENTS_FORM.find(a => a.id === id);
        if (mockApp) {
          this.fillForm(mockApp);
        }
        this.loading.set(false);
      }
    });
  }

  private fillForm(app: Appointment) {
    const appDate = new Date(app.scheduledAt);
    const dateStr = appDate.toISOString().substring(0, 10);
    const timeStr = appDate.toTimeString().substring(0, 5); // '09:00'

    this.form.patchValue({
      patientId: app.patientId,
      vetId: app.vetId,
      serviceType: app.serviceType,
      date: dateStr,
      time: timeStr,
      durationMinutes: app.durationMinutes,
      reason: app.reason,
      notes: app.notes
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    const { date, time, ...rest } = this.form.value;
    
    // Unir fecha y hora en un solo objeto Date
    const scheduledAt = new Date(`${date}T${time}:00`);

    const appointmentData: Partial<Appointment> = {
      ...rest,
      scheduledAt,
      clinicId: 'c1',
      branchId: 'b1', // default branch
      status: 'scheduled'
    };

    if (this.isEditMode()) {
      this.svc.updateAppointment(this.appointmentId()!, appointmentData).subscribe({
        next: () => this.goBack(),
        error: () => this.goBack() // Fallback de éxito local
      });
    } else {
      this.svc.createAppointment(appointmentData).subscribe({
        next: () => this.goBack(),
        error: () => this.goBack() // Fallback de éxito local
      });
    }
  }

  private goBack() {
    this.submitting.set(false);
    this.router.navigate(['/appointments/calendar']);
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_PATIENTS_FORM: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p2', clinicId: 'c1', tutorId: 't2', name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p3', clinicId: 'c1', tutorId: 't3', name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, status: 'active', createdAt: new Date() }
];

const MOCK_APPOINTMENTS_FORM: Appointment[] = [
  { id: 'a1', clinicId: 'c1', patientId: 'p1', vetId: 'v1', serviceType: 'Vacunación', scheduledAt: new Date(), durationMinutes: 30, status: 'scheduled', reason: 'Control anual.', createdAt: new Date() }
];
