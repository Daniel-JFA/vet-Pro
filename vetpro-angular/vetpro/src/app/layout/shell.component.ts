import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  template: `
    <div class="shell">
      <!-- Backdrop Overlay for Mobile -->
      <div class="sidebar-overlay" *ngIf="mobileSidebarOpen()" (click)="mobileSidebarOpen.set(false)"></div>

      <!-- Sidebar -->
      <nav class="sidebar" [class.collapsed]="sidebarCollapsed()" [class.mobile-open]="mobileSidebarOpen()">
        <div class="sidebar-header">
          <div class="logo-mark">
            <span class="logo-icon">V</span>
            <span class="logo-text">VetPro</span>
          </div>
          <button class="collapse-btn" (click)="sidebarCollapsed.update(v => !v)" aria-label="Toggle sidebar">
            <span class="material-symbols-outlined">{{ sidebarCollapsed() ? 'chevron_right' : 'chevron_left' }}</span>
          </button>
        </div>

        <div class="clinic-badge" *ngIf="auth.currentClinic as clinic">
          <span class="clinic-name">{{ clinic.name }}</span>
          <span class="plan-chip">{{ clinic.plan }}</span>
        </div>

        <div class="nav-section">
          <span class="nav-label">Principal</span>
          <a *ngFor="let item of mainNav()" class="nav-link" [routerLink]="item.path" routerLinkActive="active" (click)="mobileSidebarOpen.set(false)">
            <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
            <span class="nav-badge" *ngIf="item.badge">{{ item.badge }}</span>
          </a>
        </div>

        <div class="nav-section" *ngIf="managementNav().length > 0">
          <span class="nav-label">Gestión</span>
          <a *ngFor="let item of managementNav()" class="nav-link" [routerLink]="item.path" routerLinkActive="active" (click)="mobileSidebarOpen.set(false)">
            <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
          </a>
        </div>

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
          <button class="hamburger-btn" (click)="mobileSidebarOpen.set(true)" aria-label="Abrir menú">
            <span class="material-symbols-outlined">menu</span>
          </button>

          <div class="topbar-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Buscar paciente, tutor, cita… (Cmd+K)" />
          </div>
          
          <div class="topbar-actions">
            <!-- Selector de Sucursales / Sedes Dinámico -->
            <div class="topbar-branch" *ngIf="auth.clinicBranches().length > 0">
              <span class="material-symbols-outlined branch-icon">location_on</span>
              <!-- Dropdown editable para Administradores -->
              <select 
                *ngIf="auth.currentUser?.role === 'admin'; else fixedBranch"
                [ngModel]="auth.activeBranchId()"
                (ngModelChange)="onBranchChange($event)"
                class="branch-select"
              >
                <option *ngFor="let b of auth.clinicBranches()" [value]="b.id">{{ b.name }}</option>
              </select>
              <!-- Nombre fijo para Staff sin permisos admin -->
              <ng-template #fixedBranch>
                <span class="branch-name">{{ getActiveBranchName() }}</span>
              </ng-template>
            </div>

            <button class="icon-btn" aria-label="Notificaciones">
              <span class="material-symbols-outlined">notifications</span>
              <span class="notif-dot"></span>
            </button>
            <div class="user-chip" *ngIf="auth.currentUser as user">
              <div class="user-avatar">{{ user.firstName[0] }}{{ user.lastName[0] }}</div>
              <span class="user-name">{{ user.firstName }} ({{ getRoleLabel(user.role) }})</span>
            </div>
          </div>
        </header>

        <div class="page-content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  auth = inject(AuthService);
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);

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
    const baseNav: NavItem[] = [
      { label: 'Inicio',               icon: 'home',           path: '/dashboard' },
      { label: 'Pacientes',            icon: 'pets',           path: '/patients' },
      { label: 'Citas & Agenda',       icon: 'calendar_month', path: '/appointments', badge: 3 },
      { label: 'Domicilios On-Demand', icon: 'two_wheeler',    path: '/appointments/on-demand' }
    ];

    // Solo roles clínicos ven historia clínica y hospitalización
    if (role === 'admin' || role === 'vet' || role === 'assistant') {
      baseNav.push(
        { label: 'Historia clínica',   icon: 'description',    path: '/medical-records' },
        { label: 'Hospitalización',    icon: 'local_hospital', path: '/medical-records/hospitalization' }
      );
    }

    // Paseadores ven su propia agenda de paseos
    if (role === 'walker') {
      baseNav.push(
        { label: 'Mis Paseos',         icon: 'directions_walk', path: '/walkers/mis-paseos' }
      );
    }

    return baseNav;
  });

  // Filtrado reactivo de links de gestión según el Rol
  managementNav = computed(() => {
    const role = this.auth.currentUser?.role;
    const items: NavItem[] = [];

    if (role === 'admin') {
      items.push(
        { label: 'Inventario',      icon: 'inventory_2',     path: '/inventory' },
        { label: 'Facturación',     icon: 'receipt_long',    path: '/billing' },
        { label: 'Consentimientos', icon: 'draw',            path: '/consent' },
        { label: 'Notificaciones',  icon: 'campaign',        path: '/notifications' },
        { label: 'Reportes',        icon: 'bar_chart',       path: '/reports' }
      );
    } else if (role === 'vet') {
      items.push(
        { label: 'Inventario',      icon: 'inventory_2',     path: '/inventory' },
        { label: 'Facturación',     icon: 'receipt_long',    path: '/billing' },
        { label: 'Consentimientos', icon: 'draw',            path: '/consent' }
      );
    } else if (role === 'receptionist') {
      items.push(
        { label: 'Facturación',     icon: 'receipt_long',    path: '/billing' },
        { label: 'Notificaciones',  icon: 'campaign',        path: '/notifications' }
      );
    } else if (role === 'walker') {
      items.push(
        { label: 'Mi Perfil',       icon: 'account_circle',  path: '/walkers/perfil' }
      );
    }

    // Admin ve gestión de paseadores
    if (role === 'admin') {
      items.push(
        { label: 'Paseadores',      icon: 'directions_walk', path: '/walkers' }
      );
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
    const branch = this.auth.clinicBranches().find(b => b.id === activeId);
    return branch ? branch.name : 'Sede única';
  }

  // Etiqueta legible de roles en español
  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin': return 'Admin';
      case 'vet': return 'Médico Vet';
      case 'assistant': return 'Asistente';
      case 'receptionist': return 'Recepción';
      case 'walker': return 'Paseador';
      default: return role;
    }
  }
}
