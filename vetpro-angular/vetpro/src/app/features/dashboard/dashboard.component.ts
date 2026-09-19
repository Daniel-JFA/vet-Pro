import { Component, inject, signal, OnInit, computed } from '@angular/core';

import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ReportService } from '../../core/services/report.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Appointment } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private reports = inject(ReportService);
  private appts = inject(AppointmentService);
  private router = inject(Router);

  loadingStats = signal(true);
  loadingAppts = signal(true);

  // KPIs
  kpis = signal<any>({
    revenue: { current: 0, growth: 0 },
    consultations: { current: 0, growth: 0 },
    newPatients: { current: 0, growth: 0 },
    retentionRate: { current: 0, growth: 0 },
  });

  // Species distribution data
  speciesRawData = signal<any[]>([]);

  // Appointments
  todayAppointments = signal<Appointment[]>([]);

  ngOnInit() {
    this.loadStats();
    this.loadTodayAppointments();
  }

  loadStats() {
    this.loadingStats.set(true);
    this.reports.getDashboardData().subscribe({
      next: (res) => {
        this.kpis.set(res.kpis);
        if (res.charts && res.charts.speciesDistribution) {
          const labels = res.charts.speciesDistribution.labels;
          const data = res.charts.speciesDistribution.data;

          const raw = labels.map((l: string, i: number) => ({
            name: l,
            count: data[i],
          }));
          this.speciesRawData.set(raw);
        }
        this.loadingStats.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando KPIs:', err);
        // Nunca dejar datos de una sesión/tenant anterior visibles en pantalla
        this.kpis.set({
          revenue: { current: 0, growth: 0 },
          consultations: { current: 0, growth: 0 },
          newPatients: { current: 0, growth: 0 },
          retentionRate: { current: 0, growth: 0 },
        });
        this.speciesRawData.set([]);
        this.loadingStats.set(false);
      },
    });
  }

  loadTodayAppointments() {
    this.loadingAppts.set(true);
    this.appts.getTodayAppointments().subscribe({
      next: (res) => {
        // Ordenar cronológicamente
        res.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        this.todayAppointments.set(res);
        this.loadingAppts.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando citas de hoy:', err);
        this.todayAppointments.set([]);
        this.loadingAppts.set(false);
      },
    });
  }

  updateAppointmentStatus(id: string, status: Appointment['status']) {
    const app = this.todayAppointments().find((a) => a.id === id);
    this.appts.updateStatus(id, status).subscribe({
      next: () => {
        if (status === 'in-progress' && app?.isNewPatient && !app.patientId) {
          this.router.navigate(['/patients', 'new'], {
            queryParams: {
              prospectName: app.prospectName,
              prospectPhone: app.prospectPhone,
              returnAppointmentId: app.id,
            },
          });
          return;
        }
        this.loadTodayAppointments();
      },
      error: (err: any) => {
        console.error('Error actualizando estado de cita:', err);
      },
    });
  }

  enterConsultation(id: string) {
    // Redirigir al expediente clínico o sala de consultas
    this.router.navigate(['/appointments'], { queryParams: { active: id } });
  }

  getActiveBranchName(): string {
    const activeId = this.auth.activeBranchId();
    const branch = this.auth.clinicBranches().find((b: any) => b.id === activeId);
    return branch ? branch.name : 'Sede Medellín Metropolitana';
  }

  // ── MÉTODOS DE FORMATO & TRADUCCIÓN ────────────────

  formatCOP(val: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  }

  formatTime(dateStr: string | Date): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  getSpeciesEmoji(sp?: string): string {
    switch (sp?.toLowerCase()) {
      case 'dog':
        return '🐶';
      case 'cat':
        return '🐱';
      case 'rabbit':
        return '🐰';
      case 'bird':
        return '🦜';
      case 'horse':
        return '🐴';
      case 'cow':
        return '🐮';
      case 'pig':
        return '🐷';
      default:
        return '🐾';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'Programada';
      case 'waiting':
        return 'En camino';
      case 'in-progress':
        return 'En visita';
      case 'done':
        return 'Finalizada';
      case 'cancelled':
        return 'Cancelada';
      case 'no_show':
        return 'No asistió';
      default:
        return status;
    }
  }

  getSpeciesStats() {
    const total = this.speciesRawData().reduce((acc, curr) => acc + curr.count, 0) || 1;
    const colors = ['#2563eb', '#9333ea', '#22c55e', '#ea580c', '#facc15'];
    const emojis: Record<string, string> = {
      Perros: '🐶',
      Gatos: '🐱',
      Conejos: '🐰',
      Otros: '🐴',
    };

    return this.speciesRawData().map((s, i) => ({
      name: s.name,
      emoji: emojis[s.name] || '🐾',
      count: s.count,
      percent: Math.round((s.count / total) * 100),
      color: colors[i % colors.length],
    }));
  }
}
