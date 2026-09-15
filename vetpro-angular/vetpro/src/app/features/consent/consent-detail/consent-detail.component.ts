import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ConsentService } from '../../../core/services/consent.service';
import { ToastService } from '../../../core/services/toast.service';

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
  private toast = inject(ToastService);

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
        this.consent.set(null);
        this.loading.set(false);
        this.toast.error('No se pudo cargar el consentimiento.');
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
