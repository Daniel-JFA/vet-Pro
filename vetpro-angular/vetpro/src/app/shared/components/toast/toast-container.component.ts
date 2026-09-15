import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.type">
          <span class="toast__icon">
            @switch (toast.type) {
              @case ('success') { ✅ }
              @case ('error') { ⚠️ }
              @case ('warning') { ⚠️ }
              @default { ℹ️ }
            }
          </span>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close" type="button" (click)="toastSvc.dismiss(toast.id)" aria-label="Cerrar">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 380px;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 13.5px;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      border-left: 4px solid #64748b;
      animation: toast-in 0.2s ease-out;
    }
    .toast--success { border-left-color: #16a34a; background: #f0fdf4; }
    .toast--error { border-left-color: #dc2626; background: #fef2f2; }
    .toast--warning { border-left-color: #d97706; background: #fffbeb; }
    .toast--info { border-left-color: #2563eb; background: #eff6ff; }
    .toast__message { flex: 1; }
    .toast__close {
      background: none;
      border: none;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      color: #64748b;
      padding: 0;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 480px) {
      .toast-stack { left: 12px; right: 12px; max-width: none; }
    }
  `]
})
export class ToastContainerComponent {
  toastSvc = inject(ToastService);
}
