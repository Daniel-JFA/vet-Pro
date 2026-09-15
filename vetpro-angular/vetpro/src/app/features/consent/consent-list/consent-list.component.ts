import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConsentService } from '../../../core/services/consent.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-consent-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './consent-list.component.html',
  styleUrl: './consent-list.component.scss'
})
export class ConsentListComponent implements OnInit {
  private consentSvc = inject(ConsentService);
  private toast = inject(ToastService);

  loading = signal(true);
  search = signal('');
  statusFilter = signal<string>('all');
  consentForms = signal<any[]>([]);

  // Modales y Copia de Enlace
  copiedId = signal<string | null>(null);

  stats = computed(() => {
    const list = this.consentForms();
    const total = list.length;
    const signed = list.filter(c => c.signed).length;
    const pending = total - signed;

    return { total, signed, pending };
  });

  filteredConsents = computed(() => {
    let list = this.consentForms();
    const q = this.search().trim().toLowerCase();

    if (q) {
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.tutorName.toLowerCase().includes(q)
      );
    }

    if (this.statusFilter() !== 'all') {
      const signedVal = this.statusFilter() === 'signed';
      list = list.filter(c => c.signed === signedVal);
    }

    return list;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.consentSvc.getConsentForms().subscribe({
      next: (data) => {
        this.consentForms.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el listado de consentimientos. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  getSignLink(id: string): string {
    const origin = window.location.origin;
    return `${origin}/consent/sign/${id}`;
  }

  copyLink(id: string) {
    const link = this.getSignLink(id);
    navigator.clipboard.writeText(link).then(() => {
      this.copiedId.set(id);
      setTimeout(() => this.copiedId.set(null), 2000);
    });
  }

  shareWhatsApp(item: any) {
    const link = this.getSignLink(item.id);
    const text = `Hola ${item.tutorName}, te compartimos el enlace para firmar digitalmente el documento de consentimiento (${item.title}) para tu mascota ${item.patientName}. Puedes firmarlo desde tu celular en 1 minuto haciendo clic aquí: ${link}`;
    const url = `https://wa.me/${item.tutorPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  trackById(_: number, item: any) {
    return item.id;
  }
}
