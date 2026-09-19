import { Component, inject, signal, computed, HostListener, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { AppointmentService } from '../core/services/appointment.service';
import { ToastContainerComponent } from '../shared/components/toast/toast-container.component';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, ToastContainerComponent],
  template: `
    <div class="shell">
      <!-- Backdrop Overlay for Mobile -->
      @if (mobileSidebarOpen()) {
        <div class="sidebar-overlay" (click)="mobileSidebarOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <nav
        class="sidebar"
        [class.collapsed]="sidebarCollapsed()"
        [class.mobile-open]="mobileSidebarOpen()"
      >
        <div class="sidebar-header">
          <div class="logo-mark">
            <span class="logo-icon">V</span>
            <span class="logo-text">VetPro</span>
          </div>
          <button
            class="collapse-btn"
            (click)="sidebarCollapsed.update((v) => !v)"
            aria-label="Toggle sidebar"
          >
            <span class="material-symbols-outlined">{{
              sidebarCollapsed() ? 'chevron_right' : 'chevron_left'
            }}</span>
          </button>
        </div>

        @if (auth.currentClinic; as clinic) {
          <div class="clinic-badge">
            <span class="clinic-name">{{ clinic.name }}</span>
            <span class="plan-chip">{{ clinic.plan }}</span>
          </div>
        }

        <div class="nav-section">
          <span class="nav-label">Principal</span>
          @for (item of mainNav(); track item) {
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              (click)="mobileSidebarOpen.set(false)"
            >
              <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
              <span class="nav-text">{{ item.label }}</span>
              @if (item.badge) {
                <span class="nav-badge">{{ item.badge }}</span>
              }
            </a>
          }
        </div>

        @if (managementNav().length > 0) {
          <div class="nav-section">
            <span class="nav-label">Gestión</span>
            @for (item of managementNav(); track item) {
              <a
                class="nav-link"
                [routerLink]="item.path"
                routerLinkActive="active"
                (click)="mobileSidebarOpen.set(false)"
              >
                <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
                <span class="nav-text">{{ item.label }}</span>
              </a>
            }
          </div>
        }

        <div class="nav-section mt-auto">
          <button class="nav-link logout-btn" (click)="auth.logout(); mobileSidebarOpen.set(false)">
            <span class="material-symbols-outlined nav-icon">logout</span>
            <span class="nav-text">Cerrar sesión</span>
          </button>
        </div>
      </nav>

      <!-- Main content -->
      <main class="main-area">
        <header class="topbar">
          <button
            class="hamburger-btn"
            (click)="mobileSidebarOpen.set(true)"
            aria-label="Abrir menú"
          >
            <span class="material-symbols-outlined">menu</span>
          </button>

          <div class="topbar-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Buscar paciente, tutor, cita… (Cmd+K)" />
          </div>

          <div class="topbar-actions">
            <!-- Selector de Sucursales / Sedes Dinámico (Estilo OkVet) -->
            @if (auth.currentClinic?.businessType === 'independent_vet') {
              <div class="topbar-branch independent">
                <span class="material-symbols-outlined branch-icon">two_wheeler</span>
                <span class="branch-name">Atención Domiciliaria / Móvil</span>
              </div>
            }

            @if (
              auth.currentClinic?.businessType !== 'independent_vet' &&
              auth.clinicBranches().length > 0
            ) {
              <div class="topbar-branch">
                <span class="material-symbols-outlined branch-icon">location_on</span>
                <!-- Dropdown editable para Administradores -->
                @if (auth.currentUser?.role === 'admin') {
                  <select
                    [ngModel]="auth.activeBranchId()"
                    (ngModelChange)="onBranchChange($event)"
                    class="branch-select"
                  >
                    <option [value]="'all'">🏢 Todas las sedes (Multicentro)</option>
                    @for (b of auth.clinicBranches(); track b) {
                      <option [value]="b.id">{{ b.name }}</option>
                    }
                  </select>
                } @else {
                  <span class="branch-name">{{ getActiveBranchName() }}</span>
                }
                <!-- Nombre fijo para Staff sin permisos admin -->
              </div>
            }

            <button class="icon-btn" aria-label="Notificaciones">
              <span class="material-symbols-outlined">notifications</span>
              <span class="notif-dot"></span>
            </button>
            @if (auth.currentUser; as user) {
              <div class="user-chip">
                <div class="user-avatar">{{ user.firstName[0] }}{{ user.lastName[0] }}</div>
                <span class="user-name">{{ user.firstName }} ({{ getRoleLabel(user.role) }})</span>
              </div>
            }
          </div>
        </header>

        <div class="page-content">
          <router-outlet />
        </div>
      </main>
    </div>
    <app-toast-container />
  `,
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  private appointmentSvc = inject(AppointmentService);
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

  // Citas de hoy que aún no se han atendido — número real, no un valor fijo
  pendingAppointmentsToday = signal<number | undefined>(undefined);

  ngOnInit() {
    this.appointmentSvc.getTodayAppointments().subscribe({
      next: (appointments) => {
        const pending = appointments.filter(
          (a) => a.status === 'scheduled' || a.status === 'waiting',
        ).length;
        this.pendingAppointmentsToday.set(pending > 0 ? pending : undefined);
      },
      error: () => this.pendingAppointmentsToday.set(undefined),
    });
  }

  // Close mobile sidebar menu when Escape key is pressed
  @HostListener('window:keydown.escape')
  onEscapePressed() {
    if (this.mobileSidebarOpen()) {
      this.mobileSidebarOpen.set(false);
    }
  }

  // Filtrado reactivo de links principales de navegación según el Rol
  mainNav = computed(() => {
    const role = this.auth.currentUser?.role;
    // Los paseadores solo trabajan con sus paseos: el backend les niega pacientes, tutores y citas
    const baseNav: NavItem[] =
      role === 'walker'
        ? [{ label: 'Inicio', icon: 'home', path: '/dashboard' }]
        : [
            { label: 'Inicio', icon: 'home', path: '/dashboard' },
            { label: 'Pacientes', icon: 'pets', path: '/patients' },
            { label: 'Tutores', icon: 'group', path: '/tutors' },
            {
              label: 'Citas & Agenda',
              icon: 'calendar_month',
              path: '/appointments',
              badge: this.pendingAppointmentsToday(),
            },
          ];

    // Solo roles clínicos ven historia clínica, hospitalización y laboratorio
    if (role === 'admin' || role === 'vet' || role === 'assistant') {
      baseNav.push(
        { label: 'Historia clínica', icon: 'description', path: '/medical-records' },
        { label: 'Hospitalización', icon: 'local_hospital', path: '/hospitalization' },
        { label: 'Laboratorio', icon: 'biotech', path: '/labs' },
      );
    }

    // Paseadores ven su propia agenda de paseos
    if (role === 'walker') {
      baseNav.push({ label: 'Mis Paseos', icon: 'directions_walk', path: '/walkers/mis-paseos' });
    }

    return baseNav;
  });

  // Filtrado reactivo de links de gestión según el Rol
  managementNav = computed(() => {
    const role = this.auth.currentUser?.role;
    const items: NavItem[] = [];

    if (role === 'admin') {
      items.push(
        { label: 'Equipo & Usuarios', icon: 'manage_accounts', path: '/users' },
        { label: 'Inventario', icon: 'inventory_2', path: '/inventory' },
        { label: 'Facturación & POS', icon: 'receipt_long', path: '/billing' },
        { label: 'Consentimientos', icon: 'draw', path: '/consent' },
        { label: 'CRM Reactivación', icon: 'contact_phone', path: '/crm' },
        { label: 'Reportes', icon: 'bar_chart', path: '/reports' },
      );
    } else if (role === 'vet') {
      items.push(
        { label: 'Inventario', icon: 'inventory_2', path: '/inventory' },
        { label: 'Facturación & POS', icon: 'receipt_long', path: '/billing' },
        { label: 'Consentimientos', icon: 'draw', path: '/consent' },
      );
    } else if (role === 'receptionist') {
      items.push(
        { label: 'Facturación & POS', icon: 'receipt_long', path: '/billing' },
        { label: 'CRM Reactivación', icon: 'contact_phone', path: '/crm' },
      );
    } else if (role === 'walker') {
      items.push({ label: 'Mi Perfil', icon: 'account_circle', path: '/walkers/perfil' });
    }

    // Admin ve gestión de paseadores
    if (role === 'admin') {
      items.push({ label: 'Paseadores', icon: 'directions_walk', path: '/walkers' });
    }

    return items;
  });

  // Evento de cambio de sucursal en el topbar
  onBranchChange(branchId: string) {
    this.auth.changeActiveBranch(branchId);
  }

  // Obtener nombre de sucursal activa
  getActiveBranchName(): string {
    const activeId = this.auth.activeBranchId();
    if (activeId === 'all') return 'Todas las sedes (Multicentro)';
    const branch = this.auth.clinicBranches().find((b) => b.id === activeId);
    return branch ? branch.name : 'Sede única';
  }

  // Etiqueta legible de roles en español
  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'vet':
        return 'Médico Vet';
      case 'assistant':
        return 'Asistente';
      case 'receptionist':
        return 'Recepción';
      case 'walker':
        return 'Paseador';
      default:
        return role;
    }
  }
}
