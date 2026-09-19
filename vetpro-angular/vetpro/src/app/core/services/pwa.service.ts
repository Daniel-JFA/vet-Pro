import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private swUpdate = inject(SwUpdate, { optional: true });
  private platformId = inject(PLATFORM_ID);

  // Estado reactivo con Signals
  isOnline = signal<boolean>(true);
  updateAvailable = signal<boolean>(false);
  installPromptAvailable = signal<boolean>(false);

  private deferredPrompt: any = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initNetworkMonitoring();
      this.initInstallPromptListener();
      this.initUpdateListener();
    }
  }

  private initNetworkMonitoring(): void {
    this.isOnline.set(navigator.onLine);

    window.addEventListener('online', () => {
      this.isOnline.set(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  private initInstallPromptListener(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevenir el banner automático del navegador para mostrar el personalizado
      e.preventDefault();
      this.deferredPrompt = e;
      this.installPromptAvailable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.installPromptAvailable.set(false);
    });
  }

  private initUpdateListener(): void {
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe(() => {
          this.updateAvailable.set(true);
        });
    }
  }

  /**
   * Invoca el prompt nativo para instalar la PWA en la pantalla de inicio
   */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.installPromptAvailable.set(false);
    return choice.outcome === 'accepted';
  }

  /**
   * Aplica la nueva versión descargada por el Service Worker y recarga la página
   */
  async applyUpdate(): Promise<void> {
    if (this.swUpdate?.isEnabled) {
      await this.swUpdate.activateUpdate();
      document.location.reload();
    }
  }
}
