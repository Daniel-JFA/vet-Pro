import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { InventoryMovement, Product, MovementType } from '../../../core/models';

@Component({
  selector: 'app-inventory-movements',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './inventory-movements.component.html',
  styleUrl: './inventory-movements.component.scss'
})
export class InventoryMovementsComponent implements OnInit {
  private svc = inject(InventoryService);
  private fb  = inject(FormBuilder);
  private toast = inject(ToastService);

  movements = signal<InventoryMovement[]>([]);
  products  = signal<Product[]>([]);
  loading   = signal(true);
  showForm  = signal(false);
  saving    = signal(false);

  movementTypes: { value: MovementType; label: string; icon: string; color: string }[] = [
    { value: 'in',         label: 'Entrada',    icon: 'add_circle',    color: 'green' },
    { value: 'out',        label: 'Salida',     icon: 'remove_circle', color: 'red' },
    { value: 'adjustment', label: 'Ajuste',     icon: 'tune',          color: 'blue' },
    { value: 'return',     label: 'Devolución', icon: 'replay',        color: 'amber' },
    { value: 'loss',       label: 'Pérdida',    icon: 'delete_forever','color': 'red' },
  ];

  form = this.fb.group({
    productId: ['', Validators.required],
    type:      ['in' as MovementType, Validators.required],
    quantity:  [1, [Validators.required, Validators.min(1)]],
    unitCost:  [0],
    reason:    [''],
    batchNumber: [''],
    expiryDate:  [''],
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getMovements({ pageSize: 50 }).subscribe({
      next: res => { this.movements.set(res.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('No se pudo cargar el kardex de movimientos.'); }
    });
    this.svc.getProducts({ pageSize: 200 }).subscribe({
      next: res => this.products.set(res.data),
      error: () => this.toast.error('No se pudo cargar el listado de productos.')
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.svc.registerMovement(this.form.value as any).subscribe({
      next: () => {
        this.showForm.set(false);
        this.form.reset({ type: 'in', quantity: 1 });
        this.saving.set(false);
        this.toast.success('Movimiento de inventario registrado exitosamente.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'No se pudo registrar el movimiento. Verifica los datos e intenta de nuevo.');
      }
    });
  }

  typeInfo(type: MovementType) { return this.movementTypes.find(t => t.value === type)!; }
  productName(id: string) { return this.products().find(p => p.id === id)?.name ?? id; }
  sign(type: MovementType): string { return ['in','return'].includes(type) ? '+' : '-'; }
}
