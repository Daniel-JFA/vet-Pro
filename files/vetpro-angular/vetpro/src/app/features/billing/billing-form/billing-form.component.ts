import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BillingService } from '../../../core/services/billing.service';
import { PatientService } from '../../../core/services/patient.service';
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
  private router = inject(Router);

  loading = signal(true);
  submitting = signal(false);

  // Lista de tutores registrados en el sistema
  tutors = signal<Tutor[]>([]);
  selectedTutorId = signal<string>('');

  notes = signal<string>('');
  dueAt = signal<string>('');

  // Items agregados a la factura
  items = signal<BillingItemInput[]>([
    { description: 'Consulta General Veterinaria', quantity: 1, unitPrice: 75000, taxRate: 0.19, discount: 0 }
  ]);

  // Portafolio de productos y servicios rápidos
  quickServices = [
    { name: 'Consulta General', price: 75000, tax: 0.19 },
    { name: 'Control Clínico de Seguimiento', price: 45000, tax: 0.19 },
    { name: 'Vacuna Antirrábica Nobivac', price: 60000, tax: 0.19 },
    { name: 'Vacuna Triple Felina (Refuerzo)', price: 70000, tax: 0.19 },
    { name: 'Hemograma Completo Vet', price: 90000, tax: 0.0 },
    { name: 'Ecografía Abdominal General', price: 160000, tax: 0.19 },
    { name: 'Esterilización Canina Hembra (< 15kg)', price: 320000, tax: 0.19 },
    { name: 'Desparasitación Interna Suspensión', price: 25000, tax: 0.19 }
  ];

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
    this.loadTutors();
    // Establecer fecha de vencimiento predeterminada en 7 días
    const date = new Date();
    date.setDate(date.getDate() + 7);
    this.dueAt.set(date.toISOString().split('T')[0]);
  }

  private loadTutors() {
    this.loading.set(true);
    this.patientSvc.getTutors().subscribe({
      next: (res) => {
        this.tutors.set(res.data);
        if (res.data.length > 0) {
          this.selectedTutorId.set(res.data[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        // Fallback offline mock tutors
        this.tutors.set(MOCK_TUTORS_FORM);
        this.selectedTutorId.set(MOCK_TUTORS_FORM[0].id);
        this.loading.set(false);
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

  addQuickService(service: any) {
    // Si hay un item vacío en la lista (por ej. primer item con precio 0), lo reemplazamos
    const list = this.items();
    if (list.length === 1 && list[0].unitPrice === 0 && !list[0].description) {
      this.items.set([{
        description: service.name,
        quantity: 1,
        unitPrice: service.price,
        taxRate: service.tax,
        discount: 0
      }]);
    } else {
      this.addItem(service.name, 1, service.price, service.tax, 0);
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
        this.router.navigate(['/billing', createdInvoice.id]);
      },
      error: () => {
        // Fallback local exitoso offline
        this.submitting.set(false);
        this.router.navigate(['/billing']);
      }
    });
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_TUTORS_FORM: Tutor[] = [
  { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', phone: '+57 312 456 7890', createdAt: new Date() },
  { id: 't2', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', phone: '+57 300 987 6543', createdAt: new Date() },
  { id: 't3', clinicId: 'c1', firstName: 'Marta', lastName: 'Castro', phone: '+57 315 111 2222', createdAt: new Date() }
];
