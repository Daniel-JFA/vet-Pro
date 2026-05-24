import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TutorAuthService } from '../../../core/services/tutor-auth.service';
import { TutorPortalService, PortalPatient } from '../../../core/services/tutor-portal.service';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portal-dashboard.component.html',
  styleUrl: './portal-dashboard.component.scss'
})
export class PortalDashboardComponent implements OnInit {
  authSvc = inject(TutorAuthService);
  private portalSvc = inject(TutorPortalService);

  patients = signal<PortalPatient[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    this.loadPatients();
  }

  loadPatients() {
    this.loading.set(true);
    this.error.set('');

    this.portalSvc.getPatients().subscribe({
      next: (data) => {
        this.patients.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar mascotas en portal:', err);
        this.error.set('No se pudieron obtener las mascotas. Por favor reintenta.');
        this.loading.set(false);
      }
    });
  }

  getSpeciesIcon(spec: string): string {
    switch (spec) {
      case 'dog': return 'pets';
      case 'cat': return 'cat';
      case 'rabbit': return 'cruelty_free';
      case 'bird': return 'nest_gator';
      case 'reptile': return 'thermostat';
      default: return 'pets';
    }
  }

  getSpeciesLabel(spec: string): string {
    switch (spec) {
      case 'dog': return 'Perro';
      case 'cat': return 'Gato';
      case 'rabbit': return 'Conejo';
      case 'bird': return 'Ave';
      case 'reptile': return 'Reptil';
      default: return 'Otro';
    }
  }

  calculateAge(birthDateStr?: string): string {
    if (!birthDateStr) return 'Edad no registrada';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      years--;
      months += 12;
    }

    if (years === 0) {
      return months === 1 ? '1 mes' : `${months} meses`;
    }
    
    if (months === 0) {
      return years === 1 ? '1 año' : `${years} años`;
    }

    const yearText = years === 1 ? '1 año' : `${years} años`;
    const monthText = months === 1 ? '1 mes' : `${months} meses`;
    return `${yearText} y ${monthText}`;
  }
}
