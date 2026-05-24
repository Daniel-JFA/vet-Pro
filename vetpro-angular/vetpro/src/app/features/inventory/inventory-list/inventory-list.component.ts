import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { Product, ProductCategory } from '../../../core/models';
import { CurrencyCopPipe } from '../../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CurrencyCopPipe],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss'
})
export class InventoryListComponent implements OnInit {
  private svc = inject(InventoryService);

  products = signal<Product[]>([]);
  loading = signal(true);
  search = signal('');
  categoryFilter = signal<ProductCategory | ''>('');
  stockFilter = signal<'all' | 'low' | 'ok' | 'out'>('all');
  page = signal(1);
  pageSize = 20;
  total = signal(0);

  categories: { value: ProductCategory | ''; label: string }[] = [
    { value: '', label: 'Todas las categorías' },
    { value: 'medication', label: 'Medicamentos' },
    { value: 'vaccine', label: 'Vacunas' },
    { value: 'surgical-supply', label: 'Insumos quirúrgicos' },
    { value: 'consumable', label: 'Consumibles' },
    { value: 'food', label: 'Alimentos' },
    { value: 'accessory', label: 'Accesorios' },
    { value: 'lab-reagent', label: 'Reactivos' },
    { value: 'other', label: 'Otro' },
  ];

  filtered = computed(() => {
    let list = this.products();
    const q = this.search().toLowerCase();
    if (q) list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    );
    if (this.categoryFilter()) list = list.filter(p => p.category === this.categoryFilter());
    if (this.stockFilter() === 'out') list = list.filter(p => p.currentStock === 0);
    if (this.stockFilter() === 'low') list = list.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock);
    if (this.stockFilter() === 'ok')  list = list.filter(p => p.currentStock > p.minStock);
    return list;
  });

  stats = computed(() => ({
    total: this.products().length,
    lowStock: this.products().filter(p => p.currentStock > 0 && p.currentStock <= p.minStock).length,
    outOfStock: this.products().filter(p => p.currentStock === 0).length,
    expiringSoon: this.products().filter(p => {
      if (!p.expiresAt) return false;
      const days = (new Date(p.expiresAt).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 30;
    }).length,
  }));

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getProducts({ page: this.page(), pageSize: this.pageSize }).subscribe({
      next: res => { this.products.set(res.data); this.total.set(res.total); this.loading.set(false); },
      error: () => { this.loading.set(false); this.products.set(MOCK_PRODUCTS); this.total.set(MOCK_PRODUCTS.length); }
    });
  }

  stockStatus(p: Product): 'out' | 'low' | 'ok' {
    if (p.currentStock === 0) return 'out';
    if (p.currentStock <= p.minStock) return 'low';
    return 'ok';
  }

  categoryLabel(cat: ProductCategory): string {
    return this.categories.find(c => c.value === cat)?.label ?? cat;
  }

  isExpiringSoon(p: Product): boolean {
    if (!p.expiresAt) return false;
    const days = (new Date(p.expiresAt).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }

  trackById(_: number, p: Product) { return p.id; }
}

// ── Mock data for development ──────────────────
const MOCK_PRODUCTS: Product[] = [
  { id:'1', clinicId:'c1', sku:'MED-001', name:'Amoxicilina 500mg', category:'medication', brand:'Pfizer', unit:'Tableta', requiresPrescription:true, controlled:false, minStock:20, currentStock:5, costPrice:800, salePrice:1500, taxRate:0, active:true, createdAt:new Date(), expiresAt:new Date(Date.now()+15*86400000) },
  { id:'2', clinicId:'c1', sku:'VAC-001', name:'Vacuna Antirrábica', category:'vaccine', brand:'Nobivac', unit:'Dosis', requiresPrescription:false, controlled:false, minStock:10, currentStock:0, costPrice:12000, salePrice:25000, taxRate:0, active:true, createdAt:new Date(), expiresAt:new Date(Date.now()+60*86400000) },
  { id:'3', clinicId:'c1', sku:'MED-002', name:'Prednisolona 5mg', category:'medication', brand:'MSD', unit:'Tableta', requiresPrescription:true, controlled:false, minStock:30, currentStock:45, costPrice:500, salePrice:1200, taxRate:0, active:true, createdAt:new Date() },
  { id:'4', clinicId:'c1', sku:'INS-001', name:'Jeringa 3ml c/aguja', category:'consumable', brand:'Nipro', unit:'Unidad', requiresPrescription:false, controlled:false, minStock:50, currentStock:120, costPrice:300, salePrice:600, taxRate:0.19, active:true, createdAt:new Date() },
  { id:'5', clinicId:'c1', sku:'MED-003', name:'Enrofloxacina 50mg/ml', category:'medication', brand:'Bayer', unit:'ml', requiresPrescription:true, controlled:false, minStock:5, currentStock:8, costPrice:3500, salePrice:7000, taxRate:0, active:true, createdAt:new Date(), expiresAt:new Date(Date.now()+45*86400000) },
  { id:'6', clinicId:'c1', sku:'ALI-001', name:'Royal Canin Urinary SO', category:'food', brand:'Royal Canin', unit:'Kg', requiresPrescription:false, controlled:false, minStock:5, currentStock:12, costPrice:45000, salePrice:72000, taxRate:0, active:true, createdAt:new Date() },
  { id:'7', clinicId:'c1', sku:'VAC-002', name:'Triple Felina (RCP)', category:'vaccine', brand:'Felocell', unit:'Dosis', requiresPrescription:false, controlled:false, minStock:8, currentStock:3, costPrice:15000, salePrice:35000, taxRate:0, active:true, createdAt:new Date(), expiresAt:new Date(Date.now()+90*86400000) },
  { id:'8', clinicId:'c1', sku:'QUI-001', name:'Ketamina 500mg/10ml', category:'medication', brand:'Holliday', unit:'Vial', requiresPrescription:true, controlled:true, minStock:3, currentStock:6, costPrice:28000, salePrice:55000, taxRate:0, active:true, createdAt:new Date() },
];
