import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarketplaceService, PaymentStatusResponse } from '../../../core/services/marketplace.service';

// Página a la que Wompi devuelve al usuario después de pagar (WOMPI_REDIRECT_URL).
// El pago lo confirma el webhook; aquí solo se consulta el estado hasta que deje de estar pendiente.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-result.component.html',
  styleUrls: ['./payment-result.component.scss']
})
export class PaymentResultComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private marketplaceService = inject(MarketplaceService);

  reference = signal<string | null>(null);
  result = signal<PaymentStatusResponse | null>(null);
  notFound = signal(false);
  timedOut = signal(false);

  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  status = computed(() => this.result()?.status ?? 'PENDING');

  backLink = computed(() => {
    switch (this.result()?.paymentType) {
      case 'subscription_pro_vet': return { url: '/perfil-profesional', label: 'Ir a mi perfil profesional' };
      case 'clinic_subscription': return { url: '/suscripcion', label: 'Ir a mi suscripción' };
      default: return { url: '/directorio', label: 'Volver al directorio' };
    }
  });

  ngOnInit(): void {
    const ref = this.route.snapshot.queryParamMap.get('ref');
    this.reference.set(ref);
    if (!ref) {
      this.notFound.set(true);
      return;
    }
    this.poll(ref);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private poll(ref: string): void {
    this.attempts++;
    this.marketplaceService.getPaymentStatus(ref).subscribe({
      next: (res) => {
        this.result.set(res);
        if (res.status === 'PENDING') this.scheduleNext(ref);
      },
      error: (err) => {
        if (err.status === 404) {
          this.notFound.set(true);
        } else {
          this.scheduleNext(ref);
        }
      }
    });
  }

  private scheduleNext(ref: string): void {
    if (this.attempts >= MAX_ATTEMPTS) {
      this.timedOut.set(true);
      return;
    }
    this.timer = setTimeout(() => this.poll(ref), POLL_INTERVAL_MS);
  }
}
