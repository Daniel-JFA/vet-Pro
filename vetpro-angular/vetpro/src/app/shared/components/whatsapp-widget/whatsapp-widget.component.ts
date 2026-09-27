import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface WhatsAppPresetMessage {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  text: string;
}

@Component({
  selector: 'app-whatsapp-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="whatsapp-widget-container">
      <!-- Popup / Tarjeta de Chat Desplegable -->
      @if (isOpen()) {
        <div class="whatsapp-card animate-scale-up">
          <!-- Cabecera Oficial WhatsApp -->
          <div class="wa-header">
            <div class="wa-agent-info">
              <div class="wa-avatar-box">
                <span class="wa-avatar-text">VP</span>
                <span class="wa-online-dot"></span>
              </div>
              <div class="wa-meta">
                <h4>{{ title }}</h4>
                <p class="wa-status">
                  <span class="status-pulse"></span>
                  En línea · Respuesta en &lt; 5 min
                </p>
              </div>
            </div>
            <button class="wa-close-btn" (click)="toggleOpen()" aria-label="Cerrar chat de WhatsApp">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Cuerpo con Mensaje de Bienvenida y Opciones Preestablecidas -->
          <div class="wa-body">
            <div class="wa-bubble-agent">
              <p class="wa-greeting">
                ¡Hola! 👋 Bienvenido a <strong>VetPro</strong>. ¿En qué podemos orientarte hoy?
              </p>
              <span class="wa-time">{{ currentTime() }}</span>
            </div>

            <p class="wa-prompt-label">Selecciona una opción preestablecida para iniciar el chat:</p>

            <div class="wa-presets-list">
              @for (preset of presets; track preset.id) {
                <button
                  type="button"
                  class="wa-preset-item"
                  (click)="sendPreset(preset.text)"
                  [title]="preset.text"
                >
                  <div class="wa-preset-icon">
                    <span class="material-symbols-outlined">{{ preset.icon }}</span>
                  </div>
                  <div class="wa-preset-content">
                    <span class="wa-preset-title">{{ preset.title }}</span>
                    <span class="wa-preset-sub">{{ preset.subtitle }}</span>
                  </div>
                  <span class="material-symbols-outlined wa-arrow">send</span>
                </button>
              }
            </div>

            <!-- Entrada personalizada opcional -->
            <div class="wa-custom-box">
              <input
                type="text"
                [(ngModel)]="customMessage"
                placeholder="O escribe tu consulta personalizada..."
                (keyup.enter)="sendCustom()"
                maxlength="200"
              />
              <button
                type="button"
                class="wa-send-custom-btn"
                (click)="sendCustom()"
                [disabled]="!customMessage.trim()"
                title="Enviar por WhatsApp"
              >
                <span class="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          <!-- Pie de tarjeta -->
          <div class="wa-footer">
            <span class="material-symbols-outlined wa-lock-icon">lock</span>
            <span>Canal oficial verificado vía WhatsApp Cloud</span>
          </div>
        </div>
      }

      <!-- Botón Flotante Principal -->
      <button
        type="button"
        class="whatsapp-float-btn"
        (click)="toggleOpen()"
        [class.active]="isOpen()"
        aria-label="Contactar por WhatsApp con mensajes preestablecidos"
      >
        <div class="btn-ripple"></div>
        <!-- SVG Oficial de WhatsApp -->
        <svg
          class="whatsapp-svg-icon"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M16 2C8.268 2 2 8.268 2 16C2 18.72 2.778 21.26 4.128 23.414L2.246 29.356C2.146 29.67 2.23 30.016 2.464 30.25C2.698 30.484 3.044 30.568 3.358 30.468L9.584 28.486C11.564 29.466 13.728 30 16 30C23.732 30 30 23.732 30 16C30 8.268 23.732 2 16 2ZM22.698 20.672C22.42 21.458 21.314 22.112 20.45 22.296C19.86 22.42 19.096 22.518 16.51 21.446C13.202 20.076 11.074 16.714 10.908 16.496C10.744 16.276 9.574 14.724 9.574 13.118C9.574 11.512 10.388 10.73 10.72 10.39C10.996 10.108 11.45 9.98 11.892 9.98C12.036 9.98 12.168 9.986 12.288 9.992C12.642 10.008 12.82 10.028 13.052 10.584C13.34 11.278 14.044 13.002 14.132 13.18C14.22 13.358 14.308 13.602 14.186 13.842C14.076 14.084 13.976 14.182 13.81 14.376C13.644 14.57 13.488 14.714 13.322 14.922C13.166 15.118 12.99 15.326 13.178 15.65C13.366 15.972 14.012 17.026 14.966 17.876C16.196 18.974 17.202 19.324 17.556 19.472C17.832 19.588 18.154 19.562 18.364 19.338C18.63 19.052 18.962 18.572 19.294 18.106C19.538 17.764 19.848 17.72 20.17 17.842C20.502 17.962 22.268 18.832 22.632 19.014C22.998 19.196 23.24 19.284 23.328 19.438C23.418 19.592 23.418 20.328 22.698 20.672Z"
            fill="white"
          />
        </svg>

        @if (!isOpen()) {
          <span class="wa-badge-notification">1</span>
          <span class="wa-tooltip-label">¿Dudas? Chatea con nosotros</span>
        }
      </button>
    </div>
  `,
  styles: [
    `
      .whatsapp-widget-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      /* ── BOTÓN FLOTANTE ── */
      .whatsapp-float-btn {
        position: relative;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #25d366, #128c7e);
        border: none;
        outline: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(37, 211, 102, 0.45);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .whatsapp-float-btn:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 10px 25px rgba(37, 211, 102, 0.6);
      }

      .whatsapp-float-btn.active {
        transform: rotate(90deg) scale(0.95);
        background: #0f172a;
        box-shadow: 0 4px 15px rgba(15, 23, 42, 0.3);
      }

      .whatsapp-svg-icon {
        width: 34px;
        height: 34px;
        transition: transform 0.3s ease;
      }

      .btn-ripple {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 2px solid #25d366;
        animation: rippleEffect 2.5s infinite ease-out;
        pointer-events: none;
      }

      @keyframes rippleEffect {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        70% {
          transform: scale(1.45);
          opacity: 0;
        }
        100% {
          transform: scale(1.5);
          opacity: 0;
        }
      }

      .wa-badge-notification {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ef4444;
        color: white;
        font-size: 11px;
        font-weight: 800;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
      }

      .wa-tooltip-label {
        position: absolute;
        right: 70px;
        background: #0f172a;
        color: #f8fafc;
        padding: 7px 14px;
        border-radius: 20px;
        font-size: 12.5px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        pointer-events: none;
        opacity: 0;
        transform: translateX(10px);
        transition: all 0.25s ease;
      }

      .whatsapp-float-btn:hover .wa-tooltip-label {
        opacity: 1;
        transform: translateX(0);
      }

      /* ── POPUP CARD ── */
      .whatsapp-card {
        position: absolute;
        bottom: 74px;
        right: 0;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        animation: cardPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes cardPop {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Cabecera */
      .wa-header {
        background: linear-gradient(135deg, #075e54, #128c7e);
        color: white;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .wa-agent-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .wa-avatar-box {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 15px;
        border: 2px solid rgba(255, 255, 255, 0.6);
      }

      .wa-online-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 11px;
        height: 11px;
        background: #25d366;
        border-radius: 50%;
        border: 2px solid #075e54;
      }

      .wa-meta h4 {
        margin: 0;
        font-size: 14.5px;
        font-weight: 700;
        letter-spacing: -0.2px;
      }

      .wa-status {
        margin: 3px 0 0;
        font-size: 11px;
        opacity: 0.9;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .status-pulse {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #25d366;
        display: inline-block;
        box-shadow: 0 0 6px #25d366;
      }

      .wa-close-btn {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }

      .wa-close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Cuerpo */
      .wa-body {
        padding: 16px;
        background: #efeae2; /* Fondo clásico textura chat WhatsApp */
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 410px;
        overflow-y: auto;
      }

      .wa-bubble-agent {
        background: #ffffff;
        padding: 12px 14px;
        border-radius: 12px 12px 12px 2px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        position: relative;
      }

      .wa-greeting {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
        color: #1e293b;
      }

      .wa-time {
        display: block;
        font-size: 10px;
        color: #94a3b8;
        text-align: right;
        margin-top: 4px;
      }

      .wa-prompt-label {
        font-size: 11.5px;
        font-weight: 700;
        color: #475569;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .wa-presets-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .wa-preset-item {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
      }

      .wa-preset-item:hover {
        border-color: #25d366;
        background: #f0fdf4;
        transform: translateX(3px);
        box-shadow: 0 4px 10px rgba(37, 211, 102, 0.15);
      }

      .wa-preset-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #ecfdf5;
        color: #059669;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .wa-preset-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .wa-preset-title {
        font-size: 12.5px;
        font-weight: 700;
        color: #0f172a;
      }

      .wa-preset-sub {
        font-size: 11px;
        color: #64748b;
        margin-top: 2px;
      }

      .wa-arrow {
        color: #cbd5e1;
        font-size: 18px;
        transition: all 0.2s ease;
      }

      .wa-preset-item:hover .wa-arrow {
        color: #059669;
        transform: scale(1.15);
      }

      /* Custom Input */
      .wa-custom-box {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border-radius: 24px;
        padding: 4px 6px 4px 14px;
        border: 1px solid #cbd5e1;
        margin-top: 4px;
      }

      .wa-custom-box input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 12.5px;
        color: #1e293b;
        background: transparent;
      }

      .wa-send-custom-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #25d366;
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }

      .wa-send-custom-btn:hover:not(:disabled) {
        background: #128c7e;
      }

      .wa-send-custom-btn:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
      }

      /* Footer */
      .wa-footer {
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        padding: 9px 14px;
        font-size: 10.5px;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .wa-lock-icon {
        font-size: 14px;
        color: #059669;
      }

      @media (max-width: 480px) {
        .whatsapp-widget-container {
          bottom: 16px;
          right: 16px;
        }
        .whatsapp-card {
          width: calc(100vw - 32px);
          bottom: 70px;
        }
      }
    `
  ]
})
export class WhatsAppWidgetComponent {
  @Input() phoneNumber = '573122115299';
  @Input() title = 'VetPro Asesoría & Soporte';

  isOpen = signal(false);
  customMessage = '';

  currentTime = signal(this.formatCurrentTime());

  presets: WhatsAppPresetMessage[] = [
    {
      id: 'clinica',
      icon: 'domain',
      title: 'Planes para Clínicas y Consultorios',
      subtitle: 'Información y cotizaciones a medida',
      text: '¡Hola VetPro! Me gustaría recibir información detallada y precios sobre los planes para clínicas veterinarias.'
    },
    {
      id: 'veterinario',
      icon: 'badge',
      title: 'Soy Veterinario y quiero unirme',
      subtitle: 'Certificar matrícula COMVEZCOL y Directorio',
      text: '¡Hola! Soy médico veterinario en Colombia y me gustaría certificar mi matrícula profesional para aparecer en el directorio de VetPro.'
    },
    {
      id: 'tutor',
      icon: 'pets',
      title: 'Orientación para Atención a Domicilio',
      subtitle: 'Para tutores de perros y gatos',
      text: '¡Hola VetPro! Necesito atención veterinaria para mi mascota y deseo orientación sobre profesionales disponibles a domicilio.'
    },
    {
      id: 'demo',
      icon: 'smart_toy',
      title: 'Agendar Demostración de Software & IA',
      subtitle: 'Dictado por voz, rutas y expedientes SOAP',
      text: '¡Hola equipo VetPro! Quisiera agendar una demostración en vivo de la plataforma y el transcriptor IA.'
    }
  ];

  toggleOpen() {
    this.isOpen.update((v) => !v);
    this.currentTime.set(this.formatCurrentTime());
  }

  sendPreset(message: string) {
    this.openWhatsApp(message);
    this.isOpen.set(false);
  }

  sendCustom() {
    if (!this.customMessage.trim()) return;
    this.openWhatsApp(this.customMessage.trim());
    this.customMessage = '';
    this.isOpen.set(false);
  }

  private openWhatsApp(text: string) {
    const cleanPhone = this.phoneNumber.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  private formatCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
