import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { DianService, DianResolution, CashRegisterShift } from '../../../core/services/dian.service';
import { AuthService } from '../../../core/services/auth.service';
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
  private dianSvc = inject(DianService);
  private authSvc = inject(AuthService);
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

  // ─────────────────────────────────────────────
  // CONTROL DE CAJA / POS (CIERRES Y ARQUEOS)
  // ─────────────────────────────────────────────
  currentShift = signal<CashRegisterShift | null>(null);
  showShiftModal = signal(false);
  shiftLoading = signal(false);
  openingBalance = signal<number>(50000);
  actualBalance = signal<number>(0);
  shiftNotes = signal<string>('');

  // ─────────────────────────────────────────────
  // RESOLUCIONES DIAN
  // ─────────────────────────────────────────────
  showResolutionModal = signal(false);
  resolutions = signal<DianResolution[]>([]);
  resPrefix = signal<string>('FEV');
  resNumber = signal<string>('18760000001');
  resFrom = signal<number>(1);
  resTo = signal<number>(10000);
  resKey = signal<string>('9b7c8a123f456789abcdef0123456789abcdef01');
  resEnvironment = signal<'test' | 'production'>('test');
  resStartDate = signal<string>('2026-01-01');
  resEndDate = signal<string>('2026-12-31');

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
    this.loadShift();
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

  loadShift() {
    this.dianSvc.getCurrentShift().subscribe({
      next: (shift) => {
        this.currentShift.set(shift);
        if (shift) {
          this.actualBalance.set(shift.expectedBalance);
        }
      },
      error: () => {}
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
        this.loadShift();
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

  // ─────────────────────────────────────────────
  // MÉTODOS DE CAJA POS
  // ─────────────────────────────────────────────
  openShiftModal() {
    this.loadShift();
    this.showShiftModal.set(true);
  }

  closeShiftModal() {
    this.showShiftModal.set(false);
  }

  submitOpenShift() {
    const branchId = this.authSvc.activeBranchId();
    if (!branchId) {
      this.toast.error('Debes tener una sede seleccionada para abrir caja.');
      return;
    }

    this.shiftLoading.set(true);
    this.dianSvc.openShift({
      branchId,
      openingBalance: this.openingBalance(),
      notes: this.shiftNotes()
    }).subscribe({
      next: (shift) => {
        this.currentShift.set(shift);
        this.shiftLoading.set(false);
        this.toast.success('Apertura de caja realizada exitosamente.');
        this.closeShiftModal();
      },
      error: (err) => {
        this.shiftLoading.set(false);
        this.toast.error(err.error?.error || 'Error al abrir la caja.');
      }
    });
  }

  submitCloseShift() {
    const shift = this.currentShift();
    if (!shift) return;

    this.shiftLoading.set(true);
    this.dianSvc.closeShift({
      shiftId: shift.id,
      actualBalance: this.actualBalance(),
      notes: this.shiftNotes()
    }).subscribe({
      next: (res) => {
        this.currentShift.set(null);
        this.shiftLoading.set(false);
        const diff = res.difference || 0;
        if (diff === 0) {
          this.toast.success('Cierre de caja completado. ¡Arqueo exacto sin descuadre!');
        } else if (diff > 0) {
          this.toast.info(`Cierre completado. Sobrante de efectivo: $${diff.toLocaleString()}`);
        } else {
          this.toast.warning(`Cierre completado. Faltante de efectivo: $${Math.abs(diff).toLocaleString()}`);
        }
        this.closeShiftModal();
      },
      error: (err) => {
        this.shiftLoading.set(false);
        this.toast.error(err.error?.error || 'Error al realizar el arqueo y cierre de caja.');
      }
    });
  }

  // ─────────────────────────────────────────────
  // MÉTODOS DE RESOLUCIONES DIAN
  // ─────────────────────────────────────────────
  openResolutionModal() {
    this.loadResolutions();
    this.showResolutionModal.set(true);
  }

  closeResolutionModal() {
    this.showResolutionModal.set(false);
  }

  loadResolutions() {
    this.dianSvc.getResolutions().subscribe({
      next: (res) => this.resolutions.set(res),
      error: () => this.toast.error('Error al consultar resoluciones DIAN.')
    });
  }

  submitCreateResolution() {
    this.dianSvc.createResolution({
      prefix: this.resPrefix(),
      resolutionNumber: this.resNumber(),
      fromNumber: this.resFrom(),
      toNumber: this.resTo(),
      startDate: this.resStartDate(),
      endDate: this.resEndDate(),
      technicalKey: this.resKey(),
      environment: this.resEnvironment()
    }).subscribe({
      next: () => {
        this.toast.success('Resolución DIAN configurada exitosamente.');
        this.loadResolutions();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al registrar resolución DIAN.');
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
