import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Appointment } from '../../../core/models';

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
  private toast = inject(ToastService);
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

  doneAppointments = computed(() => 
    this.appointments().filter(a => a.status === 'done')
  );

  vetDoneCount = computed(() => {
    const user = this.auth.currentUser;
    if (!user) return 0;
    if (user.role === 'admin') {
      return this.doneAppointments().length;
    }
    const vetId = user.id;
    return this.appointments().filter(a => a.status === 'done' && a.vetId === vetId).length;
  });

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
        this.loading.set(false);
        this.toast.error('No se pudo cargar la lista de citas del día. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  // Cambiar estado de la cita en sala de espera
  changeStatus(app: Appointment, newStatus: Appointment['status']) {
    this.svc.updateStatus(app.id, newStatus).subscribe({
      next: () => {
        this.updateLocalStatus(app.id, newStatus);
        if (newStatus === 'in-progress') {
          if (app.isNewPatient && !app.patientId) {
            // Mascota nueva: primero se registra al tutor y al paciente
            this.router.navigate(['/patients', 'new'], {
              queryParams: {
                prospectName: app.prospectName,
                prospectPhone: app.prospectPhone,
                returnAppointmentId: app.id
              }
            });
          } else {
            this.router.navigate(['/medical-records', 'new', app.patientId], {
              queryParams: { appointmentId: app.id }
            });
          }
        }
      },
      error: () => {
        this.toast.error('No se pudo actualizar el estado de la cita. Intenta de nuevo.');
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
