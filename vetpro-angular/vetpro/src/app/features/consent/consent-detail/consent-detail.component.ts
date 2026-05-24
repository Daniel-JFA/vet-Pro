import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ConsentService } from '../../../core/services/consent.service';

@Component({
  selector: 'app-consent-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './consent-detail.component.html',
  styleUrl: './consent-detail.component.scss'
})
export class ConsentDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private consentSvc = inject(ConsentService);

  consentId = signal<string | null>(null);
  consent = signal<any | null>(null);
  loading = signal(true);
  copied = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.consentId.set(id);
      this.loadConsentDetails(id);
    }
  }

  loadConsentDetails(id: string) {
    this.loading.set(true);
    this.consentSvc.getConsentForm(id).subscribe({
      next: (data) => {
        this.consent.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback mock consents offline
        const mockConsent = MOCK_CONSENTS_DETAILS.find(c => c.id === id) || MOCK_CONSENTS_DETAILS[0];
        this.consent.set(mockConsent);
        this.loading.set(false);
      }
    });
  }

  getSignLink(): string {
    const origin = window.location.origin;
    return `${origin}/consent/sign/${this.consentId()}`;
  }

  copyLink() {
    const link = this.getSignLink();
    navigator.clipboard.writeText(link).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  shareWhatsApp() {
    const item = this.consent();
    if (!item) return;

    const link = this.getSignLink();
    const text = `Hola ${item.tutorName}, te compartimos el enlace para firmar el consentimiento (${item.title}) para tu mascota ${item.patientName}: ${link}`;
    const url = `https://wa.me/${item.tutorPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  printDocument() {
    window.print();
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_CONSENTS_DETAILS = [
  {
    id: 'c-form-1',
    patientId: 'p1',
    patientName: 'Toby',
    tutorName: 'Carlos Gómez',
    tutorPhone: '+57 312 456 7890',
    title: 'Autorización para Anestesia y Cirugía',
    content: 'Por medio del presente documento, yo Carlos Gómez autorizo a la clínica veterinaria VetPro a realizar el procedimiento quirúrgico de orquiectomía bajo anestesia general inhalatoria para mi mascota Toby. Entiendo los riesgos implícitos, incluyendo reacciones adversas a medicamentos anestésicos, shock, paro cardiorrespiratorio o deceso, habiendo sido previamente informado del plan quirúrgico.',
    signed: true,
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAAB...', // Mock Base64 PNG signature
    signedAt: new Date(Date.now() - 1 * 86400000),
    expiresAt: new Date(Date.now() + 2 * 86400000),
    createdAt: new Date(Date.now() - 1 * 86400000)
  },
  {
    id: 'c-form-2',
    patientId: 'p1',
    patientName: 'Toby',
    tutorName: 'Carlos Gómez',
    tutorPhone: '+57 312 456 7890',
    title: 'Consentimiento para Hospitalización General',
    content: 'Por medio del presente documento, yo Carlos Gómez autorizo a la clínica veterinaria VetPro a hospitalizar a mi mascota Toby para la administración de terapia de fluidos endovenosos y monitoreo clínico. Entiendo que se me informará periódicamente de su estado.',
    signed: false,
    expiresAt: new Date(Date.now() + 3 * 86400000),
    createdAt: new Date()
  }
];
