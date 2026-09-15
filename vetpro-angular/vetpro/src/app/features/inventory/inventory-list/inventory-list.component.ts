import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
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
  private toast = inject(ToastService);

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
      error: () => { this.loading.set(false); this.toast.error('No se pudo cargar el inventario. Verifica tu conexión e intenta de nuevo.'); }
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
