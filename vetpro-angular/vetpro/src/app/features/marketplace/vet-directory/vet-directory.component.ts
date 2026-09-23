import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

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

  // Modal de Agendamiento Web Ágil
  showBookingModal = signal<boolean>(false);
  bookingVet = signal<PublicVetItem | null>(null);
  bookingSubmitting = signal<boolean>(false);
  bookingSuccess = signal<any | null>(null);

  bookingForm = {
    tutorName: '',
    tutorPhone: '',
    tutorEmail: '',
    patientName: '',
    patientSpecies: 'dog',
    modality: 'home_visit' as 'home_visit' | 'clinic',
    date: '',
    time: '10:00',
    address: '',
    reason: '',
    notes: ''
  };

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
    // Fecha sugerida: Mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.bookingForm.date = tomorrow.toISOString().split('T')[0];

    this.loadVets();
    this.checkQueryParams();
  }

  checkQueryParams(): void {
    this.route.queryParams.subscribe((params) => {
      const reviewVetId = params['reviewVet'];
      if (reviewVetId) {
        this.marketplaceService.getPublicVetDetail(reviewVetId).subscribe({
          next: (detail) => {
            this.selectedVet.set(detail);
            this.showDetailModal.set(true);
          }
        });
      }
    });
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

  // ─────────────────────────────────────────────
  // Agendamiento Web Ágil (Sprint 7)
  // ─────────────────────────────────────────────
  openBooking(vet: PublicVetItem, defaultModality?: 'home_visit' | 'clinic'): void {
    this.bookingVet.set(vet);
    this.bookingSuccess.set(null);
    if (defaultModality) {
      this.bookingForm.modality = defaultModality;
    } else {
      this.bookingForm.modality = vet.modalities.includes('home_visit') || vet.modalities.includes('domicilio')
        ? 'home_visit'
        : 'clinic';
    }
    this.showBookingModal.set(true);
  }

  closeBooking(): void {
    this.showBookingModal.set(false);
    this.bookingVet.set(null);
    this.bookingSuccess.set(null);
  }

  submitBooking(): void {
    const vet = this.bookingVet();
    if (!vet) return;

    if (!this.bookingForm.tutorName.trim() || !this.bookingForm.tutorPhone.trim()) {
      this.toast.error('Por favor ingresa tu nombre y teléfono de contacto');
      return;
    }

    if (!this.bookingForm.patientName.trim()) {
      this.toast.error('Por favor ingresa el nombre de tu mascota');
      return;
    }

    if (!this.bookingForm.reason.trim()) {
      this.toast.error('Por favor escribe el motivo de la consulta');
      return;
    }

    const scheduledAt = `${this.bookingForm.date}T${this.bookingForm.time || '10:00'}:00.000Z`;

    this.bookingSubmitting.set(true);
    this.marketplaceService
      .bookAppointment(vet.id, {
        tutorName: this.bookingForm.tutorName,
        tutorPhone: this.bookingForm.tutorPhone,
        tutorEmail: this.bookingForm.tutorEmail || undefined,
        patientName: this.bookingForm.patientName,
        patientSpecies: this.bookingForm.patientSpecies,
        modality: this.bookingForm.modality,
        scheduledAt,
        address: this.bookingForm.address || undefined,
        city: vet.city || undefined,
        reason: this.bookingForm.reason,
        notes: this.bookingForm.notes || undefined
      })
      .subscribe({
        next: (result) => {
          this.toast.success('¡Cita solicitada con éxito!');
          this.bookingSuccess.set(result);
          this.bookingSubmitting.set(false);
        },
        error: (err) => {
          this.toast.error(err.error?.error || 'Error al agendar la cita');
          this.bookingSubmitting.set(false);
        }
      });
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
