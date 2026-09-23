import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketplaceService, PublicVetItem, PublicVetDetail } from '../../../core/services/marketplace.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-vet-directory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vet-directory.component.html',
  styleUrls: ['./vet-directory.component.scss']
})
export class VetDirectoryComponent implements OnInit {
  private marketplaceService = inject(MarketplaceService);
  private toast = inject(ToastService);

  vets = signal<PublicVetItem[]>([]);
  loading = signal<boolean>(true);
  totalVets = signal<number>(0);

  // Filtros
  searchTerm = '';
  selectedCity = '';
  selectedSpecialty = '';
  selectedModality = '';

  // Modal de Detalle
  selectedVet = signal<PublicVetDetail | null>(null);
  loadingDetail = signal<boolean>(false);
  showDetailModal = signal<boolean>(false);

  // Formulario de Reseña
  newReview = {
    tutorName: '',
    rating: 5,
    comment: '',
    serviceType: 'Consulta General'
  };
  submittingReview = signal<boolean>(false);

  // Ciudades y Especialidades comunes
  cities = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena', 'Pereira', 'Manizales'];
  specialties = [
    'Medicina General',
    'Medicina Felina',
    'Dermatología',
    'Cirugía',
    'Odontología',
    'Cardiología',
    'Oftalmología',
    'Nutrición y Dietética'
  ];

  ngOnInit(): void {
    this.loadVets();
  }

  loadVets(): void {
    this.loading.set(true);
    this.marketplaceService
      .getPublicVets({
        city: this.selectedCity || undefined,
        specialty: this.selectedSpecialty || undefined,
        modality: this.selectedModality || undefined,
        search: this.searchTerm || undefined,
        limit: 20
      })
      .subscribe({
        next: (res) => {
          this.vets.set(res.data);
          this.totalVets.set(res.pagination.total);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('Error al cargar el directorio de veterinarios');
          this.loading.set(false);
        }
      });
  }

  onFilterChange(): void {
    this.loadVets();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCity = '';
    this.selectedSpecialty = '';
    this.selectedModality = '';
    this.loadVets();
  }

  openDetail(vet: PublicVetItem): void {
    this.loadingDetail.set(true);
    this.showDetailModal.set(true);
    this.marketplaceService.getPublicVetDetail(vet.id).subscribe({
      next: (detail) => {
        this.selectedVet.set(detail);
        this.loadingDetail.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar el perfil detallado');
        this.loadingDetail.set(false);
        this.showDetailModal.set(false);
      }
    });
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedVet.set(null);
  }

  getWhatsAppLink(vet: PublicVetItem | PublicVetDetail): string {
    const rawNumber = vet.whatsappNumber || '573001234567';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const vetName = `${vet.user.firstName} ${vet.user.lastName}`;
    const message = encodeURIComponent(
      `¡Hola Dr(a). ${vetName}! Vi su perfil verificado en VetPro y me gustaría consultar disponibilidad para agendar una cita con mi mascota.`
    );
    return `https://wa.me/${cleanNumber}?text=${message}`;
  }

  submitReview(): void {
    const vet = this.selectedVet();
    if (!vet) return;

    if (!this.newReview.tutorName.trim() || !this.newReview.comment.trim()) {
      this.toast.error('Por favor escribe tu nombre y tu comentario.');
      return;
    }

    this.submittingReview.set(true);
    this.marketplaceService
      .addReview(vet.id, {
        tutorName: this.newReview.tutorName,
        rating: this.newReview.rating,
        comment: this.newReview.comment,
        serviceType: this.newReview.serviceType
      })
      .subscribe({
        next: (res) => {
          this.toast.success('¡Gracias por calificar el servicio!');
          this.submittingReview.set(false);
          // Actualizar detalle localmente
          const current = this.selectedVet();
          if (current) {
            this.selectedVet.set({
              ...current,
              rating: res.newRating,
              reviewCount: res.newCount,
              reviews: [res.review, ...current.reviews]
            });
          }
          // Limpiar form
          this.newReview.comment = '';
          this.newReview.tutorName = '';
          this.newReview.rating = 5;
          // Actualizar lista
          this.loadVets();
        },
        error: (err) => {
          this.toast.error(err.error?.error || 'Error al enviar la calificación');
          this.submittingReview.set(false);
        }
      });
  }
}
