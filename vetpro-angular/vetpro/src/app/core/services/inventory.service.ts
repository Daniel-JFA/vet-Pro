import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  Product, InventoryMovement, Supplier,
  PurchaseOrder, PagedResult, QueryParams
} from '../models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private api = inject(ApiService);

  // ── Products ──────────────────────────────
  getProducts(params?: QueryParams): Observable<PagedResult<Product>> {
    return this.api.getPaged<Product>('/inventory/products', params);
  }

  getProduct(id: string): Observable<Product> {
    return this.api.get<Product>(`/inventory/products/${id}`);
  }

  createProduct(data: Partial<Product>): Observable<Product> {
    return this.api.post<Product>('/inventory/products', data);
  }

  updateProduct(id: string, data: Partial<Product>): Observable<Product> {
    return this.api.put<Product>(`/inventory/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<void> {
    return this.api.delete<void>(`/inventory/products/${id}`);
  }

  getLowStockProducts(): Observable<Product[]> {
    return this.api.get<Product[]>('/inventory/products/low-stock');
  }

  getExpiringProducts(daysAhead = 30): Observable<Product[]> {
    return this.api.get<Product[]>('/inventory/products/expiring', { daysAhead });
  }

  // ── Movements ────────────────────────────
  getMovements(params?: QueryParams): Observable<PagedResult<InventoryMovement>> {
    return this.api.getPaged<InventoryMovement>('/inventory/movements', params);
  }

  registerMovement(data: Partial<InventoryMovement>): Observable<InventoryMovement> {
    return this.api.post<InventoryMovement>('/inventory/movements', data);
  }

  // ── Suppliers ────────────────────────────
  getSuppliers(): Observable<Supplier[]> {
    return this.api.get<Supplier[]>('/inventory/suppliers');
  }

  createSupplier(data: Partial<Supplier>): Observable<Supplier> {
    return this.api.post<Supplier>('/inventory/suppliers', data);
  }

  // ── Purchase Orders ───────────────────────
  getPurchaseOrders(params?: QueryParams): Observable<PagedResult<PurchaseOrder>> {
    return this.api.getPaged<PurchaseOrder>('/inventory/purchase-orders', params);
  }

  createPurchaseOrder(data: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    return this.api.post<PurchaseOrder>('/inventory/purchase-orders', data);
  }

  receivePurchaseOrder(id: string, items: any[]): Observable<PurchaseOrder> {
    return this.api.patch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`, { items });
  }
}
