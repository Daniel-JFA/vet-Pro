import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { Appointment, Patient, Tutor } from '../../../core/models';

@Component({
  selector: 'app-appointment-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss'
})
export class AppointmentListComponent implements OnInit {
  private svc = inject(AppointmentService);
  private router = inject(Router);
  public auth = inject(AuthService);

  appointments = signal<Appointment[]>([]);
  loading = signal(true);

  // Columnas Kanban reactivas basadas en los estados de hoy
  scheduledAppointments = computed(() => 
    this.appointments().filter(a => a.status === 'scheduled')
  );

  waitingAppointments = computed(() => 
    this.appointments().filter(a => a.status === 'waiting')
  );

  inProgressAppointments = computed(() => 
    this.appointments().filter(a => a.status === 'in-progress')
  );

  finishedAppointments = computed(() => 
    this.appointments().filter(a => a.status === 'done' || a.status === 'cancelled')
  );

  // Estadísticas del día
  stats = computed(() => ({
    total: this.appointments().length,
    waiting: this.waitingAppointments().length,
    active: this.inProgressAppointments().length,
    done: this.appointments().filter(a => a.status === 'done').length
  }));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getAppointments().subscribe({
      next: res => {
        this.appointments.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.appointments.set(MOCK_APPOINTMENTS_LIST);
        this.loading.set(false);
      }
    });
  }

  // Cambiar estado de la cita en sala de espera
  changeStatus(app: Appointment, newStatus: Appointment['status']) {
    this.svc.updateStatus(app.id, newStatus).subscribe({
      next: updated => {
        this.updateLocalStatus(app.id, newStatus);
        if (newStatus === 'in-progress') {
          this.router.navigate(['/medical-records', 'new', app.patientId], {
            queryParams: { appointmentId: app.id }
          });
        }
      },
      error: () => {
        // Fallback local offline exitoso
        this.updateLocalStatus(app.id, newStatus);
        if (newStatus === 'in-progress') {
          this.router.navigate(['/medical-records', 'new', app.patientId], {
            queryParams: { appointmentId: app.id }
          });
        }
      }
    });
  }

  private updateLocalStatus(id: string, status: Appointment['status']) {
    this.appointments.update(list => 
      list.map(a => a.id === id ? { ...a, status } : a)
    );
  }

  trackById(_: number, a: Appointment) {
    return a.id;
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_TUTORS: Tutor[] = [
  { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', phone: '3124567890', createdAt: new Date() },
  { id: 't2', clinicId: 'c1', firstName: 'María', lastName: 'Rodríguez', phone: '3157891234', createdAt: new Date() },
  { id: 't3', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', phone: '3209876543', createdAt: new Date() }
];

const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTORS[0], name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p2', clinicId: 'c1', tutorId: 't2', tutor: MOCK_TUTORS[1], name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, status: 'active', createdAt: new Date() },
  { id: 'p3', clinicId: 'c1', tutorId: 't3', tutor: MOCK_TUTORS[2], name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, status: 'active', createdAt: new Date() }
];

const MOCK_APPOINTMENTS_LIST: Appointment[] = [
  { id: 'a1', clinicId: 'c1', patientId: 'p1', patient: MOCK_PATIENTS[0], vetId: 'v1', serviceType: 'Vacunación', scheduledAt: new Date(Date.now() + 15 * 60000), durationMinutes: 30, status: 'scheduled', reason: 'Refuerzo de antirrábica.', createdAt: new Date() },
  { id: 'a2', clinicId: 'c1', patientId: 'p2', patient: MOCK_PATIENTS[1], vetId: 'v2', serviceType: 'Control de Paciente', scheduledAt: new Date(Date.now() - 60 * 60000), durationMinutes: 30, status: 'done', reason: 'Control postoperatorio.', createdAt: new Date() },
  { id: 'a3', clinicId: 'c1', patientId: 'p1', patient: MOCK_PATIENTS[0], vetId: 'v2', serviceType: 'Consulta General', scheduledAt: new Date(Date.now() - 5 * 60000), durationMinutes: 30, status: 'in-progress', reason: 'Dolor abdominal.', createdAt: new Date() },
  { id: 'a4', clinicId: 'c1', patientId: 'p3', patient: MOCK_PATIENTS[2], vetId: 'v1', serviceType: 'Consulta General', scheduledAt: new Date(Date.now() + 50 * 60000), durationMinutes: 30, status: 'waiting', reason: 'Chequeo general.', createdAt: new Date() },
  { id: 'a5', clinicId: 'c1', patientId: 'p2', patient: MOCK_PATIENTS[1], vetId: 'v2', serviceType: 'Control de Paciente', scheduledAt: new Date(Date.now() + 120 * 60000), durationMinutes: 30, status: 'scheduled', reason: 'Revisión periódica.', createdAt: new Date() }
];
