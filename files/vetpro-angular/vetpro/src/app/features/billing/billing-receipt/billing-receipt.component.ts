import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { Invoice } from '../../../core/models';

@Component({
  selector: 'app-billing-receipt',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './billing-receipt.component.html',
  styleUrl: './billing-receipt.component.scss'
})
export class BillingReceiptComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private billingSvc = inject(BillingService);

  invoiceId = signal<string | null>(null);
  invoice = signal<Invoice | null>(null);
  loading = signal(true);

  // Modales
  showPaymentModal = signal(false);
  paymentAmount = signal<number>(0);
  paymentMethod = signal<string>('Efectivo');

  // WhatsApp Simulation state
  showWhatsAppModal = signal(false);
  whatsappMessage = signal('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.invoiceId.set(id);
      this.loadInvoiceDetails(id);
    }
  }

  loadInvoiceDetails(id: string) {
    this.loading.set(true);
    this.billingSvc.getInvoice(id).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.loading.set(false);
      },
      error: () => {
        // Fallback mock data offline
        const mockInv = MOCK_INVOICES_DETAILS.find(i => i.id === id) || MOCK_INVOICES_DETAILS[0];
        this.invoice.set(mockInv);
        this.loading.set(false);
      }
    });
  }

  issueInvoice() {
    const inv = this.invoice();
    if (!inv) return;

    this.billingSvc.issueInvoice(inv.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
      },
      error: () => {
        // Mock issue success
        this.invoice.update(current => current ? { ...current, status: 'issued', issuedAt: new Date() } : null);
      }
    });
  }

  openPaymentModal() {
    const inv = this.invoice();
    if (!inv) return;
    this.paymentAmount.set(inv.balance);
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
  }

  submitPayment() {
    const inv = this.invoice();
    if (!inv || this.paymentAmount() <= 0) return;

    this.billingSvc.registerPayment(inv.id, this.paymentAmount(), this.paymentMethod()).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.closePaymentModal();
      },
      error: () => {
        // Mock payment offline success
        const newPaid = inv.amountPaid + this.paymentAmount();
        const newBalance = Math.max(0, inv.total - newPaid);
        this.invoice.update(current => current ? {
          ...current,
          amountPaid: newPaid,
          balance: newBalance,
          status: newBalance === 0 ? 'paid' : 'partial',
          notes: current.notes + `\n[Pago registrado: ${this.paymentAmount()} mediante ${this.paymentMethod()}]`
        } : null);
        this.closePaymentModal();
      }
    });
  }

  shareWhatsApp() {
    const inv = this.invoice();
    if (!inv || !inv.tutor) return;

    const message = `Hola ${inv.tutor.firstName}, te compartimos el comprobante de tu mascota de la Clínica Veterinaria VetPro. \n\n🧾 Factura: ${inv.invoiceNumber}\n💰 Total: $${inv.total.toLocaleString('es-CO')}\n💳 Estado: ${this.statusLabel(inv.status).toUpperCase()}\n\n¡Gracias por confiar en nosotros! 🐾`;
    
    this.whatsappMessage.set(message);
    this.showWhatsAppModal.set(true);
  }

  closeWhatsAppModal() {
    this.showWhatsAppModal.set(false);
  }

  sendWhatsAppReal() {
    const inv = this.invoice();
    if (!inv || !inv.tutor) return;

    const phone = inv.tutor.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(this.whatsappMessage())}`;
    window.open(url, '_blank');
    this.closeWhatsAppModal();
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'issued': return 'Emitida';
      case 'partial': return 'Abono Parcial';
      case 'paid': return 'Pagada';
      case 'void': return 'Anulada';
      default: return status;
    }
  }

  printReceipt() {
    window.print();
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_INVOICES_DETAILS: Invoice[] = [
  {
    id: 'f1',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000001',
    tutorId: 't1',
    tutor: { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', phone: '+57 312 456 7890', email: 'carlos.gomez@correo.co', address: 'Calle 100 #15-30, Bogotá D.C.', createdAt: new Date() },
    status: 'paid',
    subtotal: 150000,
    taxTotal: 28500,
    total: 178500,
    amountPaid: 178500,
    balance: 0,
    issuedAt: new Date(Date.now() - 2 * 86400000),
    paidAt: new Date(Date.now() - 2 * 86400000),
    notes: 'Abono cancelado completo en caja. Toby se portó muy juicioso durante su control.',
    items: [
      { description: 'Consulta General Veterinaria', quantity: 1, unitPrice: 75000, taxRate: 0.19, discount: 0, total: 89250 },
      { description: 'Vacuna Antirrábica Nobivac (Lote RAB-2026)', quantity: 1, unitPrice: 75000, taxRate: 0.19, discount: 0, total: 89250 }
    ]
  },
  {
    id: 'f2',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000002',
    tutorId: 't2',
    tutor: { id: 't2', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', phone: '+57 300 987 6543', email: 'diana@correo.co', address: 'Av. Chile #72-10, Bogotá', createdAt: new Date() },
    status: 'partial',
    subtotal: 320000,
    taxTotal: 60800,
    total: 380800,
    amountPaid: 200000,
    balance: 180800,
    issuedAt: new Date(Date.now() - 5 * 86400000),
    notes: 'Pago parcial realizado por transferencia. Pendiente saldo de $180.800.',
    items: [
      { description: 'Esterilización Canina Hembra (< 15kg)', quantity: 1, unitPrice: 320000, taxRate: 0.19, discount: 0, total: 380800 }
    ]
  }
];
