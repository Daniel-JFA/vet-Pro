import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="shell">
      <!-- Sidebar -->
      <nav class="sidebar" [class.collapsed]="sidebarCollapsed()">
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
          <a *ngFor="let item of mainNav" class="nav-link" [routerLink]="item.path" routerLinkActive="active">
            <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
            <span class="nav-badge" *ngIf="item.badge">{{ item.badge }}</span>
          </a>
        </div>

        <div class="nav-section">
          <span class="nav-label">Gestión</span>
          <a *ngFor="let item of managementNav" class="nav-link" [routerLink]="item.path" routerLinkActive="active">
            <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
          </a>
        </div>

        <div class="nav-section mt-auto">
          <a class="nav-link" routerLink="/settings" routerLinkActive="active">
            <span class="material-symbols-outlined nav-icon">settings</span>
            <span class="nav-text">Configuración</span>
          </a>
          <button class="nav-link logout-btn" (click)="auth.logout()">
            <span class="material-symbols-outlined nav-icon">logout</span>
            <span class="nav-text">Cerrar sesión</span>
          </button>
        </div>
      </nav>

      <!-- Main content -->
      <main class="main-area">
        <header class="topbar">
          <div class="topbar-search">
            <span class="material-symbols-outlined">search</span>
            <input type="text" placeholder="Buscar paciente, tutor, cita… (Cmd+K)" />
          </div>
          <div class="topbar-actions">
            <button class="icon-btn" aria-label="Notificaciones">
              <span class="material-symbols-outlined">notifications</span>
              <span class="notif-dot"></span>
            </button>
            <div class="user-chip" *ngIf="auth.currentUser as user">
              <div class="user-avatar">{{ user.firstName[0] }}{{ user.lastName[0] }}</div>
              <span class="user-name">{{ user.firstName }}</span>
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

  mainNav: NavItem[] = [
    { label: 'Inicio',        icon: 'home',           path: '/dashboard' },
    { label: 'Pacientes',     icon: 'pets',           path: '/patients' },
    { label: 'Citas',         icon: 'calendar_month', path: '/appointments', badge: 3 },
    { label: 'Historia clínica', icon: 'description', path: '/medical-records' },
  ];

  managementNav: NavItem[] = [
    { label: 'Inventario',      icon: 'inventory_2',     path: '/inventory' },
    { label: 'Facturación',     icon: 'receipt_long',    path: '/billing' },
    { label: 'Consentimientos', icon: 'draw',            path: '/consent' },
    { label: 'Notificaciones',  icon: 'campaign',        path: '/notifications' },
    { label: 'Reportes',        icon: 'bar_chart',       path: '/reports' },
  ];
}
