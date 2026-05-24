import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing-container">
      <!-- ── TOP GLASSMORPHIC NAVIGATION ── -->
      <nav class="nav-bar">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro<span class="pro-badge">SaaS</span></span>
        </div>
        <div class="nav-links">
          <a href="#features">Características</a>
          <a href="#ai-demo">Dictado IA</a>
          <a href="#tutor-portal">Portal del Tutor</a>
          <a href="#pricing">Precios</a>
          <a href="#faq">Preguntas</a>
        </div>
        <div class="nav-actions">
          <a routerLink="/portal/login" class="btn-secondary-nav">
            <span class="material-symbols-outlined">tactic</span> Portal Tutor
          </a>
          <a routerLink="/auth/login" class="btn-primary-nav">
            <span class="material-symbols-outlined">login</span> Ingresar Staff
          </a>
        </div>
      </nav>

      <!-- ── HERO SECTION ── -->
      <header class="hero-section">
        <div class="hero-content">
          <div class="hero-badge animate-fade-in">
            <span class="sparkle">✦</span> Plataforma Veterinaria Inteligente 2026
          </div>
          <h1 class="hero-title animate-slide-up">
            Revoluciona tu clínica con <br>
            <span class="gradient-text">Inteligencia Artificial</span>
          </h1>
          <p class="hero-subtitle animate-slide-up">
            VetPro combina dictado clínico estructurado con Whisper y Claude AI, notificaciones automáticas por WhatsApp, y un portal PWA Passwordless para tutores. Todo integrado en una hermosa interfaz de alto rendimiento.
          </p>
          <div class="hero-ctas animate-slide-up">
            <a routerLink="/auth/login" class="btn-hero-primary">
              <span class="material-symbols-outlined">rocket_launch</span> Iniciar Demo Gratis
            </a>
            <a href="#ai-demo" class="btn-hero-secondary">
              <span class="material-symbols-outlined">play_circle</span> Probar Transcriptor IA
            </a>
          </div>
          
          <div class="hero-trust">
            <span>✓ Sin tarjeta de crédito</span>
            <span>✓ Cumplimiento Ley 1581 (Habeas Data)</span>
            <span>✓ Fallback Offline para Desarrollo</span>
          </div>
        </div>

        <!-- Hero Mockup Dashboard -->
        <div class="hero-mockup animate-fade-in">
          <div class="mockup-frame">
            <div class="mockup-header">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <div class="mockup-url">app.vetpro.co/dashboard</div>
            </div>
            <div class="mockup-body">
              <div class="mock-sidebar">
                <div class="mock-logo"></div>
                <div class="mock-item active"></div>
                <div class="mock-item"></div>
                <div class="mock-item"></div>
                <div class="mock-item"></div>
              </div>
              <div class="mock-main">
                <div class="mock-header">
                  <div class="mock-title">Panel de Control: Sede Principal</div>
                  <div class="mock-avatar"></div>
                </div>
                <div class="mock-grid">
                  <div class="mock-card">
                    <span class="mock-card-label">Ingresos de Hoy</span>
                    <span class="mock-card-value">$1'450,000 COP</span>
                    <span class="mock-card-trend green">+12.4% vs ayer</span>
                  </div>
                  <div class="mock-card">
                    <span class="mock-card-label">Citas Agendadas</span>
                    <span class="mock-card-value">18 Mascotas</span>
                    <span class="mock-card-trend blue">4 en sala de espera</span>
                  </div>
                  <div class="mock-card">
                    <span class="mock-card-label">Consumo de IA</span>
                    <span class="mock-card-value">84 / 120 min</span>
                    <span class="mock-card-trend orange">Renueva en 6 días</span>
                  </div>
                </div>
                <div class="mock-chart-container">
                  <div class="mock-chart-header">
                    <span>Métricas de Crecimiento</span>
                    <span class="mock-legend">狗 Perros (64%) | 猫 Gatos (31%)</span>
                  </div>
                  <div class="mock-chart-bars">
                    <div class="bar" style="height: 40%"></div>
                    <div class="bar" style="height: 60%"></div>
                    <div class="bar active" style="height: 85%"></div>
                    <div class="bar" style="height: 50%"></div>
                    <div class="bar" style="height: 75%"></div>
                    <div class="bar active" style="height: 95%"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ── SECCIÓN CARACTERÍSTICAS ── -->
      <section id="features" class="features-section">
        <div class="section-header">
          <span class="section-label">¿Por qué VetPro?</span>
          <h2>Diseñado para el Flujo Clínico Moderno</h2>
          <p>Olvídate del papeleo y de software lentos del pasado. VetPro está optimizado al milisegundo.</p>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="icon-wrapper green">
              <span class="material-symbols-outlined">mic</span>
            </div>
            <h3>Dictado Clínico Inteligente</h3>
            <p>Habla con naturalidad sobre el diagnóstico del paciente. Whisper y Claude AI estructuran tu SOAP completo en segundos, ahorrando hasta 3 horas al día.</p>
          </div>

          <div class="feature-card">
            <div class="icon-wrapper blue">
              <span class="material-symbols-outlined">sms</span>
            </div>
            <h3>WhatsApp Recordatorios</h3>
            <p>Envía automáticamente alertas de vacunas, desparasitaciones y recordatorios de citas. Aumenta la tasa de asistencia en más del 35% sin esfuerzo manual.</p>
          </div>

          <div class="feature-card">
            <div class="icon-wrapper purple">
              <span class="material-symbols-outlined">phonelink</span>
            </div>
            <h3>Portal de Tutores PWA</h3>
            <p>Tus clientes acceden inmediatamente a su historial de vacunas, citas y reservas en línea desde su celular con un enlace mágico sin recordar contraseñas.</p>
          </div>

          <div class="feature-card">
            <div class="icon-wrapper orange">
              <span class="material-symbols-outlined">point_of_sale</span>
            </div>
            <h3>Facturación y Caja A4</h3>
            <p>Emite facturas estéticas, controla abonos parciales y genera recibos en formato PDF A4 optimizados para imprimir o enviar por correo de manera instantánea.</p>
          </div>

          <div class="feature-card">
            <div class="icon-wrapper teal">
              <span class="material-symbols-outlined">query_stats</span>
            </div>
            <h3>Métricas de Rendimiento</h3>
            <p>Visualiza gráficos financieros interactivos, distribución de especies y alertas de stock mínimo para tomar decisiones de negocio inteligentes.</p>
          </div>

          <div class="feature-card">
            <div class="icon-wrapper red">
              <span class="material-symbols-outlined">shield</span>
            </div>
            <h3>Seguridad y Habeas Data</h3>
            <p>Manejo de firmas de consentimientos digitales y resguardo de datos clínicos según la Ley 1581 de 2012. Tus datos están completamente blindados y encriptados.</p>
          </div>
        </div>
      </section>

      <!-- ── SECCIÓN DEMO INTERACTIVA DE IA ── -->
      <section id="ai-demo" class="ai-demo-section">
        <div class="demo-grid">
          <div class="demo-text-content">
            <span class="demo-badge">IA EN VIVO</span>
            <h2>Prueba el Transcriptor Clínico Integrado</h2>
            <p>
              Simula el dictado de una consulta veterinaria. VetPro procesa el flujo de voz y extrae automáticamente la Anamnesis, el Examen Físico, la Sospecha Diagnóstica y el Plan de Tratamiento estructurado en formato médico.
            </p>
            <div class="demo-actions">
              <button 
                (click)="startSimulatedRecording()" 
                [disabled]="isRecording() || isAnalyzing()"
                class="btn-record"
              >
                <span class="material-symbols-outlined">{{ isRecording() ? 'fiber_manual_record' : 'mic' }}</span>
                {{ isRecording() ? 'Grabando Audio...' : (isAnalyzing() ? 'Procesando con Claude AI...' : 'Iniciar Dictado de Prueba') }}
              </button>
              <button 
                *ngIf="showNote()" 
                (click)="resetDemo()" 
                class="btn-reset"
              >
                Limpiar
              </button>
            </div>

            <!-- Mic Wave Animation -->
            <div *ngIf="isRecording()" class="wave-container">
              <div class="bar-wave"></div>
              <div class="bar-wave delay-1"></div>
              <div class="bar-wave delay-2"></div>
              <div class="bar-wave delay-3"></div>
              <div class="bar-wave delay-4"></div>
            </div>
          </div>

          <!-- Sandbox Preview Area -->
          <div class="demo-preview-card">
            <div class="preview-header">
              <span class="preview-label">CONSULTA VETERINARIA — TRANSCRIPCIÓN IA</span>
              <span class="preview-status" [class.active]="showNote()">{{ showNote() ? 'Estructurado por Claude AI' : 'Esperando Entrada de Voz' }}</span>
            </div>
            <div class="preview-body">
              <!-- Transcription Output -->
              <div class="audio-transcription" *ngIf="isRecording() || showNote() || isAnalyzing()">
                <div class="avatar-vet"></div>
                <div class="bubble">
                  <span class="speaker">Dr. Daniel Flórez (Audio recibido):</span>
                  <p class="transcription-text">
                    {{ typedSpeech() }}<span class="cursor" *ngIf="isRecording()">|</span>
                  </p>
                </div>
              </div>

              <!-- Structured SOAP Clinical Note -->
              <div class="soap-note-card animate-slide-up" *ngIf="showNote()">
                <div class="soap-badge">SOAP CLINICAL NOTE</div>
                <div class="soap-section">
                  <span class="soap-heading">1. Anamnesis (Subjetivo)</span>
                  <p>Mascota canina "Toby" (Golden Retriever, 5 años). El tutor reporta cojera aguda del miembro posterior derecho tras ejercicio intenso (correr en el parque). Presenta dolor moderado y dificultad para apoyar la pata.</p>
                </div>
                <div class="soap-section">
                  <span class="soap-heading">2. Examen Físico (Objetivo)</span>
                  <p>Constantes fisiológicas estables. Dolor marcado a la palpación profunda de la rodilla derecha. Test de Cajón Anterior moderadamente positivo. Inflamación periarticular evidente.</p>
                </div>
                <div class="soap-section">
                  <span class="soap-heading">3. Sospecha Diagnóstica (Evaluación)</span>
                  <p class="diagnosis-badge">⚠️ Ruptura del Ligamento Cruzado Craneal (LCC) derecho</p>
                </div>
                <div class="soap-section no-border">
                  <span class="soap-heading">4. Plan de Tratamiento (Plan)</span>
                  <ul>
                    <li>Restricción absoluta de ejercicio por 15 días (reposo en jaula/habitación pequeña).</li>
                    <li>Meloxicam 0.1 mg/kg vía oral cada 24 horas por 5 días para dolor e inflamación.</li>
                    <li>Remisión a especialista de ortopedia para programar cirugía correctiva (TPLO / Extracapsular).</li>
                  </ul>
                </div>
              </div>

              <!-- Placeholder when empty -->
              <div class="preview-placeholder" *ngIf="!isRecording() && !showNote() && !isAnalyzing()">
                <span class="material-symbols-outlined icon-placeholder">smart_toy</span>
                <p>Haz clic en "Iniciar Dictado de Prueba" para presenciar la magia de la Inteligencia Artificial estructurando una historia clínica.</p>
              </div>

              <!-- Loader when analyzing -->
              <div class="preview-loader" *ngIf="isAnalyzing()">
                <div class="spinner"></div>
                <p>Claude AI está analizando tu voz, estructurando diagnósticos y recetando dosis según vademécum...</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── SECCIÓN PORTAL DEL TUTOR PWA ── -->
      <section id="tutor-portal" class="tutor-portal-section">
        <div class="tutor-grid">
          <div class="tutor-image-area">
            <!-- Simulated Mobile App -->
            <div class="mobile-frame">
              <div class="mobile-notch"></div>
              <div class="mobile-screen">
                <div class="app-header">
                  <div class="app-brand">VetPro Portal</div>
                  <div class="app-bell"></div>
                </div>
                <div class="app-tutor-profile">
                  <div class="tutor-info">
                    <span class="welcome">Tutor Registrado</span>
                    <span class="tutor-name">Daniel Flórez Aguirre</span>
                  </div>
                  <div class="app-tag-status">3122115299</div>
                </div>

                <div class="pet-slider">
                  <div class="pet-slide-card">
                    <div class="pet-avatar"></div>
                    <div class="pet-details">
                      <span class="pet-name">Toby</span>
                      <span class="pet-breed">Golden Retriever • 5 años</span>
                    </div>
                  </div>
                </div>

                <div class="app-card-vaccines">
                  <div class="card-header-app">
                    <span>💉 Cartilla de Vacunas</span>
                    <span class="btn-view-all">Ver</span>
                  </div>
                  <div class="vaccine-row">
                    <span class="vac-name">Antirrábica</span>
                    <span class="vac-date green">Aplicada hoy ✓</span>
                  </div>
                  <div class="vaccine-row">
                    <span class="vac-name">Triple Felina / Múltiple</span>
                    <span class="vac-date orange">Próxima: 12 Jun</span>
                  </div>
                </div>

                <div class="app-action-bar">
                  <a routerLink="/portal/login" class="app-btn-booking">
                    <span class="material-symbols-outlined">calendar_month</span> Agendar Cita Online
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="tutor-text-content">
            <span class="section-label">PORTAL DEL TUTOR (PWA)</span>
            <h2>Fideliza a tus Clientes con Cero Esfuerzo</h2>
            <p>
              Ofrece a los dueños de mascotas una aplicación web progresiva y moderna en su celular. Acceden mediante enlaces mágicos enviados por WhatsApp sin engorrosos registros.
            </p>
            <ul class="tutor-list">
              <li>
                <span class="material-symbols-outlined check-icon">check_circle</span>
                <strong>Historial Clínico Accesible:</strong> Consulta digital de vacunas e informes médicos.
              </li>
              <li>
                <span class="material-symbols-outlined check-icon">check_circle</span>
                <strong>Agendamiento de Citas 24/7:</strong> Integración de calendario para agendar citas directamente con el veterinario disponible.
              </li>
              <li>
                <span class="material-symbols-outlined check-icon">check_circle</span>
                <strong>Alertas de Próximas Dosis:</strong> Mantiene a los tutores al día con sus vacunas y tratamientos activos.
              </li>
            </ul>
            <div class="tutor-cta">
              <a routerLink="/portal/login" class="btn-tutor-explore">
                <span class="material-symbols-outlined">visibility</span> Probar Portal Tutor Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- ── PLANES DE PRECIOS ── -->
      <section id="pricing" class="pricing-section">
        <div class="section-header">
          <span class="section-label">Planes Flexibles</span>
          <h2>Precios Claros. Diseñados para Crecer</h2>
          <p>Elige el plan ideal para tu clínica o red de hospitales veterinarios. Cancela en cualquier momento.</p>
        </div>

        <div class="pricing-grid">
          <!-- Plan Sede Única -->
          <div class="price-card">
            <div class="plan-header">
              <h3>Plan Inicial Sede</h3>
              <div class="price">
                <span class="currency">$</span>
                <span class="amount">189,000</span>
                <span class="period">/ mes (COP)</span>
              </div>
              <p>Ideal para veterinarios independientes o clínicas de una sola sede física.</p>
            </div>
            <div class="plan-divider"></div>
            <ul class="plan-features">
              <li>✓ 1 Sede Física Principal</li>
              <li>✓ Consultas Médicas Ilimitadas</li>
              <li>✓ Agenda Digital Inteligente</li>
              <li>✓ Portal de Tutores PWA Básico</li>
              <li>✓ 60 minutos de Transcripción IA al mes</li>
              <li>✓ Facturación tradicional PDF</li>
              <li>✓ Soporte por Correo electrónico</li>
            </ul>
            <a routerLink="/auth/login" class="btn-price-secondary">Iniciar Demo de 14 Días</a>
          </div>

          <!-- Plan Multi-Sede Enterprise (Recomendado) -->
          <div class="price-card recommended">
            <div class="featured-badge">MÁS POPULAR</div>
            <div class="plan-header">
              <h3>Plan VetPro Multisede</h3>
              <div class="price">
                <span class="currency">$</span>
                <span class="amount">299,000</span>
                <span class="period">/ mes (COP)</span>
              </div>
              <p>Perfecto para clínicas en crecimiento y redes hospitalarias con múltiples sucursales.</p>
            </div>
            <div class="plan-divider"></div>
            <ul class="plan-features">
              <li>✓ Sucursales Físicas Ilimitadas (Branch Switcher)</li>
              <li>✓ Control de Accesos por Roles (RBAC)</li>
              <li>✓ 120 minutos de Transcripción IA al mes (Whisper)</li>
              <li>✓ Portal de Tutores PWA con Agendamiento de Citas</li>
              <li>✓ Respaldos automáticos a la nube</li>
              <li>✓ Reportes Gerenciales y KPIs Interactivos</li>
              <li>✓ Soporte Prioritario WhatsApp 24/7</li>
            </ul>
            <a routerLink="/auth/login" class="btn-price-primary">Obtener Plan Multisede</a>
          </div>
        </div>
      </section>

      <!-- ── PREGUNTAS FRECUENTES ── -->
      <section id="faq" class="faq-section">
        <div class="section-header">
          <span class="section-label">F.A.Q.</span>
          <h2>Preguntas Frecuentes</h2>
        </div>

        <div class="faq-accordion">
          <div class="faq-item" *ngFor="let item of faqList(); let i = index" [class.open]="openFaq() === i" (click)="toggleFaq(i)">
            <div class="faq-question">
              <h4>{{ item.q }}</h4>
              <span class="material-symbols-outlined faq-toggle-icon">
                {{ openFaq() === i ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}
              </span>
            </div>
            <div class="faq-answer" *ngIf="openFaq() === i">
              <p>{{ item.a }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── CALL TO ACTION FINAL ── -->
      <section class="cta-banner">
        <h2>¿Listo para digitalizar tu clínica veterinaria?</h2>
        <p>Prueba VetPro SaaS gratis por 14 días. Configuración en 3 minutos.</p>
        <a routerLink="/auth/login" class="btn-cta-final">
          <span class="material-symbols-outlined">bolt</span> Comenzar Ahora
        </a>
      </section>

      <!-- ── FOOTER ── -->
      <footer class="footer">
        <div class="footer-grid">
          <div class="footer-brand">
            <span class="logo-mark">V</span>
            <span class="logo-name">VetPro</span>
            <p>El sistema definitivo para clínicas veterinarias del futuro.</p>
          </div>
          <div class="footer-links">
            <h5>Enlaces</h5>
            <a href="#features">Características</a>
            <a href="#ai-demo">Dictado IA</a>
            <a href="#pricing">Precios</a>
          </div>
          <div class="footer-legal">
            <h5>Seguridad</h5>
            <p>Cumplimiento estricto con la Ley 1581 de 2012 de Habeas Data y protección de expedientes médicos confidenciales.</p>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© 2026 VetPro SaaS. Todos los derechos reservados. Desarrollado con 💚 para Clínicas Veterinarias de Colombia.</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    /* ── BASE & GLOBAL THEMING ── */
    :host {
      --primary-color: #10b981; /* Emerald/Teal principal para un wow de salud y modernidad */
      --primary-hover: #059669;
      --indigo-color: #4f46e5;
      --bg-dark: #0f172a; /* Dark background para diseño Sleek y Premium */
      --surface-dark-card: #1e293b;
      --surface-border: #334155;
      --text-white: #f8fafc;
      --text-gray: #94a3b8;
    }

    .landing-container {
      background: var(--bg-dark);
      color: var(--text-white);
      min-height: 100vh;
      font-family: 'Outfit', 'Inter', sans-serif;
      overflow-x: hidden;
      scroll-behavior: smooth;
    }

    /* ── HEADER NAVIGATION BAR ── */
    .nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 8%;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--surface-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-mark {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--primary-color), var(--indigo-color));
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }

    .logo-name {
      font-size: 18px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .pro-badge {
      background: linear-gradient(135deg, var(--primary-color), #06b6d4);
      color: #0f172a;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .nav-links {
      display: flex;
      gap: 24px;
    }

    .nav-links a {
      color: var(--text-gray);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
      &:hover {
        color: var(--primary-color);
      }
    }

    .nav-actions {
      display: flex;
      gap: 12px;
    }

    .btn-primary-nav {
      background: var(--primary-color);
      color: #0f172a;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      &:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
      }
    }

    .btn-secondary-nav {
      border: 1px solid var(--surface-border);
      background: rgba(255, 255, 255, 0.05);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    /* ── HERO SECTION ── */
    .hero-section {
      padding: 80px 8% 100px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      align-items: center;
      gap: 60px;
      background: radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.04) 90%);
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .hero-badge {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: var(--primary-color);
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 30px;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 24px;
    }

    .sparkle {
      animation: blink 1.5s infinite;
    }

    .hero-title {
      font-size: 48px;
      font-weight: 800;
      line-height: 1.15;
      margin: 0 0 20px;
      letter-spacing: -1px;
    }

    .gradient-text {
      background: linear-gradient(135deg, var(--primary-color), #06b6d4, var(--indigo-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      color: var(--text-gray);
      font-size: 17px;
      line-height: 1.6;
      margin: 0 0 32px;
    }

    .hero-ctas {
      display: flex;
      gap: 16px;
      margin-bottom: 40px;
    }

    .btn-hero-primary {
      background: linear-gradient(135deg, var(--primary-color), #059669);
      color: #0f172a;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.25);
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(16, 185, 129, 0.35);
      }
    }

    .btn-hero-secondary {
      border: 1px solid var(--surface-border);
      background: rgba(255, 255, 255, 0.03);
      color: white;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease;
      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    }

    .hero-trust {
      display: flex;
      gap: 20px;
      color: var(--text-gray);
      font-size: 12.5px;
      font-weight: 500;
    }

    /* Hero Mockup Frame Styles */
    .hero-mockup {
      display: flex;
      justify-content: center;
    }

    .mockup-frame {
      background: #0f172a;
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.1);
      overflow: hidden;
    }

    .mockup-header {
      background: #1e293b;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid var(--surface-border);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      &.red { background: #ef4444; }
      &.yellow { background: #eab308; }
      &.green { background: #22c55e; }
    }

    .mockup-url {
      background: #0f172a;
      border-radius: 6px;
      padding: 2px 24px;
      font-size: 9.5px;
      color: var(--text-gray);
      font-family: monospace;
      margin-left: 20px;
    }

    .mockup-body {
      display: flex;
      height: 280px;
    }

    .mock-sidebar {
      background: #1e293b;
      width: 45px;
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      border-right: 1px solid var(--surface-border);
    }

    .mock-logo {
      width: 20px;
      height: 20px;
      background: var(--primary-color);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .mock-item {
      width: 18px;
      height: 18px;
      background: var(--surface-border);
      border-radius: 4px;
      &.active {
        background: var(--primary-color);
      }
    }

    .mock-main {
      flex: 1;
      padding: 16px;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .mock-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .mock-title {
      font-size: 11px;
      font-weight: 700;
    }

    .mock-avatar {
      width: 18px;
      height: 18px;
      background: var(--indigo-color);
      border-radius: 50%;
    }

    .mock-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .mock-card {
      background: #1e293b;
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .mock-card-label {
      font-size: 8px;
      color: var(--text-gray);
    }

    .mock-card-value {
      font-size: 10px;
      font-weight: 800;
      color: white;
    }

    .mock-card-trend {
      font-size: 7px;
      font-weight: 600;
      &.green { color: #10b981; }
      &.blue { color: #60a5fa; }
      &.orange { color: #f97316; }
    }

    .mock-chart-container {
      background: #1e293b;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 10px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .mock-chart-header {
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: var(--text-gray);
    }

    .mock-legend {
      font-size: 7px;
    }

    .mock-chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 60px;
      padding-top: 8px;
    }

    .mock-chart-bars .bar {
      flex: 1;
      background: var(--surface-border);
      border-radius: 3px 3px 0 0;
      transition: height 0.3s ease;
      &.active {
        background: linear-gradient(to top, var(--indigo-color), var(--primary-color));
      }
    }

    /* ── SECCIÓN CARACTERÍSTICAS ── */
    .features-section {
      padding: 100px 8%;
      background: #0f172a;
      border-top: 1px solid var(--surface-border);
    }

    .section-header {
      text-align: center;
      max-width: 600px;
      margin: 0 auto 60px;
    }

    .section-label {
      color: var(--primary-color);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 12px;
      display: inline-block;
    }

    .section-header h2 {
      font-size: 36px;
      font-weight: 800;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
    }

    .section-header p {
      color: var(--text-gray);
      font-size: 16px;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .feature-card {
      background: var(--surface-dark-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 32px;
      transition: all 0.25s ease;
      &:hover {
        transform: translateY(-4px);
        border-color: var(--primary-color);
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.05);
      }
    }

    .icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      
      &.green { background: rgba(16, 185, 129, 0.1); color: var(--primary-color); }
      &.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
      &.purple { background: rgba(147, 51, 234, 0.1); color: #a855f7; }
      &.orange { background: rgba(249, 115, 22, 0.1); color: #f97316; }
      &.teal { background: rgba(20, 184, 166, 0.1); color: #14b8a6; }
      &.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      
      .material-symbols-outlined {
        font-size: 24px;
      }
    }

    .feature-card h3 {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 12px;
    }

    .feature-card p {
      color: var(--text-gray);
      font-size: 13.5px;
      line-height: 1.6;
      margin: 0;
    }

    /* ── SECCIÓN DEMO INTERACTIVA DE IA ── */
    .ai-demo-section {
      padding: 100px 8%;
      background: radial-gradient(circle at 90% 10%, rgba(79, 70, 229, 0.08) 0%, rgba(15, 23, 42, 0) 60%);
      border-top: 1px solid var(--surface-border);
    }

    .demo-grid {
      display: grid;
      grid-template-columns: 0.9fr 1.1fr;
      gap: 60px;
      align-items: center;
    }

    .demo-badge {
      background: rgba(79, 70, 229, 0.15);
      border: 1px solid rgba(79, 70, 229, 0.3);
      color: #818cf8;
      font-size: 10px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 16px;
    }

    .demo-text-content h2 {
      font-size: 36px;
      font-weight: 800;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
    }

    .demo-text-content p {
      color: var(--text-gray);
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 32px;
    }

    .demo-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .btn-record {
      background: linear-gradient(135deg, var(--indigo-color), #6366f1);
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      &:hover:not(:disabled) {
        transform: scale(1.02);
        box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
      }
      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }

    .btn-reset {
      border: 1px solid var(--surface-border);
      background: transparent;
      color: white;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s ease;
      &:hover {
        background: rgba(255,255,255,0.05);
      }
    }

    .wave-container {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 24px;
    }

    .bar-wave {
      width: 3px;
      height: 8px;
      background: var(--primary-color);
      border-radius: 3px;
      animation: bounce 0.8s ease-in-out infinite alternate;
      
      &.delay-1 { animation-delay: 0.15s; }
      &.delay-2 { animation-delay: 0.3s; }
      &.delay-3 { animation-delay: 0.45s; }
      &.delay-4 { animation-delay: 0.6s; }
    }

    /* Sandbox Preview Area */
    .demo-preview-card {
      background: var(--surface-dark-card);
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 15px 30px rgba(0,0,0,0.3);
    }

    .preview-header {
      background: #1e293b;
      padding: 12px 20px;
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preview-label {
      font-size: 9.5px;
      font-weight: 700;
      color: var(--text-gray);
      letter-spacing: 1px;
    }

    .preview-status {
      font-size: 9px;
      font-weight: 700;
      color: var(--text-gray);
      background: rgba(255,255,255,0.05);
      padding: 3px 8px;
      border-radius: 4px;
      &.active {
        background: rgba(16, 185, 129, 0.15);
        color: var(--primary-color);
      }
    }

    .preview-body {
      padding: 24px;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 20px;
    }

    .audio-transcription {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .avatar-vet {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--indigo-color);
      flex-shrink: 0;
    }

    .bubble {
      background: #0f172a;
      border: 1px solid var(--surface-border);
      border-radius: 0 12px 12px 12px;
      padding: 14px;
      flex: 1;
    }

    .speaker {
      font-size: 10px;
      font-weight: 700;
      color: var(--primary-color);
      margin-bottom: 4px;
      display: block;
    }

    .transcription-text {
      font-size: 13px;
      color: white;
      margin: 0;
      line-height: 1.45;
    }

    .cursor {
      color: var(--primary-color);
      animation: blink 0.8s infinite;
    }

    .soap-note-card {
      background: #0f172a;
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 12px;
      padding: 20px;
    }

    .soap-badge {
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary-color);
      font-size: 8px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 14px;
    }

    .soap-section {
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 12px;
      margin-bottom: 12px;
      
      &.no-border {
        border: none;
        padding-bottom: 0;
        margin-bottom: 0;
      }
    }

    .soap-heading {
      font-size: 11.5px;
      font-weight: 800;
      color: var(--primary-color);
      display: block;
      margin-bottom: 4px;
    }

    .soap-section p {
      font-size: 12px;
      color: var(--text-white);
      margin: 0;
      line-height: 1.5;
    }

    .soap-section ul {
      margin: 6px 0 0;
      padding-left: 18px;
      font-size: 12px;
      color: var(--text-gray);
      line-height: 1.5;
    }

    .diagnosis-badge {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
      padding: 6px 10px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }

    .preview-placeholder {
      text-align: center;
      padding: 40px;
      color: var(--text-gray);
    }

    .icon-placeholder {
      font-size: 48px;
      color: var(--surface-border);
      margin-bottom: 16px;
    }

    .preview-placeholder p {
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
    }

    .preview-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: var(--text-gray);
      text-align: center;
      padding: 30px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.05);
      border-top-color: var(--indigo-color);
      border-radius: 50%;
      animation: spin 1s infinite linear;
    }

    .preview-loader p {
      font-size: 12px;
      max-width: 250px;
      margin: 0;
    }

    /* ── PORTAL DEL TUTOR PWA ── */
    .tutor-portal-section {
      padding: 100px 8%;
      background: #0f172a;
      border-top: 1px solid var(--surface-border);
    }

    .tutor-grid {
      display: grid;
      grid-template-columns: 0.95fr 1.05fr;
      gap: 60px;
      align-items: center;
    }

    .tutor-image-area {
      display: flex;
      justify-content: center;
    }

    /* Mobile mockup container */
    .mobile-frame {
      width: 240px;
      height: 480px;
      background: #000;
      border: 6px solid #1e293b;
      border-radius: 36px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 30px rgba(16,185,129,0.08);
      position: relative;
      overflow: hidden;
    }

    .mobile-notch {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100px;
      height: 14px;
      background: #1e293b;
      border-radius: 0 0 10px 10px;
      z-index: 5;
    }

    .mobile-screen {
      height: 100%;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      padding: 24px 14px 14px;
      gap: 12px;
      font-family: 'Inter', sans-serif;
    }

    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .app-brand {
      font-size: 10.5px;
      font-weight: 800;
      color: var(--primary-color);
    }

    .app-bell {
      width: 6px;
      height: 6px;
      background: #ef4444;
      border-radius: 50%;
    }

    .app-tutor-profile {
      background: #1e293b;
      border-radius: 10px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tutor-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .tutor-info .welcome {
      font-size: 7px;
      color: var(--text-gray);
    }

    .tutor-info .tutor-name {
      font-size: 9.5px;
      font-weight: 700;
    }

    .app-tag-status {
      font-size: 7.5px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary-color);
      padding: 2px 5px;
      border-radius: 4px;
    }

    .pet-slider {
      background: #1e293b;
      border-radius: 10px;
      padding: 10px;
    }

    .pet-slide-card {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pet-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary-color);
      background-image: url('https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150');
      background-size: cover;
    }

    .pet-details {
      display: flex;
      flex-direction: column;
    }

    .pet-details .pet-name {
      font-size: 10px;
      font-weight: 700;
    }

    .pet-details .pet-breed {
      font-size: 7px;
      color: var(--text-gray);
    }

    .app-card-vaccines {
      background: #1e293b;
      border-radius: 10px;
      padding: 10px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .card-header-app {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      font-weight: 800;
    }

    .btn-view-all {
      color: var(--primary-color);
      font-size: 7.5px;
      font-weight: 700;
    }

    .vaccine-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--surface-border);
      padding-bottom: 4px;
      font-size: 7.5px;
    }

    .vaccine-row .vac-name {
      color: var(--text-white);
      font-weight: 500;
    }

    .vaccine-row .vac-date {
      font-weight: 700;
      &.green { color: #10b981; }
      &.orange { color: #f97316; }
    }

    .app-action-bar {
      margin-top: auto;
    }

    .app-btn-booking {
      background: var(--primary-color);
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 0;
      border-radius: 8px;
      font-size: 9.5px;
      font-weight: 700;
      text-decoration: none;
      
      .material-symbols-outlined {
        font-size: 12px;
      }
    }

    .tutor-text-content h2 {
      font-size: 36px;
      font-weight: 800;
      margin: 0 0 16px;
      letter-spacing: -0.5px;
    }

    .tutor-text-content p {
      color: var(--text-gray);
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .tutor-list {
      list-style: none;
      padding: 0;
      margin: 0 0 32px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .tutor-list li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14.5px;
      color: var(--text-white);
    }

    .check-icon {
      color: var(--primary-color);
      font-size: 20px;
      flex-shrink: 0;
    }

    .btn-tutor-explore {
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--surface-border);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease;
      &:hover {
        background: rgba(255,255,255,0.08);
      }
    }

    /* ── SECCIÓN PLANES DE PRECIOS ── */
    .pricing-section {
      padding: 100px 8%;
      background: radial-gradient(circle at 10% 90%, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0) 70%);
      border-top: 1px solid var(--surface-border);
    }

    .pricing-grid {
      display: flex;
      justify-content: center;
      gap: 32px;
      max-width: 800px;
      margin: 0 auto;
    }

    .price-card {
      background: var(--surface-dark-card);
      border: 1px solid var(--surface-border);
      border-radius: 16px;
      padding: 40px;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.3s ease;
      
      &.recommended {
        border-color: var(--primary-color);
        box-shadow: 0 15px 35px rgba(16, 185, 129, 0.08);
        transform: scale(1.03);
      }
    }

    .featured-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary-color);
      color: #0f172a;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 12px;
      border-radius: 20px;
      letter-spacing: 1px;
    }

    .plan-header h3 {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 16px;
      color: var(--text-white);
    }

    .price {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 12px;
    }

    .currency {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary-color);
    }

    .amount {
      font-size: 40px;
      font-weight: 800;
      color: white;
    }

    .period {
      font-size: 13px;
      color: var(--text-gray);
    }

    .plan-header p {
      color: var(--text-gray);
      font-size: 12.5px;
      line-height: 1.5;
      margin: 0;
    }

    .plan-divider {
      height: 1px;
      background: var(--surface-border);
      margin: 24px 0;
    }

    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0 0 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }

    .plan-features li {
      font-size: 13px;
      color: var(--text-white);
      line-height: 1.45;
    }

    .btn-price-primary {
      background: var(--primary-color);
      color: #0f172a;
      text-align: center;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s ease;
      &:hover {
        background: var(--primary-hover);
      }
    }

    .btn-price-secondary {
      border: 1px solid var(--surface-border);
      color: white;
      text-align: center;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.2s ease;
      &:hover {
        background: rgba(255,255,255,0.03);
      }
    }

    /* ── PREGUNTAS FRECUENTES ── */
    .faq-section {
      padding: 100px 8%;
      background: #0f172a;
      border-top: 1px solid var(--surface-border);
    }

    .faq-accordion {
      max-width: 650px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .faq-item {
      background: var(--surface-dark-card);
      border: 1px solid var(--surface-border);
      border-radius: 10px;
      padding: 20px;
      cursor: pointer;
      transition: border-color 0.2s ease;
      &:hover {
        border-color: var(--primary-color);
      }
    }

    .faq-question {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .faq-question h4 {
      font-size: 14px;
      font-weight: 700;
      margin: 0;
    }

    .faq-toggle-icon {
      color: var(--primary-color);
      font-size: 20px;
    }

    .faq-answer {
      margin-top: 12px;
      border-top: 1px solid var(--surface-border);
      padding-top: 12px;
    }

    .faq-answer p {
      font-size: 13px;
      color: var(--text-gray);
      line-height: 1.5;
      margin: 0;
    }

    /* ── CALL TO ACTION FINAL ── */
    .cta-banner {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(79, 70, 229, 0.1) 100%);
      border-top: 1px solid var(--surface-border);
      border-bottom: 1px solid var(--surface-border);
      padding: 80px 8%;
      text-align: center;
    }

    .cta-banner h2 {
      font-size: 32px;
      font-weight: 800;
      margin: 0 0 12px;
    }

    .cta-banner p {
      color: var(--text-gray);
      font-size: 16px;
      margin: 0 0 32px;
    }

    .btn-cta-final {
      background: var(--primary-color);
      color: #0f172a;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
      &:hover {
        background: var(--primary-hover);
        transform: scale(1.02);
      }
    }

    /* ── FOOTER ── */
    .footer {
      padding: 60px 8% 30px;
      background: #0b0f19;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }

    .footer-brand p {
      color: var(--text-gray);
      font-size: 12.5px;
      margin-top: 12px;
    }

    .footer-links {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .footer-links h5, .footer-legal h5 {
      font-size: 13px;
      font-weight: 700;
      margin: 0 0 16px;
      color: var(--text-white);
    }

    .footer-links a {
      color: var(--text-gray);
      text-decoration: none;
      font-size: 12.5px;
      transition: color 0.2s ease;
      &:hover {
        color: var(--primary-color);
      }
    }

    .footer-legal p {
      color: var(--text-gray);
      font-size: 12px;
      line-height: 1.6;
      margin: 0;
    }

    .footer-bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 24px;
      text-align: center;
    }

    .footer-bottom p {
      color: rgba(255, 255, 255, 0.3);
      font-size: 11px;
      margin: 0;
    }

    /* ── ANIMACIONES Y SOPORTE RESPONSIVO ── */
    @keyframes bounce {
      0% { transform: scaleY(1); }
      100% { transform: scaleY(3.5); }
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    @keyframes blink {
      0%, 100% { opacity: 0; }
      50% { opacity: 1; }
    }

    .animate-fade-in {
      animation: fadeIn 1s ease forwards;
    }

    .animate-slide-up {
      animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Responsive Grid fixes */
    @media (max-width: 900px) {
      .hero-section, .demo-grid, .tutor-grid {
        grid-template-columns: 1fr;
        text-align: center;
      }
      .hero-content {
        align-items: center;
      }
      .hero-ctas {
        justify-content: center;
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
      .pricing-grid {
        flex-direction: column;
        align-items: center;
      }
      .price-card {
        width: 100%;
        max-width: 400px;
      }
      .nav-links {
        display: none;
      }
      .footer-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LandingComponent {
  isRecording = signal(false);
  isAnalyzing = signal(false);
  showNote = signal(false);
  
  typedSpeech = signal('');
  fullSpeech = 'Paciente Toby, canino Golden Retriever de 5 años. Presenta cojera en miembro posterior derecho después de correr en el parque. Al examen físico hay dolor moderado y test de Cajón Anterior positivo. Sospecha de ruptura de ligamento cruzado. Tratamiento: reposo absoluto por 15 días y Meloxicam 0.1 mg cada 24 horas.';
  
  openFaq = signal<number | null>(null);

  faqList = signal([
    {
      q: '¿Cómo funciona la transcripción clínica por Inteligencia Artificial?',
      a: 'VetPro integra Whisper de OpenAI para capturar y transcribir tu dictado clínico con precisión. Luego, a través de Claude AI y Prompt Engineering especializado, procesamos el texto libre estructurándolo en formato médico SOAP (Anamnesis, Examen Físico, Diagnóstico y Tratamiento) con dosis calculadas automáticamente.'
    },
    {
      q: '¿Qué es el Portal del Tutor Passwordless?',
      a: 'Es una aplicación progresiva (PWA) diseñada para dueños de mascotas. Cuando el tutor recibe un mensaje automatizado por WhatsApp (ej. recordatorio de vacuna), contiene un enlace con un token seguro (Magic Link). Al dar clic, ingresa instantáneamente a la app sin crear usuarios o contraseñas engorrosas.'
    },
    {
      q: '¿Se integra con WhatsApp para alertas automatizadas?',
      a: 'Sí, la plataforma cuenta con un despachador simulado en tiempo real que emite alertas de salud, reservas y recordatorios directamente al WhatsApp del tutor de manera nativa e inmediata.'
    },
    {
      q: '¿Cumple con la normatividad de protección de datos en Colombia?',
      a: 'Por supuesto. VetPro SaaS está totalmente adaptado a la Ley 1581 de 2012 de Habeas Data colombiana, garantizando la privacidad de los historiales clínicos, firmas de consentimiento informado digitalizadas y derechos ARCO para tutores de mascotas.'
    }
  ]);

  toggleFaq(index: number) {
    if (this.openFaq() === index) {
      this.openFaq.set(null);
    } else {
      this.openFaq.set(index);
    }
  }

  startSimulatedRecording() {
    this.isRecording.set(true);
    this.showNote.set(false);
    this.typedSpeech.set('');
    
    // Simulate speech-to-text typing effect
    let charIndex = 0;
    const interval = setInterval(() => {
      if (charIndex < this.fullSpeech.length) {
        this.typedSpeech.update(prev => prev + this.fullSpeech.charAt(charIndex));
        charIndex += 4; // Fast type simulation
      } else {
        clearInterval(interval);
        this.finishRecording();
      }
    }, 50);
  }

  finishRecording() {
    this.isRecording.set(false);
    this.isAnalyzing.set(true);
    
    // Simulate AI clinical structured notes parsing time
    setTimeout(() => {
      this.isAnalyzing.set(false);
      this.showNote.set(true);
    }, 2000);
  }

  resetDemo() {
    this.showNote.set(false);
    this.typedSpeech.set('');
    this.isRecording.set(false);
    this.isAnalyzing.set(false);
  }
}
