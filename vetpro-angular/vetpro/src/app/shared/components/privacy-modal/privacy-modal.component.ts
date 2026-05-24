import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close()">
      <div class="modal-card glass-effect animate-scale-up" (click)="$event.stopPropagation()">
        <div class="card-glow"></div>
        
        <header class="modal-header">
          <span class="material-symbols-outlined shield-icon">gpp_maybe</span>
          <h3>Política de Privacidad y Habeas Data</h3>
          <button class="close-btn" (click)="close()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>

        <main class="modal-body">
          <p class="intro">
            De conformidad con la <strong>Ley 1581 de 2012</strong> (Régimen General de Protección de Datos Personales en Colombia) y sus decretos reglamentarios, le informamos sobre la protección de su información.
          </p>

          <section class="policy-section">
            <h4>1. Tratamiento de Datos Sensibles Clínicos</h4>
            <p>
              El historial médico, tratamientos, imágenes y cualquier registro clínico veterinario está sujeto a las directrices de seguridad de la clínica y protección de identidad de sus tutores responsables.
            </p>
          </section>

          <section class="policy-section">
            <h4>2. Finalidad del Tratamiento de Datos</h4>
            <ul>
              <li>Agendamiento de citas y control de salas de espera.</li>
              <li>Generación automática de recordatorios de vacunas y atenciones vía WhatsApp.</li>
              <li>Facturación básica y emisión de comprobantes de pago.</li>
              <li>Estructuración de historias clínicas asistida por Inteligencia Artificial (Whisper + Claude).</li>
            </ul>
          </section>

          <section class="policy-section">
            <h4>3. Derechos del Titular (Habeas Data)</h4>
            <p>
              Como titular, usted o los tutores responsables de las mascotas tienen derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos personales de las bases de datos de VetPro SaaS en cualquier momento.
            </p>
          </section>
        </main>

        <footer class="modal-footer">
          <button (click)="close()" class="accept-btn">
            Entendido y Acepto
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 15, 26, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    }

    .glass-effect {
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-card {
      position: relative;
      width: 100%;
      max-width: 500px;
      border-radius: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      box-sizing: border-box;

      .card-glow {
        position: absolute;
        top: -50px;
        left: 50%;
        transform: translateX(-50%);
        width: 250px;
        height: 120px;
        background: radial-gradient(circle, hsla(162, 72%, 46%, 0.15) 0%, transparent 70%);
        pointer-events: none;
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);

      .shield-icon {
        color: #34d399;
        font-size: 1.8rem;
      }

      h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: #ffffff;
        flex: 1;
        letter-spacing: -0.2px;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }
      }
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-size: 0.88rem;
      line-height: 1.5;
      color: #cbd5e1;

      .intro {
        margin: 0;
        font-size: 0.92rem;
        color: #ffffff;
      }

      .policy-section {
        h4 {
          margin: 0 0 6px;
          font-size: 0.85rem;
          font-weight: 800;
          color: #34d399;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        p, ul {
          margin: 0;
        }

        ul {
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      }
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: flex-end;

      .accept-btn {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        border: none;
        border-radius: 10px;
        color: #ffffff;
        font-size: 0.85rem;
        font-weight: 700;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background: linear-gradient(135deg, #047857 0%, #059669 100%);
          transform: translateY(-1px);
        }
      }
    }

    .animate-scale-up {
      animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes scaleUp {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class PrivacyModalComponent {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  close() {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }
}
