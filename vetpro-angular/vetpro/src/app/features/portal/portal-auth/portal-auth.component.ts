import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TutorAuthService } from '../../../core/services/tutor-auth.service';

@Component({
  selector: 'app-portal-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-loading-container">
      <div class="glass-loader-card">
        <div class="card-glow"></div>
        
        <div *ngIf="status() === 'verifying'" class="loader-content animate-fade-in">
          <div class="pulse-ring"></div>
          <span class="material-symbols-outlined key-icon">key</span>
          <h3>Verificando acceso...</h3>
          <p>Validando tu firma digital de tutor de forma segura.</p>
        </div>

        <div *ngIf="status() === 'success'" class="loader-content animate-fade-in">
          <span class="material-symbols-outlined success-icon">lock_open</span>
          <h3>¡Acceso Autorizado!</h3>
          <p>Redirigiendo a tu panel personal...</p>
        </div>

        <div *ngIf="status() === 'error'" class="loader-content animate-fade-in">
          <span class="material-symbols-outlined error-icon">gpp_bad</span>
          <h3>Acceso Denegado</h3>
          <p class="error-msg">{{ errorMessage() }}</p>
          <button (click)="goToLogin()" class="retry-btn">
            <span class="material-symbols-outlined">arrow_back</span>
            Volver a intentar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, hsl(162, 70%, 12%) 0%, hsl(220, 30%, 5%) 100%);
      font-family: 'Inter', system-ui, sans-serif;
      color: #f3f4f6;
    }

    .auth-loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }

    .glass-loader-card {
      position: relative;
      width: 100%;
      max-width: 400px;
      background: rgba(17, 24, 39, 0.6);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      overflow: hidden;
      box-sizing: border-box;

      .card-glow {
        position: absolute;
        top: -50px;
        left: 50%;
        transform: translateX(-50%);
        width: 250px;
        height: 120px;
        background: radial-gradient(circle, hsla(162, 72%, 46%, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
    }

    .loader-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      
      h3 {
        font-size: 1.4rem;
        font-weight: 800;
        color: #ffffff;
        margin: 20px 0 10px;
      }

      p {
        font-size: 0.9rem;
        color: #9ca3af;
        margin: 0;
        line-height: 1.5;
      }

      .error-msg {
        color: #f87171;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.15);
        padding: 10px 16px;
        border-radius: 10px;
        margin-top: 12px;
        width: 100%;
        box-sizing: border-box;
      }
    }

    .pulse-ring {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      animation: pulse 1.6s ease-in-out infinite;
      position: absolute;
      top: 40px;
    }

    .key-icon {
      font-size: 2.2rem;
      color: #10b981;
      z-index: 2;
      position: relative;
      margin-top: 10px;
    }

    .success-icon {
      font-size: 3rem;
      color: #10b981;
      animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }

    .error-icon {
      font-size: 3rem;
      color: #ef4444;
      animation: shake 0.4s ease-in-out;
    }

    .retry-btn {
      margin-top: 24px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      border-radius: 12px;
      padding: 10px 20px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
    }

    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.7; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { transform: scale(1.1); opacity: 0; box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.9); opacity: 0; }
    }

    @keyframes bounceIn {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 0.9; transform: scale(1.1); }
      80% { transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }

    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
  `]
})
export class PortalAuthComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authSvc = inject(TutorAuthService);

  status = signal<'verifying' | 'success' | 'error'>('verifying');
  errorMessage = signal('');

  ngOnInit() {
    // Interceptar el token query parameter
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.status.set('error');
        this.errorMessage.set('Enlace mágico no válido. Token ausente.');
        return;
      }

      this.verifyToken(token);
    });
  }

  verifyToken(token: string) {
    this.status.set('verifying');
    
    // Simular un retardo suave de verificación para dar sensación de seguridad y premium
    setTimeout(() => {
      this.authSvc.verifyMagicLink(token).subscribe({
        next: () => {
          this.status.set('success');
          setTimeout(() => {
            this.router.navigate(['/portal/dashboard']);
          }, 1000);
        },
        error: (err) => {
          this.status.set('error');
          this.errorMessage.set(err.error?.error || 'El enlace de acceso ha expirado o ya fue utilizado.');
        }
      });
    }, 1500);
  }

  goToLogin() {
    this.router.navigate(['/portal/login']);
  }
}
