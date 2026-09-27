import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class App implements OnInit {
  private swUpdate = inject(SwUpdate);

  ngOnInit() {
    if (!this.swUpdate.isEnabled) return;

    // Aplica automáticamente una nueva versión desplegada en cuanto esté
    // descargada, en vez de dejar al usuario viendo la app vieja hasta que
    // recargue manualmente dos veces.
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => document.location.reload());

    this.swUpdate.checkForUpdate();
  }
}
