import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { DianService } from '../../../core/services/dian.service';
import { ToastService } from '../../../core/services/toast.service';
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
  private toast = inject(ToastService);

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

  // DIAN Electronic Invoice State
  isDianIssued = signal(false);
  dianStatus = signal<'pending' | 'accepted' | 'rejected'>('pending');
  cufeCode = signal<string | null>(null);
  dianTransmitting = signal(false);

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
        this.loading.set(false);
        this.toast.error('No se pudo cargar el comprobante de la factura.');
      }
    });
  }

  issueInvoice() {
    const inv = this.invoice();
    if (!inv) return;

    this.billingSvc.issueInvoice(inv.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.toast.success('Factura emitida exitosamente.');
      },
      error: () => {
        this.toast.error('No se pudo emitir la factura. Intenta de nuevo.');
      }
    });
  }

  private dianService = inject(DianService);

  transmitToDian() {
    const inv = this.invoice();
    if (!inv) return;

    this.dianTransmitting.set(true);

    this.dianService.issueInvoiceDian(inv.id).subscribe({
      next: (res) => {
        this.cufeCode.set(res.dianDetails.cufe);
        this.isDianIssued.set(true);
        this.dianStatus.set(res.transmittedToDian ? 'accepted' : 'pending');
        this.dianTransmitting.set(false);
        this.invoice.set(res.invoice);
        if (res.transmittedToDian) {
          this.toast.success(res.message);
        } else {
          this.toast.warning(res.message);
        }
      },
      error: () => {
        this.dianTransmitting.set(false);
        this.toast.error('No se pudo procesar la emisión electrónica ante la DIAN. Intenta de nuevo.');
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
        this.toast.success('Pago registrado exitosamente.');
        this.closePaymentModal();
      },
      error: () => {
        this.toast.error('No se pudo registrar el pago. Verifica los datos e intenta de nuevo.');
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
