import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ReportService } from '../../core/services/report.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { Appointment } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      
      <!-- 🌟 BANNER DE BIENVENIDA PREMIUM -->
      <div class="welcome-banner">
        <div class="banner-overlay"></div>
        <div class="banner-content">
          <div class="banner-text">
            <h1 class="greeting">
              ¡Hola, {{ auth.currentUser?.firstName }}! 👋
            </h1>
            <p class="subtext">
              Tu panel de control de <strong>VetPro</strong> está al día.
              Tienes <span class="highlight">{{ todayAppointments().length }} visitas domiciliarias</span> programadas para hoy en Medellín.
            </p>
          </div>
          <div class="banner-badge">
            <span class="material-symbols-outlined">location_on</span>
            <span>Sede: {{ getActiveBranchName() }}</span>
          </div>
        </div>
      </div>

      <!-- 📊 CUADRICULA DE KPIs DINÁMICOS -->
      <div class="stats-grid" *ngIf="!loadingStats(); else skeletonGrid">
        
        <!-- KPI 1: Ingresos del Mes -->
        <div class="stat-card" routerLink="/billing">
          <div class="stat-header">
            <div class="icon-wrapper revenue">
              <span class="material-symbols-outlined">payments</span>
            </div>
            <span class="trend-badge" [class.positive]="kpis().revenue.growth >= 0">
              <span class="material-symbols-outlined">trending_up</span>
              {{ kpis().revenue.growth >= 0 ? '+' : '' }}{{ kpis().revenue.growth }}% MoM
            </span>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ formatCOP(kpis().revenue.current) }}</span>
            <span class="stat-label">Ingresos del Mes</span>
          </div>
        </div>

        <!-- KPI 2: Consultas Realizadas -->
        <div class="stat-card" routerLink="/medical-records">
          <div class="stat-header">
            <div class="icon-wrapper consultations">
              <span class="material-symbols-outlined">medical_services</span>
            </div>
            <span class="trend-badge positive">
              <span class="material-symbols-outlined">trending_up</span>
              +{{ kpis().consultations.growth }}% MoM
            </span>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ kpis().consultations.current }}</span>
            <span class="stat-label">Consultas Clínicas</span>
          </div>
        </div>

        <!-- KPI 3: Mascotas Registradas -->
        <div class="stat-card" routerLink="/patients">
          <div class="stat-header">
            <div class="icon-wrapper patients">
              <span class="material-symbols-outlined">pets</span>
            </div>
            <span class="trend-badge positive">
              <span class="material-symbols-outlined">trending_up</span>
              +{{ kpis().newPatients.growth }}% MoM
            </span>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ kpis().newPatients.current }}</span>
            <span class="stat-label">Nuevos Pacientes</span>
          </div>
        </div>

        <!-- KPI 4: Tasa de Retención -->
        <div class="stat-card">
          <div class="stat-header">
            <div class="icon-wrapper retention">
              <span class="material-symbols-outlined">volunteer_activism</span>
            </div>
            <span class="trend-badge positive">
              <span class="material-symbols-outlined">verified</span>
              Saludable
            </span>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ kpis().retentionRate.current }}%</span>
            <span class="stat-label">Retención de Tutores</span>
          </div>
        </div>

      </div>

      <!-- SKELETON LOADER PARA KPIs -->
      <ng-template #skeletonGrid>
        <div class="stats-grid">
          <div class="stat-card skeleton" *ngFor="let i of [1,2,3,4]">
            <div class="skeleton-header"></div>
            <div class="skeleton-body1"></div>
            <div class="skeleton-body2"></div>
          </div>
        </div>
      </ng-template>

      <!-- ⚡ SPLIT DE CONTENIDO PRINCIPAL -->
      <div class="dashboard-split">
        
        <!-- 🗺️ COLUMNA IZQUIERDA: ITINERARIO DE HOY (Ruta Domiciliaria) -->
        <div class="itinerary-panel">
          <div class="panel-header">
            <div class="header-title">
              <span class="material-symbols-outlined title-icon">local_shipping</span>
              <h2>Itinerario de Visitas a Domicilio (Hoy)</h2>
            </div>
            <span class="count-pill">{{ todayAppointments().length }} Visitas</span>
          </div>

          <div class="itinerary-list" *ngIf="!loadingAppts(); else skeletonItinerary">
            
            <!-- Si no hay visitas para hoy -->
            <div class="empty-state" *ngIf="todayAppointments().length === 0">
              <span class="material-symbols-outlined empty-icon">assignment_turned_in</span>
              <p class="empty-text">¡Buen trabajo! No tienes más visitas domiciliarias programadas para hoy.</p>
              <button class="btn-primary" routerLink="/appointments">Agendar cita</button>
            </div>

            <!-- Listado de tarjetas de visitas -->
            <div 
              *ngFor="let app of todayAppointments(); let idx = index" 
              class="itinerary-card" 
              [class.active]="app.status === 'in-progress'"
              [class.done]="app.status === 'done'"
            >
              <div class="card-time">
                <span class="time-label">{{ formatTime(app.scheduledAt) }}</span>
                <span class="order-dot">#{{ idx + 1 }}</span>
              </div>

              <div class="card-details">
                <div class="details-main">
                  <div class="patient-info">
                    <span class="patient-emoji">{{ getSpeciesEmoji(app.patient?.species) }}</span>
                    <div class="patient-meta">
                      <span class="patient-name">{{ app.patient?.name }}</span>
                      <span class="patient-breed">{{ app.patient?.breed || 'Sin raza' }}</span>
                    </div>
                  </div>
                  <span class="status-badge" [class]="app.status">
                    {{ getStatusLabel(app.status) }}
                  </span>
                </div>

                <div class="details-meta">
                  <div class="meta-row">
                    <span class="material-symbols-outlined meta-icon">person</span>
                    <span>Tutor: <strong>{{ app.patient?.tutor?.firstName }} {{ app.patient?.tutor?.lastName }}</strong></span>
                  </div>
                  <div class="meta-row">
                    <span class="material-symbols-outlined meta-icon">location_on</span>
                    <span class="address-text">{{ app.notes || 'No registrada' }}</span>
                  </div>
                  <div class="meta-row">
                    <span class="material-symbols-outlined meta-icon">stethoscope</span>
                    <span>Motivo: <em>{{ app.reason || app.serviceType }}</em></span>
                  </div>
                </div>

                <!-- Botones de Acción contextuales del Domiciliario -->
                <div class="card-actions">
                  <button 
                    *ngIf="app.status === 'scheduled'" 
                    class="btn-action-start" 
                    (click)="updateAppointmentStatus(app.id, 'waiting')"
                  >
                    <span class="material-symbols-outlined">directions_car</span> En camino
                  </button>
                  <button 
                    *ngIf="app.status === 'waiting'" 
                    class="btn-action-enter" 
                    (click)="updateAppointmentStatus(app.id, 'in-progress')"
                  >
                    <span class="material-symbols-outlined">login</span> Iniciar visita
                  </button>
                  <button 
                    *ngIf="app.status === 'in-progress'" 
                    class="btn-action-consultation"
                    (click)="enterConsultation(app.id)"
                  >
                    <span class="material-symbols-outlined">clinical_notes</span> Completar SOAP
                  </button>
                  <button 
                    *ngIf="app.status === 'done'" 
                    class="btn-action-done" 
                    routerLink="/patients/{{ app.patientId }}"
                  >
                    <span class="material-symbols-outlined">visibility</span> Ver historial
                  </button>
                </div>
              </div>
            </div>

          </div>

          <ng-template #skeletonItinerary>
            <div class="itinerary-list">
              <div class="itinerary-card skeleton-card" *ngFor="let i of [1,2,3]">
                <div class="skeleton-time"></div>
                <div class="skeleton-details"></div>
              </div>
            </div>
          </ng-template>
        </div>

        <!-- 🦊 COLUMNA DERECHA: ACCIONES RÁPIDAS Y METAS -->
        <div class="sidebar-panel">
          
          <!-- Acciones Rápidas -->
          <div class="sidebar-card actions-card">
            <h3>Acciones Clínicas Rápidas</h3>
            <div class="action-buttons">
              <button class="action-btn" routerLink="/patients/new">
                <span class="material-symbols-outlined icon pet">person_add</span>
                <div class="btn-label">
                  <strong>Nuevo Paciente</strong>
                  <span>Registrar mascota y tutor</span>
                </div>
              </button>

              <button class="action-btn" routerLink="/appointments">
                <span class="material-symbols-outlined icon appointment">calendar_add_on</span>
                <div class="btn-label">
                  <strong>Nueva Cita</strong>
                  <span>Programar en el calendario</span>
                </div>
              </button>

              <button class="action-btn" routerLink="/inventory">
                <span class="material-symbols-outlined icon inventory">inventory_2</span>
                <div class="btn-label">
                  <strong>Inventario Domicilio</strong>
                  <span>Medicamentos portátiles</span>
                </div>
              </button>

              <button class="action-btn" routerLink="/billing">
                <span class="material-symbols-outlined icon billing">receipt_long</span>
                <div class="btn-label">
                  <strong>Emitir Factura</strong>
                  <span>Registrar cobro en sitio</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Distribución de Especies (Mini Widget Visual) -->
          <div class="sidebar-card species-card" *ngIf="!loadingStats()">
            <h3>Distribución de Especies</h3>
            <p class="card-subtitle">Diversidad de pacientes atendidos en el sistema</p>
            <div class="species-list">
              
              <div class="species-row" *ngFor="let s of getSpeciesStats()">
                <div class="species-header">
                  <div class="species-title">
                    <span class="species-emoji">{{ s.emoji }}</span>
                    <span class="species-name">{{ s.name }}</span>
                  </div>
                  <span class="species-count">{{ s.count }} ({{ s.percent }}%)</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="s.percent" [style.background-color]="s.color"></div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 40px;
      animation: fadeIn 0.4s ease-out;
    }

    // ── BANNER DE BIENVENIDA ───────────────────────
    .welcome-banner {
      position: relative;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      border-radius: 16px;
      padding: 28px;
      color: #ffffff;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.15), 0 8px 10px -6px rgba(37, 99, 235, 0.1);
    }
    .banner-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
      pointer-events: none;
    }
    .banner-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
    }
    .greeting {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }
    .subtext {
      font-size: 14px;
      opacity: 0.9;
      margin: 0;
      line-height: 1.5;
      strong { color: #facc15; }
    }
    .highlight {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .banner-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
      span.material-symbols-outlined { font-size: 18px; color: #facc15; }
    }

    // ── GRID DE KPIs ──────────────────────────────
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .stat-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
      
      &:hover {
        transform: translateY(-4px);
        border-color: var(--primary-color);
        box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.08), 0 4px 6px -2px rgba(37, 99, 235, 0.03);
      }
    }
    .stat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .icon-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      span { font-size: 20px; }
      
      &.revenue { background: #eff6ff; color: #2563eb; }
      &.consultations { background: #faf5ff; color: #9333ea; }
      &.patients { background: #f0fdf4; color: #22c55e; }
      &.retention { background: #fff7ed; color: #ea580c; }
    }
    .trend-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 20px;
      background: var(--surface-hover);
      color: var(--text-color-secondary);
      span { font-size: 14px; }
      
      &.positive { background: #f0fdf4; color: #16a34a; }
    }
    .stat-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-color);
      letter-spacing: -0.01em;
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-color-secondary);
      font-weight: 500;
    }

    // SKELETON CARD
    .stat-card.skeleton {
      pointer-events: none;
      .skeleton-header { width: 40px; height: 40px; border-radius: 10px; background: var(--surface-border); }
      .skeleton-body1 { width: 70%; height: 24px; border-radius: 4px; background: var(--surface-border); margin-top: 10px; }
      .skeleton-body2 { width: 45%; height: 14px; border-radius: 4px; background: var(--surface-border); margin-top: 5px; }
      background: var(--surface-card);
      border-color: var(--surface-border);
      animation: pulse 1.5s infinite ease-in-out;
    }

    // ── SPLIT PRINCIPAL ──────────────────────────
    .dashboard-split {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 20px;
      
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    // ── ITINERARIO DE HOY (IZQUIERDA) ─────────────
    .itinerary-panel {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 16px;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      h2 { font-size: 16px; font-weight: 600; margin: 0; color: var(--text-color); }
      .title-icon { color: var(--primary-color); font-size: 22px; }
    }
    .count-pill {
      font-size: 11px;
      font-weight: 600;
      color: var(--primary-700);
      background: var(--primary-50);
      border: 1px solid var(--primary-200);
      padding: 4px 10px;
      border-radius: 20px;
    }
    .itinerary-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    // Tarjeta del Itinerario
    .itinerary-card {
      display: flex;
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      background: var(--surface-ground);
      overflow: hidden;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: var(--surface-border);
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      }
      
      &.active {
        border-color: var(--primary-300);
        background: #eff6ff;
        .order-dot { background: var(--primary-color); color: #fff; }
      }
      
      &.done {
        opacity: 0.85;
        border-color: var(--surface-border);
        background: var(--surface-card);
        .order-dot { background: var(--green-500); color: #fff; }
      }
    }
    .card-time {
      width: 90px;
      min-width: 90px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-right: 1px dashed var(--surface-border);
      background: rgba(0, 0, 0, 0.01);
      padding: 16px;
      gap: 8px;
    }
    .time-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-color);
      text-align: center;
    }
    .order-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--surface-border);
      color: var(--text-color-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }
    .card-details {
      flex: 1;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .details-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .patient-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .patient-emoji {
      font-size: 24px;
    }
    .patient-meta {
      display: flex;
      flex-direction: column;
    }
    .patient-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
    }
    .patient-breed {
      font-size: 11px;
      color: var(--text-color-secondary);
    }
    .status-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      padding: 3px 8px;
      border-radius: 4px;
      
      &.scheduled { background: var(--yellow-50); color: var(--yellow-700); border: 1px solid var(--yellow-400); }
      &.waiting { background: var(--orange-50); color: var(--orange-700); border: 1px solid var(--orange-100); }
      &.in-day, &.in-progress { background: #eff6ff; color: #1d4ed8; border: 1px solid var(--primary-200); animation: softPulse 2s infinite ease-in-out; }
      &.done { background: var(--green-50); color: var(--green-700); border: 1px solid var(--green-400); }
      &.cancelled { background: var(--red-50); color: var(--red-700); border: 1px solid var(--red-100); }
      &.no_show { background: var(--red-50); color: var(--red-700); border: 1px solid var(--red-100); }
    }
    .details-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: var(--text-color-secondary);
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      strong { color: var(--text-color); }
    }
    .meta-icon {
      font-size: 16px;
      color: var(--text-color-secondary);
    }
    .address-text {
      color: var(--text-color);
      font-weight: 500;
    }
    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
      
      button {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        span { font-size: 16px; }
      }
      
      .btn-action-start {
        background: var(--yellow-500);
        color: var(--yellow-800);
        &:hover { background: var(--yellow-400); }
      }
      .btn-action-enter {
        background: var(--orange-600);
        color: #fff;
        &:hover { background: var(--orange-700); }
      }
      .btn-action-consultation {
        background: var(--primary-color);
        color: #fff;
        &:hover { background: var(--primary-700); }
      }
      .btn-action-done {
        background: var(--surface-hover);
        color: var(--text-color);
        border: 1px solid var(--surface-border);
        &:hover { background: var(--surface-border); }
      }
    }

    // EMPTY STATE ITINERARIO
    .empty-state {
      padding: 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      
      .empty-icon { font-size: 48px; color: var(--text-color-secondary); opacity: 0.5; }
      .empty-text { font-size: 13px; color: var(--text-color-secondary); margin: 0; }
      .btn-primary {
        background: var(--primary-color);
        color: #fff;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        &:hover { background: var(--primary-700); }
      }
    }

    // SKELETON ITINERARY CARD
    .skeleton-card {
      height: 140px;
      animation: pulse 1.5s infinite ease-in-out;
      background: var(--surface-ground);
      border-color: var(--surface-border);
      pointer-events: none;
      .skeleton-time { width: 90px; height: 100%; background: var(--surface-border); }
      .skeleton-details { flex: 1; height: 100%; padding: 16px; background: transparent; }
    }

    // ── SIDEBAR PANEL (DERECHA) ───────────────────
    .sidebar-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .sidebar-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 24px;
      
      h3 { font-size: 14px; font-weight: 600; margin: 0 0 16px 0; color: var(--text-color); }
      .card-subtitle { font-size: 11px; color: var(--text-color-secondary); margin: -10px 0 20px 0; }
    }

    // Botones de Acciones Rapidas
    .action-buttons {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--surface-ground);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: var(--primary-color);
        background: var(--primary-50);
        transform: translateX(4px);
      }
      
      .icon {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        
        &.pet { background: #eff6ff; color: #2563eb; }
        &.appointment { background: #faf5ff; color: #9333ea; }
        &.inventory { background: #f0fdf4; color: #22c55e; }
        &.billing { background: #fff7ed; color: #ea580c; }
      }
      .btn-label {
        display: flex;
        flex-direction: column;
        strong { font-size: 13px; color: var(--text-color); }
        span { font-size: 11px; color: var(--text-color-secondary); margin-top: 2px; }
      }
    }

    // Mini Widget de Especies
    .species-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .species-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .species-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
    }
    .species-title {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .species-emoji { font-size: 16px; }
    .species-name { font-weight: 600; color: var(--text-color); }
    .species-count { color: var(--text-color-secondary); font-weight: 500; }
    
    .progress-bar {
      height: 6px;
      background: var(--surface-hover);
      border-radius: 10px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 10px;
      transition: width 0.8s ease-out;
    }

    // ── ANIMACIONES ──────────────────────────────
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }
    @keyframes softPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
    }
  `]
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
    retentionRate: { current: 0, growth: 0 }
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
      next: res => {
        this.kpis.set(res.kpis);
        if (res.charts && res.charts.speciesDistribution) {
          const labels = res.charts.speciesDistribution.labels;
          const data = res.charts.speciesDistribution.data;
          
          const raw = labels.map((l: string, i: number) => ({
            name: l,
            count: data[i]
          }));
          this.speciesRawData.set(raw);
        }
        this.loadingStats.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando KPIs:', err);
        this.loadingStats.set(false);
      }
    });
  }

  loadTodayAppointments() {
    this.loadingAppts.set(true);
    this.appts.getTodayAppointments().subscribe({
      next: res => {
        // Ordenar cronológicamente
        res.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        this.todayAppointments.set(res);
        this.loadingAppts.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando citas de hoy:', err);
        this.loadingAppts.set(false);
      }
    });
  }

  updateAppointmentStatus(id: string, status: Appointment['status']) {
    this.appts.updateStatus(id, status).subscribe({
      next: () => {
        this.loadTodayAppointments();
      },
      error: (err: any) => {
        console.error('Error actualizando estado de cita:', err);
      }
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
      maximumFractionDigits: 0
    }).format(val);
  }

  formatTime(dateStr: string | Date): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  getSpeciesEmoji(sp?: string): string {
    switch (sp?.toLowerCase()) {
      case 'dog': return '🐶';
      case 'cat': return '🐱';
      case 'rabbit': return '🐰';
      case 'bird': return '🦜';
      case 'horse': return '🐴';
      case 'cow': return '🐮';
      case 'pig': return '🐷';
      default: return '🐾';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'scheduled': return 'Programada';
      case 'waiting': return 'En camino';
      case 'in-progress': return 'En visita';
      case 'done': return 'Finalizada';
      case 'cancelled': return 'Cancelada';
      case 'no_show': return 'No asistió';
      default: return status;
    }
  }

  getSpeciesStats() {
    const total = this.speciesRawData().reduce((acc, curr) => acc + curr.count, 0) || 1;
    const colors = ['#2563eb', '#9333ea', '#22c55e', '#ea580c', '#facc15'];
    const emojis: Record<string, string> = {
      'Perros': '🐶',
      'Gatos': '🐱',
      'Conejos': '🐰',
      'Otros': '🐴'
    };

    return this.speciesRawData().map((s, i) => ({
      name: s.name,
      emoji: emojis[s.name] || '🐾',
      count: s.count,
      percent: Math.round((s.count / total) * 100),
      color: colors[i % colors.length]
    }));
  }
}
