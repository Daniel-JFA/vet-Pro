import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TutorAuthService } from '../../core/services/tutor-auth.service';

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="portal-layout">
      <!-- Barra Superior (Marca de la Clínica) -->
      <header class="portal-topbar">
        <div class="clinic-info" *ngIf="authSvc.clinic() as clinic">
          <span class="material-symbols-outlined clinic-icon">local_hospital</span>
          <div class="clinic-meta">
            <h2>{{ clinic.name }}</h2>
            <p>{{ clinic.city }} · Portal del Tutor</p>
          </div>
        </div>

        <div class="tutor-profile" *ngIf="authSvc.tutor() as tutor">
          <div class="avatar">
            {{ tutor.firstName.charAt(0) }}{{ tutor.lastName.charAt(0) }}
          </div>
        </div>
      </header>

      <!-- Área de Contenido Principal -->
      <main class="portal-main">
        <router-outlet></router-outlet>
      </main>

      <!-- Barra de Navegación Flotante Inferior (iOS/Android TabBar Style) -->
      <nav class="portal-tabbar">
        <div class="tabbar-container">
          <a routerLink="./dashboard" routerLinkActive="active" class="tabbar-item">
            <span class="material-symbols-outlined tab-icon">pets</span>
            <span class="tab-label">Mis Mascotas</span>
          </a>

          <a routerLink="./booking" routerLinkActive="active" class="tabbar-item">
            <span class="material-symbols-outlined tab-icon">calendar_month</span>
            <span class="tab-label">Reservar Cita</span>
          </a>

          <button (click)="onLogout()" class="tabbar-item logout-btn">
            <span class="material-symbols-outlined tab-icon">logout</span>
            <span class="tab-label">Salir</span>
          </button>
        </div>
      </nav>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, hsl(162, 70%, 10%) 0%, hsl(220, 25%, 6%) 100%);
      font-family: 'Inter', system-ui, sans-serif;
      color: #f3f4f6;
    }

    .portal-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding-bottom: 96px; /* Espacio para que la TabBar flotante no tape contenido */
      box-sizing: border-box;
    }

    /* ── BARRA SUPERIOR ───────────────────────────────────── */
    .portal-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: rgba(17, 24, 39, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      position: sticky;
      top: 0;
      z-index: 100;

      .clinic-info {
        display: flex;
        align-items: center;
        gap: 12px;

        .clinic-icon {
          font-size: 1.8rem;
          color: #34d399;
          background: rgba(16, 185, 129, 0.1);
          padding: 8px;
          border-radius: 12px;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .clinic-meta {
          h2 {
            font-size: 0.95rem;
            font-weight: 800;
            color: #ffffff;
            margin: 0;
            letter-spacing: -0.2px;
          }

          p {
            font-size: 0.75rem;
            color: #9ca3af;
            margin: 2px 0 0;
          }
        }
      }

      .tutor-profile {
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 700;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 10px rgba(5, 150, 105, 0.25);
        }
      }
    }

    /* ── CONTENIDO PRINCIPAL ────────────────────────────── */
    .portal-main {
      flex: 1;
      padding: 24px;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }

    /* ── TABBAR FLOTANTE INFERIOR ────────────────────────── */
    .portal-tabbar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 48px);
      max-width: 500px;
      z-index: 100;

      .tabbar-container {
        display: flex;
        justify-content: space-around;
        align-items: center;
        background: rgba(17, 24, 39, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 8px 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.05);
      }

      .tabbar-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        color: #9ca3af;
        text-decoration: none;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 12px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: inherit;

        .tab-icon {
          font-size: 1.45rem;
          transition: transform 0.25s ease;
        }

        .tab-label {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        &:hover {
          color: #e2e8f0;
        }

        &.active {
          color: #34d399;
          background: rgba(16, 185, 129, 0.08);

          .tab-icon {
            transform: scale(1.1);
            font-variation-settings: 'FILL' 1;
          }
        }
      }

      .logout-btn {
        &:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.08);
        }
      }
    }

    /* Adaptabilidad a pantallas de escritorio */
    @media (min-width: 768px) {
      .portal-topbar {
        padding: 20px 48px;
      }
      .portal-main {
        padding: 40px 24px;
      }
      .portal-tabbar {
        bottom: 32px;
      }
    }
  `]
})
export class PortalShellComponent {
  authSvc = inject(TutorAuthService);

  onLogout() {
    this.authSvc.logout();
  }
}
