import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { Appointment, User, Patient, Tutor } from '../../../core/models';

@Component({
  selector: 'app-appointment-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss'
})
export class AppointmentCalendarComponent implements OnInit {
  private svc = inject(AppointmentService);

  loading = signal(true);
  appointments = signal<Appointment[]>([]);
  selectedVet = signal<string>('all'); // 'all' o ID del veterinario

  // Fecha de la agenda de la semana (Lunes de la semana actual)
  currentWeekStart = signal<Date>(this.getStartOfWeek(new Date()));

  // Lista de veterinarios mock
  vets = signal<User[]>([
    { id: 'v1', clinicId: 'c1', firstName: 'Andrés', lastName: 'Espinoza', email: 'admin@vetpro.co', role: 'admin', active: true },
    { id: 'v2', clinicId: 'c1', firstName: 'Laura', lastName: 'Cardona', email: 'vet@vetpro.co', role: 'vet', active: true }
  ]);

  // Lista de horas del calendario
  hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  // Genera los días de la semana (Lunes a Sábado) basados en currentWeekStart
  weekDays = computed(() => {
    const days: { date: Date; label: string; number: number }[] = [];
    const start = this.currentWeekStart();
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    for (let i = 0; i < 6; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        date: d,
        label: dayNames[i],
        number: d.getDate()
      });
    }
    return days;
  });

  // Citas filtradas por veterinario
  filteredAppointments = computed(() => {
    let list = this.appointments();
    if (this.selectedVet() !== 'all') {
      list = list.filter(a => a.vetId === this.selectedVet());
    }
    return list;
  });

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
        this.appointments.set(MOCK_APPOINTMENTS_CALENDAR);
        this.loading.set(false);
      }
    });
  }

  // Encuentra la cita correspondiente a un día y hora específicos
  getAppointmentForSlot(day: Date, hour: string): Appointment | undefined {
    return this.filteredAppointments().find(a => {
      const appDate = new Date(a.scheduledAt);
      const isSameDay = appDate.getDate() === day.getDate() && 
                        appDate.getMonth() === day.getMonth() &&
                        appDate.getFullYear() === day.getFullYear();
      
      const appHour = appDate.toTimeString().substring(0, 5); // '09:00'
      const targetHourStr = hour;
      
      // Comprobar si coincide en la hora
      return isSameDay && appHour === targetHourStr;
    });
  }

  statusLabel(status: Appointment['status']): string {
    switch (status) {
      case 'scheduled': return 'Programada';
      case 'waiting': return 'En sala';
      case 'in-progress': return 'En consulta';
      case 'done': return 'Atendida';
      case 'cancelled': return 'Cancelada';
      default: return 'Faltó';
    }
  }

  // Desplazar la agenda una semana atrás
  previousWeek() {
    const d = new Date(this.currentWeekStart());
    d.setDate(d.getDate() - 7);
    this.currentWeekStart.set(d);
  }

  // Desplazar la agenda una semana adelante
  nextWeek() {
    const d = new Date(this.currentWeekStart());
    d.setDate(d.getDate() + 7);
    this.currentWeekStart.set(d);
  }

  today() {
    this.currentWeekStart.set(this.getStartOfWeek(new Date()));
  }

  private getStartOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta al Lunes
    const monday = new Date(date.setDate(diff));
    monday.setHours(0,0,0,0);
    return monday;
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

// Creamos fechas relativas a la semana actual (Miércoles de la semana actual es Lunes + 2 días)
const getRelativeDate = (daysFromMonday: number, hourStr: string): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
  const target = new Date(now.setDate(diff + daysFromMonday));
  const [h, m] = hourStr.split(':');
  target.setHours(parseInt(h), parseInt(m), 0, 0);
  return target;
};

const MOCK_APPOINTMENTS_CALENDAR: Appointment[] = [
  { id: 'a1', clinicId: 'c1', patientId: 'p1', patient: MOCK_PATIENTS[0], vetId: 'v1', serviceType: 'Vacunación', scheduledAt: getRelativeDate(2, '09:00'), durationMinutes: 30, status: 'scheduled', reason: 'Refuerzo de antirrábica.', createdAt: new Date() },
  { id: 'a2', clinicId: 'c1', patientId: 'p2', patient: MOCK_PATIENTS[1], vetId: 'v2', serviceType: 'Control', scheduledAt: getRelativeDate(0, '11:00'), durationMinutes: 30, status: 'done', reason: 'Control postoperatorio.', createdAt: new Date() },
  { id: 'a3', clinicId: 'c1', patientId: 'p1', patient: MOCK_PATIENTS[0], vetId: 'v2', serviceType: 'Consulta General', scheduledAt: getRelativeDate(2, '15:00'), durationMinutes: 30, status: 'in-progress', reason: 'Dolor abdominal.', createdAt: new Date() },
  { id: 'a4', clinicId: 'c1', patientId: 'p3', patient: MOCK_PATIENTS[2], vetId: 'v1', serviceType: 'Consulta General', scheduledAt: getRelativeDate(3, '16:00'), durationMinutes: 30, status: 'waiting', reason: 'Chequeo general.', createdAt: new Date() },
  { id: 'a5', clinicId: 'c1', patientId: 'p2', patient: MOCK_PATIENTS[1], vetId: 'v2', serviceType: 'Control', scheduledAt: getRelativeDate(4, '14:00'), durationMinutes: 30, status: 'scheduled', reason: 'Revisión periódica.', createdAt: new Date() },
  { id: 'a6', clinicId: 'c1', patientId: 'p3', patient: MOCK_PATIENTS[2], vetId: 'v1', serviceType: 'Consulta General', scheduledAt: getRelativeDate(1, '10:00'), durationMinutes: 30, status: 'cancelled', reason: 'El tutor canceló por cruce de horarios.', createdAt: new Date() }
];
