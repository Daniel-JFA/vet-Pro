import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

interface DemoAccount {
  label: string;
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="logo"><span class="logo-mark">V</span><span class="logo-name">VetPro</span></div>
        <h2>Iniciar sesión</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="demo-switch" aria-label="Credenciales de desarrollo">
            <button
              *ngFor="let account of demoAccounts"
              type="button"
              [class.active]="selectedDemo() === account.email"
              (click)="selectDemoAccount(account)"
            >
              {{ account.label }}
            </button>
          </div>
          <div class="field"><label>Correo electrónico</label><input type="email" formControlName="email" placeholder="vet@clinica.com" autocomplete="username" /></div>
          <div class="field"><label>Contraseña</label><input type="password" formControlName="password" placeholder="••••••••" autocomplete="current-password" /></div>
          <button type="submit" class="btn-login" [disabled]="loading()">{{ loading() ? 'Entrando…' : 'Ingresar' }}</button>
          <p class="error" *ngIf="error()">{{ error() }}</p>
        </form>
      </div>
    </div>
  `,
  styles: [`.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--surface-ground)} .login-card{background:var(--surface-card);border:1px solid var(--surface-border);border-radius:12px;padding:40px;width:360px} .logo{display:flex;align-items:center;gap:10px;margin-bottom:24px} .logo-mark{width:36px;height:36px;background:var(--primary-color);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px} .logo-name{font-size:18px;font-weight:600} h2{font-size:18px;margin:0 0 20px}.demo-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--surface-hover);border:1px solid var(--surface-border);border-radius:8px;padding:4px;margin-bottom:16px}.demo-switch button{border:0;border-radius:6px;background:transparent;color:var(--text-color-secondary);font-size:12px;font-weight:600;padding:8px 10px;cursor:pointer}.demo-switch button.active{background:var(--surface-card);color:var(--primary-color);box-shadow:0 1px 2px rgba(15,23,42,.08)} .field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px} label{font-size:13px;font-weight:500} input{padding:9px 12px;border:1px solid var(--surface-border);border-radius:7px;font-size:13px;outline:none;&:focus{border-color:var(--primary-color)}} .btn-login{width:100%;padding:10px;background:var(--primary-color);color:#fff;border:none;border-radius:7px;font-size:14px;font-weight:500;cursor:pointer;margin-top:4px;&:disabled{opacity:.6}} .error{color:var(--red-500);font-size:12px;margin-top:8px;text-align:center}`]
})
export class LoginComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  demoAccounts: DemoAccount[] = [
    { label: 'Admin', email: 'admin@vetpro.co', password: 'admin123' },
    { label: 'Veterinario', email: 'vet@vetpro.co', password: 'vet123' }
  ];
  selectedDemo = signal(this.demoAccounts[0].email);
  loading = signal(false);
  error   = signal('');
  form = this.fb.group({
    email: [this.demoAccounts[0].email, [Validators.required, Validators.email]],
    password: [this.demoAccounts[0].password, Validators.required]
  });
  selectDemoAccount(account: DemoAccount) {
    this.selectedDemo.set(account.email);
    this.form.setValue({ email: account.email, password: account.password });
    this.error.set('');
  }
  submit() {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    this.auth.login(this.form.value.email!, this.form.value.password!).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.loading.set(false); this.error.set('Credenciales incorrectas'); }
    });
  }
}
