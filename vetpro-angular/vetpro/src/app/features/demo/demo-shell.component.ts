import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DemoDataService } from './demo-data.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/demo/dashboard', icon: '📊' },
    { label: 'Pacientes', path: '/demo/patients', icon: '🐾' },
    { label: 'Citas', path: '/demo/appointments', icon: '📅' },
    { label: 'Domicilios', path: '/demo/walkers', icon: '🏠' },
    { label: 'Historia clínica', path: '/demo/medical-records', icon: '📋' },
    { label: 'Inventario', path: '/demo/inventory', icon: '📦' },
    { label: 'Facturación', path: '/demo/billing', icon: '💳' },
    { label: 'Paseadores', path: '/demo/walkers', icon: '🐕' },
  ],
  vet: [
    { label: 'Dashboard', path: '/demo/dashboard', icon: '📊' },
    { label: 'Pacientes', path: '/demo/patients', icon: '🐾' },
    { label: 'Citas', path: '/demo/appointments', icon: '📅' },
    { label: 'Historia clínica', path: '/demo/medical-records', icon: '📋' },
    { label: 'Inventario', path: '/demo/inventory', icon: '📦' },
  ],
  assistant: [
    { label: 'Dashboard', path: '/demo/dashboard', icon: '📊' },
    { label: 'Pacientes', path: '/demo/patients', icon: '🐾' },
    { label: 'Citas', path: '/demo/appointments', icon: '📅' },
    { label: 'Historia clínica', path: '/demo/medical-records', icon: '📋' },
  ],
  receptionist: [
    { label: 'Dashboard', path: '/demo/dashboard', icon: '📊' },
    { label: 'Pacientes', path: '/demo/patients', icon: '🐾' },
    { label: 'Citas', path: '/demo/appointments', icon: '📅' },
    { label: 'Facturación', path: '/demo/billing', icon: '💳' },
  ],
  walker: [
    { label: 'Mis Paseos', path: '/demo/walkers', icon: '🐕' },
    { label: 'Mi Perfil', path: '/demo/profile', icon: '👤' },
  ],
};

const ROLE_PILLS = [
  { key: 'admin', label: 'Admin' },
  { key: 'vet', label: 'Veterinario' },
  { key: 'assistant', label: 'Asistente' },
  { key: 'receptionist', label: 'Recepcionista' },
  { key: 'walker', label: 'Paseador' },
];

@Component({
  selector: 'app-demo-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="demo-shell">
      <!-- Demo Banner -->
      <div class="demo-banner">
        <span class="demo-banner__icon">🎯</span>
        <span class="demo-banner__text">MODO DEMO — Exploración sin datos reales</span>
        <div class="demo-banner__roles">
          @for (pill of rolePills; track pill.key) {
            <button
              class="role-pill"
              [class.role-pill--active]="demoData.currentRole() === pill.key"
              (click)="demoData.setRole(pill.key)"
            >
              {{ pill.label }}
            </button>
          }
        </div>
      </div>

      <div class="demo-layout">
        <!-- Sidebar -->
        <aside class="demo-sidebar">
          <div class="demo-sidebar__header">
            <span class="demo-sidebar__logo">🐾</span>
            <span class="demo-sidebar__title">VetPro</span>
          </div>

          <nav class="demo-sidebar__nav">
            @for (item of navItems(); track item.path + item.label) {
              <a
                [routerLink]="item.path"
                routerLinkActive="demo-nav-item--active"
                class="demo-nav-item"
              >
                <span class="demo-nav-item__icon">{{ item.icon }}</span>
                <span class="demo-nav-item__label">{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="demo-sidebar__footer">
            <a routerLink="/auth/login" class="demo-back-link">
              ← Ir al sistema real
            </a>
          </div>
        </aside>

        <!-- Main content -->
        <main class="demo-main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .demo-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
    }

    /* Banner */
    .demo-banner {
      background: #f59e0b;
      color: #1c1917;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      font-weight: 600;
      font-size: 14px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(245,158,11,0.4);
    }
    .demo-banner__icon { font-size: 18px; }
    .demo-banner__text { flex: 1; letter-spacing: 0.02em; }
    .demo-banner__roles { display: flex; gap: 6px; flex-wrap: wrap; }

    /* Role pills */
    .role-pill {
      padding: 4px 12px;
      border-radius: 999px;
      border: 2px solid rgba(28,25,23,0.3);
      background: rgba(255,255,255,0.3);
      color: #1c1917;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .role-pill:hover { background: rgba(255,255,255,0.6); }
    .role-pill--active {
      background: #1c1917;
      color: #f59e0b;
      border-color: #1c1917;
    }

    /* Layout */
    .demo-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .demo-sidebar {
      width: 240px;
      min-width: 240px;
      background: #1e293b;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 48px);
    }
    .demo-sidebar__header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .demo-sidebar__logo { font-size: 24px; }
    .demo-sidebar__title { font-size: 18px; font-weight: 700; color: #f59e0b; }
    .demo-sidebar__nav { flex: 1; padding: 12px 0; overflow-y: auto; }
    .demo-sidebar__footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    /* Nav items */
    .demo-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s ease;
      border-left: 3px solid transparent;
    }
    .demo-nav-item:hover {
      background: rgba(255,255,255,0.05);
      color: #e2e8f0;
    }
    .demo-nav-item--active {
      background: rgba(245,158,11,0.12);
      color: #f59e0b;
      border-left-color: #f59e0b;
    }
    .demo-nav-item__icon { font-size: 16px; width: 20px; text-align: center; }
    .demo-nav-item__label { }

    /* Back link */
    .demo-back-link {
      color: #64748b;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color 0.15s;
    }
    .demo-back-link:hover { color: #f59e0b; }

    /* Main content */
    .demo-main {
      flex: 1;
      overflow-y: auto;
      padding: 28px;
    }
  `]
})
export class DemoShellComponent {
  demoData = inject(DemoDataService);
  rolePills = ROLE_PILLS;

  navItems = computed(() => NAV_BY_ROLE[this.demoData.currentRole()] ?? NAV_BY_ROLE['admin']);
}
