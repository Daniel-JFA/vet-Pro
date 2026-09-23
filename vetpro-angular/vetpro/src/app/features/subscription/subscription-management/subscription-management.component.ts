import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService, ClinicSubscriptionInfo, CheckoutResponse } from '../../../core/services/subscription.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-management.component.html',
  styleUrl: './subscription-management.component.scss'
})
export class SubscriptionManagementComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private toast = inject(ToastService);

  loading = signal(true);
  checkoutLoading = signal(false);
  simulatingLoading = signal(false);

  info = signal<ClinicSubscriptionInfo | null>(null);
  selectedCycle = signal<'monthly' | 'annual'>('monthly');

  // Modal de Pago
  showCheckoutModal = signal(false);
  currentCheckout = signal<CheckoutResponse | null>(null);

  // Planes disponibles con precios base
  plans = [
    {
      id: 'starter',
      name: 'Plan Starter',
      subtitle: 'Para consultorios y veterinarios independientes',
      monthlyPrice: 80000,
      annualPrice: 816000,
      features: [
        '1 Veterinario / 1 Usuario simultáneo',
        'Pacientes, tutores y citas ilimitadas',
        '60 minutos de Bitácora IA al mes',
        'Facturación local y arqueo de caja POS',
        'Directorio Marketplace de especialistas'
      ]
    },
    {
      id: 'pro',
      name: 'Plan Pro',
      subtitle: 'La solución completa para clínicas en crecimiento',
      popular: true,
      monthlyPrice: 150000,
      annualPrice: 1530000,
      features: [
        'Hasta 5 Veterinarios y recepción',
        'Gestión de hasta 2 Sedes',
        '300 minutos de Bitácora IA al mes',
        'Peluquería, Estética Canina & Grooming',
        'Hospitalización, Camas UCI y Kardex clínico',
        'Recordatorios automáticos por WhatsApp',
        'CRM de Reactivación de Pacientes'
      ]
    },
    {
      id: 'enterprise',
      name: 'Plan Enterprise',
      subtitle: 'Para hospitales veterinarios y cadenas multi-sede',
      monthlyPrice: 300000,
      annualPrice: 3060000,
      features: [
        'Veterinarios y usuarios ilimitados',
        'Sedes y sucursales ilimitadas',
        'Bitácora IA ilimitada (9.999 min/mes)',
        'Módulo oficial Facturación Electrónica DIAN',
        'Panel de administración y exportes masivos',
        'Soporte prioritario 24/7 y SLA garantizado'
      ]
    }
  ];

  clinicPlan = computed(() => this.info()?.clinic.plan || 'starter');
  subscriptionStatus = computed(() => this.info()?.clinic.subscriptionStatus || 'trial');
  daysRemaining = computed(() => this.info()?.clinic.daysRemaining || 0);

  ngOnInit() {
    this.loadSubscription();
  }

  loadSubscription() {
    this.loading.set(true);
    this.subscriptionService.getCurrentSubscription().subscribe({
      next: (res) => {
        this.info.set(res);
        this.selectedCycle.set(res.clinic.billingCycle || 'monthly');
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar la información de suscripción.');
      }
    });
  }

  selectPlan(planId: string) {
    this.checkoutLoading.set(true);
    this.subscriptionService.initiateCheckout(planId, this.selectedCycle()).subscribe({
      next: (checkout) => {
        this.currentCheckout.set(checkout);
        this.checkoutLoading.set(false);
        this.showCheckoutModal.set(true);
      },
      error: (err) => {
        this.checkoutLoading.set(false);
        this.toast.error(err.error?.error || 'Error al iniciar el checkout de suscripción.');
      }
    });
  }

  closeModal() {
    this.showCheckoutModal.set(false);
    this.currentCheckout.set(null);
  }

  openWompiWidget() {
    const checkout = this.currentCheckout();
    if (!checkout) return;

    // Si Wompi Checkout script está en window, o abrir URL directa
    const checkoutUrl = `https://checkout.wompi.co/p/?public-key=${checkout.publicKey}&currency=${checkout.currency}&amount-in-cents=${checkout.amountInCents}&reference=${checkout.reference}&signature:integrity=${checkout.signature}&redirect-url=${encodeURIComponent(checkout.redirectUrl)}`;
    window.open(checkoutUrl, '_blank');
  }

  simulateApproval() {
    const checkout = this.currentCheckout();
    if (!checkout) return;

    this.simulatingLoading.set(true);
    this.subscriptionService.simulateApproval(checkout.reference).subscribe({
      next: (res) => {
        this.simulatingLoading.set(false);
        this.toast.success(`¡Suscripción activada con éxito! Disfruta de tu ${res.plan.toUpperCase()}.`);
        this.closeModal();
        this.loadSubscription();
      },
      error: () => {
        this.simulatingLoading.set(false);
        this.toast.error('Error al simular la aprobación del pago.');
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active': return 'badge-active';
      case 'trial': return 'badge-trial';
      case 'past_due': return 'badge-warning';
      case 'suspended': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Suscripción Activa';
      case 'trial': return 'Período de Prueba (Gratuito)';
      case 'past_due': return 'Período de Gracia (Por Vencer)';
      case 'suspended': return 'Suscripción Suspendida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  }
}
