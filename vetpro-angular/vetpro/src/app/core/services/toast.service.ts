import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info', durationMs = 5000) {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, type, message }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  success(message: string, durationMs = 4000) {
    return this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 7000) {
    return this.show(message, 'error', durationMs);
  }

  warning(message: string, durationMs = 6000) {
    return this.show(message, 'warning', durationMs);
  }

  info(message: string, durationMs = 5000) {
    return this.show(message, 'info', durationMs);
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
