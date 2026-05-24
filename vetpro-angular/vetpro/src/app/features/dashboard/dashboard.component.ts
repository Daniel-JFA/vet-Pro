import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dash">
      <h1 class="title">Inicio</h1>
      <div class="grid">
        <div class="card" routerLink="/patients">🐾 Pacientes</div>
        <div class="card" routerLink="/appointments">📅 Citas de hoy</div>
        <div class="card" routerLink="/inventory">📦 Inventario</div>
        <div class="card" routerLink="/billing">💰 Facturación</div>
      </div>
    </div>
  `,
  styles: [`.dash{padding:0} .title{font-size:22px;font-weight:600;margin-bottom:20px} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px} .card{background:var(--surface-card);border:1px solid var(--surface-border);border-radius:10px;padding:24px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px;&:hover{border-color:var(--primary-color)}}`]
})
export class DashboardComponent {}
