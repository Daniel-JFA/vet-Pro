import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { ToastService } from '../../../core/services/toast.service';
import { Appointment, User } from '../../../core/models';

@Component({
  selector: 'app-appointment-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss'
})
export class AppointmentCalendarComponent implements OnInit {
  private svc = inject(AppointmentService);
  private toast = inject(ToastService);

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
        this.loading.set(false);
        this.toast.error('No se pudo cargar la agenda de citas. Verifica tu conexión e intenta de nuevo.');
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
