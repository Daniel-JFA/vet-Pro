import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ProductCategory, Supplier } from '../../../core/models';

@Component({
  selector: 'app-inventory-form',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './inventory-form.component.html',
  styleUrl: './inventory-form.component.scss'
})
export class InventoryFormComponent implements OnInit {
  private fb     = inject(FormBuilder);
  private svc    = inject(InventoryService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  isEdit    = signal(false);
  saving    = signal(false);
  suppliers = signal<Supplier[]>([]);
  activeTab = signal<'basic' | 'pricing' | 'stock'>('basic');

  categories: { value: ProductCategory; label: string; icon: string }[] = [
    { value: 'medication',      label: 'Medicamento',          icon: 'medication' },
    { value: 'vaccine',         label: 'Vacuna',               icon: 'vaccines' },
    { value: 'surgical-supply', label: 'Insumo quirúrgico',    icon: 'surgical' },
    { value: 'consumable',      label: 'Consumible',           icon: 'inventory' },
    { value: 'food',            label: 'Alimento',             icon: 'restaurant' },
    { value: 'accessory',       label: 'Accesorio',            icon: 'pet_supplies' },
    { value: 'lab-reagent',     label: 'Reactivo de laboratorio', icon: 'science' },
    { value: 'other',           label: 'Otro',                 icon: 'category' },
  ];

  units = ['Tableta','Cápsula','ml','mg','g','Kg','Dosis','Vial','Ampolleta','Unidad','Caja','Bolsa','Litro'];

  form = this.fb.group({
    sku:                  ['', [Validators.required, Validators.minLength(3)]],
    name:                 ['', [Validators.required, Validators.minLength(2)]],
    category:             ['medication' as ProductCategory, Validators.required],
    brand:                [''],
    unit:                 ['Tableta', Validators.required],
    description:          [''],
    barcode:              [''],
    requiresPrescription: [false],
    controlled:           [false],
    supplierId:           [''],
    // pricing
    costPrice:  [0, [Validators.required, Validators.min(0)]],
    salePrice:  [0, [Validators.required, Validators.min(0)]],
    taxRate:    [0],
    // stock
    currentStock: [0, [Validators.required, Validators.min(0)]],
    minStock:     [5,  [Validators.required, Validators.min(0)]],
    expiresAt:    [''],
  });

  get margin(): number {
    const cost = this.form.value.costPrice ?? 0;
    const sale = this.form.value.salePrice ?? 0;
    if (!sale || !cost) return 0;
    return Math.round(((sale - cost) / sale) * 100);
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.svc.getProduct(id).subscribe(p => this.form.patchValue({ ...p, expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().split('T')[0] : '' }));
    }
    this.svc.getSuppliers().subscribe({ next: s => this.suppliers.set(s), error: () => {} });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const id = this.route.snapshot.paramMap.get('id');
    const data = { ...this.form.value, expiresAt: this.form.value.expiresAt ? new Date(this.form.value.expiresAt!) : undefined };
    const obs = id ? this.svc.updateProduct(id, data as any) : this.svc.createProduct(data as any);
    obs.subscribe({ next: () => this.router.navigate(['/inventory']), error: () => this.saving.set(false) });
  }

  err(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && c.touched);
  }
}
