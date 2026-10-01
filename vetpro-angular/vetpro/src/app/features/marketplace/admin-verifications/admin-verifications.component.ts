import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MarketplaceService } from '../../../core/services/marketplace.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-verifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-verifications.component.html',
  styleUrls: ['./admin-verifications.component.scss']
})
export class AdminVerificationsComponent implements OnInit {
  private marketplaceService = inject(MarketplaceService);
  private toast = inject(ToastService);
  platformAuth = inject(PlatformAuthService);

  // 'platform': equipo VetPro, todas las clínicas, puede aprobar/rechazar/destacar.
  // 'clinic': la clínica ve solo el estado de sus veterinarios.
  readonly mode: 'platform' | 'clinic' = inject(ActivatedRoute).snapshot.data['mode'] === 'platform' ? 'platform' : 'clinic';
  readonly canManage = this.mode === 'platform';

  loading = signal<boolean>(true);
  profiles = signal<any[]>([]);
  filterStatus = signal<string>('all');

  // Modal de acción
  selectedProfile = signal<any | null>(null);
  actionType = signal<'verify' | 'reject'>('verify');
  notes = '';
  submitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadVerifications();
  }

  loadVerifications(): void {
    this.loading.set(true);
    const source$ =
      this.mode === 'platform' ? this.platformAuth.getVerifications() : this.marketplaceService.getAdminVerifications();
    source$.subscribe({
      next: (data) => {
        this.profiles.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error al cargar la lista de verificaciones');
        this.loading.set(false);
      }
    });
  }

  get filteredProfiles(): any[] {
    const list = this.profiles();
    const status = this.filterStatus();
    if (status === 'all') return list;
    return list.filter((p) => p.verificationStatus === status);
  }

  copyToClipboard(text: string, label: string = 'Texto'): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success(`${label} copiado al portapapeles`);
    });
  }

  openActionModal(profile: any, type: 'verify' | 'reject'): void {
    this.selectedProfile.set(profile);
    this.actionType.set(type);
    this.notes =
      type === 'verify'
        ? 'Tarjeta profesional COMVEZCOL validada exitosamente en el registro nacional.'
        : 'Inconsistencia en datos de tarjeta profesional o sin registro vigente ante COMVEZCOL.';
  }

  closeActionModal(): void {
    this.selectedProfile.set(null);
  }

  submitAction(): void {
    const p = this.selectedProfile();
    if (!p) return;

    this.submitting.set(true);
    const newStatus = this.actionType() === 'verify' ? 'verified' : 'rejected';

    this.platformAuth
      .updateVerification(p.id, {
        status: newStatus,
        notes: this.notes
      })
      .subscribe({
        next: () => {
          this.toast.success(
            newStatus === 'verified'
              ? 'Veterinario verificado y activado con éxito'
              : 'Verificación rechazada'
          );
          this.submitting.set(false);
          this.closeActionModal();
          this.loadVerifications();
        },
        error: (err) => {
          this.toast.error(err.error?.error || 'Error al procesar la verificación');
          this.submitting.set(false);
        }
      });
  }

  toggleFeatured(profile: any): void {
    const newFeatured = !profile.isFeatured;
    this.platformAuth.updateVerification(profile.id, { isFeatured: newFeatured }).subscribe({
      next: () => {
        this.toast.success(
          newFeatured
            ? 'Veterinario destacado como Vet Pro ⭐ en el directorio'
            : 'Veterinario configurado con visibilidad estándar'
        );
        profile.isFeatured = newFeatured;
      },
      error: () => this.toast.error('Error al cambiar estado destacado')
    });
  }
}
