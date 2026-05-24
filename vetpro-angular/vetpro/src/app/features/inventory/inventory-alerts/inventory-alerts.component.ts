import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { Product } from '../../../core/models';

@Component({
  selector: 'app-inventory-alerts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="alerts-page">
      <div class="page-header">
        <a routerLink="/inventory" class="back-link"><span class="material-symbols-outlined">arrow_back</span> Inventario</a>
        <h1>Alertas de inventario</h1>
      </div>
      <div class="alerts-grid">
        <div class="alert-section">
          <div class="section-header critical"><span class="material-symbols-outlined">remove_shopping_cart</span> Sin stock ({{ outOfStock().length }})</div>
          <div class="product-alert-row" *ngFor="let p of outOfStock()">
            <strong>{{ p.name }}</strong>
            <span class="sku">{{ p.sku }}</span>
            <span class="badge-out">0 unidades</span>
            <a [routerLink]="['/inventory', p.id, 'edit']" class="action-link">Reponer</a>
          </div>
          <div class="empty-msg" *ngIf="outOfStock().length === 0">✓ Sin productos agotados</div>
        </div>
        <div class="alert-section">
          <div class="section-header warning"><span class="material-symbols-outlined">warning</span> Stock bajo ({{ lowStock().length }})</div>
          <div class="product-alert-row" *ngFor="let p of lowStock()">
            <strong>{{ p.name }}</strong>
            <span class="sku">{{ p.sku }}</span>
            <span class="badge-low">{{ p.currentStock }} / mín {{ p.minStock }}</span>
            <a [routerLink]="['/inventory', p.id, 'edit']" class="action-link">Ver</a>
          </div>
          <div class="empty-msg" *ngIf="lowStock().length === 0">✓ Sin alertas de stock bajo</div>
        </div>
        <div class="alert-section">
          <div class="section-header expiry"><span class="material-symbols-outlined">schedule</span> Por vencer en 30 días ({{ expiring().length }})</div>
          <div class="product-alert-row" *ngFor="let p of expiring()">
            <strong>{{ p.name }}</strong>
            <span class="sku">{{ p.sku }}</span>
            <span class="badge-expiry">{{ p.expiresAt | date:'dd/MM/yyyy' }}</span>
            <a [routerLink]="['/inventory', p.id, 'edit']" class="action-link">Ver</a>
          </div>
          <div class="empty-msg" *ngIf="expiring().length === 0">✓ Sin vencimientos próximos</div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './inventory-alerts.component.scss'
})
export class InventoryAlertsComponent implements OnInit {
  private svc = inject(InventoryService);
  outOfStock = signal<Product[]>([]);
  lowStock   = signal<Product[]>([]);
  expiring   = signal<Product[]>([]);

  ngOnInit() {
    this.svc.getLowStockProducts().subscribe({ next: p => { this.outOfStock.set(p.filter(x => x.currentStock === 0)); this.lowStock.set(p.filter(x => x.currentStock > 0)); }, error: () => {} });
    this.svc.getExpiringProducts(30).subscribe({ next: p => this.expiring.set(p), error: () => {} });
  }
}
