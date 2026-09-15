import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
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
  private authSvc = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  appointmentId = signal<string | null>(null);
  loading = signal(false);
  submitting = signal(false);

  // Listados relacionales
  patients = signal<Patient[]>([]);
  vets = signal<User[]>([]);

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
    this.loadVets();

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
      error: () => this.toast.error('No se pudo cargar el listado de pacientes.')
    });
  }

  private loadVets() {
    this.authSvc.getUsers().subscribe({
      next: users => this.vets.set(users.filter((u: User) => u.active && (u.role === 'vet' || u.role === 'admin'))),
      error: () => this.toast.error('No se pudo cargar el listado de veterinarios.')
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
        this.loading.set(false);
        this.toast.error('No se pudo cargar la cita a editar.');
        this.router.navigate(['/appointments/calendar']);
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
      branchId: this.authSvc.activeBranchId() || undefined,
      status: 'scheduled'
    };

    if (this.isEditMode()) {
      this.svc.updateAppointment(this.appointmentId()!, appointmentData).subscribe({
        next: () => this.goBack('Cita actualizada exitosamente.'),
        error: () => {
          this.submitting.set(false);
          this.toast.error('No se pudo actualizar la cita. Verifica los datos e intenta de nuevo.');
        }
      });
    } else {
      this.svc.createAppointment(appointmentData).subscribe({
        next: () => this.goBack('Cita agendada exitosamente.'),
        error: () => {
          this.submitting.set(false);
          this.toast.error('No se pudo agendar la cita. Verifica los datos e intenta de nuevo.');
        }
      });
    }
  }

  private goBack(successMessage: string) {
    this.submitting.set(false);
    this.toast.success(successMessage);
    this.router.navigate(['/appointments/calendar']);
  }
}
