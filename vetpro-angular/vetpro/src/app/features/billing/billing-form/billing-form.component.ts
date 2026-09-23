import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { PatientService } from '../../../core/services/patient.service';
import { ServiceCatalogService, ServiceCatalogItem } from '../../../core/services/service-catalog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Tutor } from '../../../core/models';

interface BillingItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // e.g. 0.19 for 19% IVA Colombia
  discount: number; // e.g. 0 for 0%
}

@Component({
  selector: 'app-billing-form',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './billing-form.component.html',
  styleUrl: './billing-form.component.scss'
})
export class BillingFormComponent implements OnInit {
  private billingSvc = inject(BillingService);
  private patientSvc = inject(PatientService);
  private catalogSvc = inject(ServiceCatalogService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  submitting = signal(false);

  // Lista de tutores registrados en el sistema
  tutors = signal<Tutor[]>([]);
  selectedTutorId = signal<string>('');

  notes = signal<string>('');
  dueAt = signal<string>('');

  // Items agregados a la factura (arranca vacío — cada clínica define sus propios precios)
  items = signal<BillingItemInput[]>([
    { description: '', quantity: 1, unitPrice: 0, taxRate: 0.19, discount: 0 }
  ]);

  // Catálogo de servicios propio de la clínica (se carga de la BD, no hay precios fijos de plataforma)
  quickServices = signal<ServiceCatalogItem[]>([]);
  loadingCatalog = signal(true);

  // Formulario para agregar un servicio nuevo al catálogo de la clínica
  showAddService = signal(false);
  newServiceName = signal('');
  newServicePrice = signal<number | null>(null);
  newServiceTax = signal(0.19);
  savingService = signal(false);

  // Cálculos reactivos de la factura
  totals = computed(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    this.items().forEach(item => {
      const base = item.quantity * item.unitPrice;
      const discountVal = base * (item.discount / 100);
      const net = base - discountVal;
      const tax = net * item.taxRate;

      subtotal += net;
      taxTotal += tax;
      discountTotal += discountVal;
    });

    const total = subtotal + taxTotal;

    return {
      subtotal,
      taxTotal,
      discountTotal,
      total
    };
  });

  ngOnInit() {
    // Establecer fecha de vencimiento predeterminada en 7 días
    const date = new Date();
    date.setDate(date.getDate() + 7);
    this.dueAt.set(date.toISOString().split('T')[0]);

    // Leer parámetros de URL (Cita → Factura / Historia → Factura)
    const query = this.route.snapshot.queryParamMap;
    const tutorId = query.get('tutorId');
    if (tutorId) {
      this.selectedTutorId.set(tutorId);
    }
    const serviceName = query.get('serviceName') || query.get('service');
    const priceStr = query.get('price');
    const price = priceStr ? parseFloat(priceStr) : null;
    const appointmentId = query.get('appointmentId');
    const patientName = query.get('patientName');

    if (serviceName) {
      this.items.set([{
        description: patientName ? `${serviceName} (Paciente: ${patientName})` : serviceName,
        quantity: 1,
        unitPrice: price !== null && !isNaN(price) ? price : 50000,
        taxRate: 0.19,
        discount: 0
      }]);
    }
    if (appointmentId) {
      this.notes.set(`Facturación correspondiente a atención #${appointmentId.slice(0, 8)}`);
    }

    this.loadTutors();
    this.loadCatalog();
  }

  private loadCatalog() {
    this.loadingCatalog.set(true);
    this.catalogSvc.getServices().subscribe({
      next: (list) => {
        this.quickServices.set(list);
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.loadingCatalog.set(false);
        this.toast.error('No se pudo cargar el catálogo de servicios de la clínica.');
      }
    });
  }

  toggleAddService() {
    this.showAddService.update(v => !v);
    this.newServiceName.set('');
    this.newServicePrice.set(null);
    this.newServiceTax.set(0.19);
  }

  saveNewService() {
    const name = this.newServiceName().trim();
    const salePrice = this.newServicePrice();
    if (!name || salePrice === null || salePrice < 0) {
      this.toast.error('Indica un nombre y un precio válido para el servicio.');
      return;
    }

    this.savingService.set(true);
    this.catalogSvc.createService({ name, salePrice, taxRate: this.newServiceTax() }).subscribe({
      next: (created) => {
        this.savingService.set(false);
        this.quickServices.update(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        this.toggleAddService();
        this.toast.success('Servicio agregado a tu catálogo.');
      },
      error: (err) => {
        this.savingService.set(false);
        this.toast.error(err?.error?.error || 'No se pudo guardar el servicio.');
      }
    });
  }

  private loadTutors() {
    this.loading.set(true);
    this.patientSvc.getTutors().subscribe({
      next: (res) => {
        this.tutors.set(res.data);
        const preselected = this.route.snapshot.queryParamMap.get('tutorId');
        if (preselected && res.data.some(t => t.id === preselected)) {
          this.selectedTutorId.set(preselected);
        } else if (res.data.length > 0 && !this.selectedTutorId()) {
          this.selectedTutorId.set(res.data[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar el listado de tutores. Verifica tu conexión e intenta de nuevo.');
      }
    });
  }

  addItem(description = '', quantity = 1, unitPrice = 0, taxRate = 0.19, discount = 0) {
    this.items.update(list => [
      ...list,
      { description, quantity, unitPrice, taxRate, discount }
    ]);
  }

  removeItem(index: number) {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  addQuickService(service: ServiceCatalogItem) {
    // Si hay un item vacío en la lista (por ej. primer item con precio 0), lo reemplazamos
    const list = this.items();
    if (list.length === 1 && list[0].unitPrice === 0 && !list[0].description) {
      this.items.set([{
        description: service.name,
        quantity: 1,
        unitPrice: service.salePrice,
        taxRate: service.taxRate,
        discount: 0
      }]);
    } else {
      this.addItem(service.name, 1, service.salePrice, service.taxRate, 0);
    }
  }

  updateItemField(index: number, field: keyof BillingItemInput, event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    let value: any = target.value;

    if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate' || field === 'discount') {
      value = parseFloat(value) || 0;
    }

    this.items.update(list => list.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  onSubmit() {
    if (!this.selectedTutorId() || this.items().length === 0) return;

    this.submitting.set(true);

    const invoiceData = {
      tutorId: this.selectedTutorId(),
      notes: this.notes(),
      dueAt: this.dueAt() ? new Date(this.dueAt()) : undefined,
      items: this.items().map(item => {
        const base = item.quantity * item.unitPrice;
        const discountVal = base * (item.discount / 100);
        const net = base - discountVal;
        const tax = net * item.taxRate;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
          total: parseFloat((net + tax).toFixed(2))
        };
      })
    };

    this.billingSvc.createInvoice(invoiceData).subscribe({
      next: (createdInvoice) => {
        this.submitting.set(false);
        this.toast.success('Factura creada exitosamente.');
        this.router.navigate(['/billing', createdInvoice.id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(err?.error?.error || 'No se pudo crear la factura. Verifica los datos e intenta de nuevo.');
      }
    });
  }
}
