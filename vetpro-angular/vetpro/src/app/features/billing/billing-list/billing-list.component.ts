import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { ToastService } from '../../../core/services/toast.service';
import { Invoice } from '../../../core/models';

@Component({
  selector: 'app-billing-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './billing-list.component.html',
  styleUrl: './billing-list.component.scss'
})
export class BillingListComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private toast = inject(ToastService);

  loading = signal(true);
  search = signal('');
  statusFilter = signal<string>('all');
  invoices = signal<Invoice[]>([]);

  // Modales de Pago y Anulación
  showPaymentModal = signal(false);
  showVoidModal = signal(false);
  selectedInvoice = signal<Invoice | null>(null);

  // Campos para nuevo pago
  paymentAmount = signal<number>(0);
  paymentMethod = signal<string>('Efectivo');

  // Campos para anulación
  voidReason = signal<string>('');

  // Estadísticas acumuladas
  stats = computed(() => {
    const list = this.invoices().filter(inv => inv.status !== 'void');
    const totalInvoiced = list.reduce((acc, cur) => acc + cur.total, 0);
    const totalCollected = list.reduce((acc, cur) => acc + cur.amountPaid, 0);
    const totalPending = list.reduce((acc, cur) => acc + cur.balance, 0);

    return {
      invoiced: totalInvoiced,
      collected: totalCollected,
      pending: totalPending
    };
  });

  filteredInvoices = computed(() => {
    let list = this.invoices();
    const q = this.search().trim().toLowerCase();

    if (q) {
      list = list.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.tutor && (
          inv.tutor.firstName.toLowerCase().includes(q) ||
          inv.tutor.lastName.toLowerCase().includes(q) ||
          (inv.tutor.phone && inv.tutor.phone.includes(q))
        ))
      );
    }

    if (this.statusFilter() !== 'all') {
      list = list.filter(inv => inv.status === this.statusFilter());
    }

    return list;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.billingSvc.getInvoices().subscribe({
      next: (res) => {
        this.invoices.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el listado de facturas. Verifica tu conexión e intenta de nuevo.');
      }
    });
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

  openPaymentModal(invoice: Invoice) {
    this.selectedInvoice.set(invoice);
    this.paymentAmount.set(invoice.balance);
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.selectedInvoice.set(null);
  }

  submitPayment() {
    const inv = this.selectedInvoice();
    if (!inv || this.paymentAmount() <= 0) return;

    this.billingSvc.registerPayment(inv.id, this.paymentAmount(), this.paymentMethod()).subscribe({
      next: (updatedInvoice) => {
        this.updateInvoiceInList(updatedInvoice);
        this.toast.success('Pago registrado exitosamente.');
        this.closePaymentModal();
      },
      error: () => {
        this.toast.error('No se pudo registrar el pago. Verifica los datos e intenta de nuevo.');
      }
    });
  }

  openVoidModal(invoice: Invoice) {
    this.selectedInvoice.set(invoice);
    this.voidReason.set('');
    this.showVoidModal.set(true);
  }

  closeVoidModal() {
    this.showVoidModal.set(false);
    this.selectedInvoice.set(null);
  }

  submitVoid() {
    const inv = this.selectedInvoice();
    if (!inv) return;

    this.billingSvc.voidInvoice(inv.id, this.voidReason()).subscribe({
      next: (updatedInvoice) => {
        this.updateInvoiceInList(updatedInvoice);
        this.toast.success('Factura anulada exitosamente.');
        this.closeVoidModal();
      },
      error: () => {
        this.toast.error('No se pudo anular la factura. Intenta de nuevo.');
      }
    });
  }

  updateInvoiceInList(updated: Invoice) {
    this.invoices.update(list => list.map(item => item.id === updated.id ? updated : item));
  }

  trackById(_: number, item: Invoice) {
    return item.id;
  }
}
