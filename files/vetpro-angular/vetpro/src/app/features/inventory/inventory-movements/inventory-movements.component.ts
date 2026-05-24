import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
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
      error: () => { this.movements.set(MOCK_MOVEMENTS); this.loading.set(false); }
    });
    this.svc.getProducts({ pageSize: 200 }).subscribe({
      next: res => this.products.set(res.data),
      error: () => this.products.set([])
    });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.svc.registerMovement(this.form.value as any).subscribe({
      next: () => { this.showForm.set(false); this.form.reset({ type: 'in', quantity: 1 }); this.saving.set(false); this.load(); },
      error: () => this.saving.set(false)
    });
  }

  typeInfo(type: MovementType) { return this.movementTypes.find(t => t.value === type)!; }
  productName(id: string) { return this.products().find(p => p.id === id)?.name ?? id; }
  sign(type: MovementType): string { return ['in','return'].includes(type) ? '+' : '-'; }
}

const MOCK_MOVEMENTS: InventoryMovement[] = [
  { id:'m1', clinicId:'c1', productId:'1', type:'in', quantity:50, quantityBefore:20, quantityAfter:70, unitCost:800, reason:'Compra proveedor', performedBy:'Ana María', performedAt:new Date(Date.now()-3600000*2), batchNumber:'B2025-01' },
  { id:'m2', clinicId:'c1', productId:'2', type:'out', quantity:2, quantityBefore:10, quantityAfter:8, reason:'Consulta #1042', performedBy:'Dr. Pérez', performedAt:new Date(Date.now()-3600000*5) },
  { id:'m3', clinicId:'c1', productId:'3', type:'adjustment', quantity:5, quantityBefore:40, quantityAfter:45, reason:'Inventario físico', performedBy:'Ana María', performedAt:new Date(Date.now()-86400000) },
  { id:'m4', clinicId:'c1', productId:'4', type:'loss', quantity:3, quantityBefore:50, quantityAfter:47, reason:'Caducidad', performedBy:'Dr. Gómez', performedAt:new Date(Date.now()-86400000*2) },
];
