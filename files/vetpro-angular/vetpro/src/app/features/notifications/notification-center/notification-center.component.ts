import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [RouterLink],
  template: `<div style="padding:24px">
    <h2 style="font-size:20px;font-weight:600;margin:0 0 8px">NotificationCenter</h2>
    <p style="color:#888;font-size:13px">Módulo en construcción — Sprint correspondiente</p>
    <a routerLink="/" style="color:var(--primary-color);font-size:13px">← Inicio</a>
  </div>`
})
export class NotificationCenterComponent {}
