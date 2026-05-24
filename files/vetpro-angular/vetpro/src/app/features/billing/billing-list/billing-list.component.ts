import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
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
        // Fallback offline mock data
        this.invoices.set(MOCK_INVOICES);
        this.loading.set(false);
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
        this.closePaymentModal();
      },
      error: () => {
        // Mock offline response
        const newPaid = inv.amountPaid + this.paymentAmount();
        const newBalance = Math.max(0, inv.total - newPaid);
        const updatedMock: Invoice = {
          ...inv,
          amountPaid: newPaid,
          balance: newBalance,
          status: newBalance === 0 ? 'paid' : 'partial'
        };
        this.updateInvoiceInList(updatedMock);
        this.closePaymentModal();
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
        this.closeVoidModal();
      },
      error: () => {
        // Mock offline response
        const updatedMock: Invoice = {
          ...inv,
          status: 'void',
          balance: 0
        };
        this.updateInvoiceInList(updatedMock);
        this.closeVoidModal();
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

// ── MOCK DATA ─────────────────────────────────

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'f1',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000001',
    tutorId: 't1',
    tutor: { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', phone: '+57 312 456 7890', createdAt: new Date() },
    status: 'paid',
    items: [],
    subtotal: 150000,
    taxTotal: 28500,
    total: 178500,
    amountPaid: 178500,
    balance: 0,
    issuedAt: new Date(Date.now() - 2 * 86400000),
    paidAt: new Date(Date.now() - 2 * 86400000)
  },
  {
    id: 'f2',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000002',
    tutorId: 't2',
    tutor: { id: 't2', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', phone: '+57 300 987 6543', createdAt: new Date() },
    status: 'partial',
    items: [],
    subtotal: 320000,
    taxTotal: 60800,
    total: 380800,
    amountPaid: 200000,
    balance: 180800,
    issuedAt: new Date(Date.now() - 5 * 86400000)
  },
  {
    id: 'f3',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000003',
    tutorId: 't1',
    tutor: { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', phone: '+57 312 456 7890', createdAt: new Date() },
    status: 'issued',
    items: [],
    subtotal: 80000,
    taxTotal: 15200,
    total: 95200,
    amountPaid: 0,
    balance: 95200,
    issuedAt: new Date(Date.now() - 1 * 86400000)
  },
  {
    id: 'f4',
    clinicId: 'c1',
    invoiceNumber: 'FAC-000004',
    tutorId: 't3',
    tutor: { id: 't3', clinicId: 'c1', firstName: 'Marta', lastName: 'Castro', phone: '+57 315 111 2222', createdAt: new Date() },
    status: 'draft',
    items: [],
    subtotal: 45000,
    taxTotal: 8550,
    total: 53550,
    amountPaid: 0,
    balance: 53550,
    issuedAt: new Date()
  }
];
