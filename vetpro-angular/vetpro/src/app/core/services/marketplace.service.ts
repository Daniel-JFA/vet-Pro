import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface PublicVetItem {
  id: string;
  professionalCard?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  specialties: string[];
  bio?: string;
  modalities: string[];
  consultationPrice: number;
  homeVisitPrice?: number | null;
  city?: string;
  coverageZones: string[];
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  whatsappNumber?: string;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  clinic: {
    name: string;
    city?: string;
  };
}

export interface VetReviewItem {
  id: string;
  tutorName: string;
  rating: number;
  comment: string;
  serviceType?: string;
  createdAt: string;
}

export interface PublicVetDetail extends PublicVetItem {
  createdAt: string;
  isPublic: boolean;
  reviews: VetReviewItem[];
}

export interface MyVetProfile {
  id: string;
  userId: string;
  clinicId: string;
  professionalCard?: string;
  cardDocumentUrl?: string;
  idDocumentUrl?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
  specialties: string[];
  bio?: string;
  modalities: string[];
  consultationPrice: number;
  homeVisitPrice?: number | null;
  city?: string;
  coverageZones: string[];
  rating: number;
  reviewCount: number;
  isPublic: boolean;
  isFeatured: boolean;
  whatsappNumber?: string;
  payoutBank?: string | null;
  payoutAccount?: string | null;
  reviews?: VetReviewItem[];
}

export interface VetEarningsSummary {
  totalAppointments: number;
  completedAppointments: number;
  grossRevenue: number;
  platformFeeRate: number;
  platformFee: number;
  netEarnings: number;
  payoutBank?: string | null;
  payoutAccount?: string | null;
  appointments: {
    id: string;
    scheduledAt: string;
    status: string;
    modality: string;
    amount: number;
    patientName: string;
    species: string;
    tutorName: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /**
   * Obtener listado público de veterinarios verificados con filtros
   */
  getPublicVets(params?: {
    city?: string;
    specialty?: string;
    modality?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<{ data: PublicVetItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.api.get<{ data: PublicVetItem[]; pagination: any }>('/marketplace/vets', params as any);
  }

  /**
   * Obtener detalle público de un veterinario y sus reseñas
   */
  getPublicVetDetail(id: string): Observable<PublicVetDetail> {
    return this.api.get<PublicVetDetail>(`/marketplace/vets/${id}`);
  }

  /**
   * Agregar reseña y calificación a un veterinario
   */
  addReview(
    vetProfileId: string,
    review: { tutorName: string; rating: number; comment: string; serviceType?: string }
  ): Observable<{ review: VetReviewItem; newRating: number; newCount: number }> {
    return this.api.post<{ review: VetReviewItem; newRating: number; newCount: number }>(
      `/marketplace/vets/${vetProfileId}/reviews`,
      review
    );
  }

  /**
   * Agendar cita web con un veterinario y generar enlace WhatsApp estructurado
   */
  bookAppointment(
    vetProfileId: string,
    bookingData: {
      tutorName: string;
      tutorPhone: string;
      tutorEmail?: string;
      patientName: string;
      patientSpecies: string;
      modality: 'home_visit' | 'clinic';
      scheduledAt: string;
      address?: string;
      city?: string;
      reason: string;
      notes?: string;
    }
  ): Observable<{
    success: boolean;
    appointmentId: string;
    reservationCode: string;
    patientId: string;
    patientName: string;
    tutorName: string;
    scheduledAt: string;
    amountCharged: number;
    modality: string;
    whatsappUrl: string;
    vetName: string;
  }> {
    return this.api.post(`/marketplace/vets/${vetProfileId}/appointments`, bookingData);
  }

  /**
   * Obtener mi propio perfil de veterinario (Autenticado)
   */
  getMyProfile(): Observable<MyVetProfile> {
    return this.api.get<MyVetProfile>('/marketplace/profile/me');
  }

  /**
   * Actualizar datos de mi perfil de veterinario
   */
  updateMyProfile(data: Partial<MyVetProfile>): Observable<MyVetProfile> {
    return this.api.put<MyVetProfile>('/marketplace/profile/me', data);
  }

  /**
   * Subir documentos de verificación COMVEZCOL y cédula
   */
  uploadDocuments(formData: FormData): Observable<{ message: string; profile: MyVetProfile }> {
    return this.http.post<{ message: string; profile: MyVetProfile }>(
      `${this.base}/marketplace/profile/documents`,
      formData
    );
  }

  /**
   * Panel Admin: Listar solicitudes de verificación
   */
  getAdminVerifications(): Observable<any[]> {
    return this.api.get<any[]>('/marketplace/admin/verifications');
  }

  /**
   * Panel Admin: Aprobar o rechazar verificación, o destacar perfil
   */
  verifyVet(id: string, body: { status?: 'verified' | 'rejected' | 'pending'; notes?: string; isFeatured?: boolean }): Observable<any> {
    return this.api.put<any>(`/marketplace/admin/verifications/${id}`, body);
  }

  /**
   * Consultar balance de ingresos y comisiones del veterinario
   */
  getEarnings(): Observable<VetEarningsSummary> {
    return this.api.get<VetEarningsSummary>('/marketplace/profile/earnings');
  }

  /**
   * Generar sesión de pago Wompi para una cita médica
   */
  getAppointmentCheckout(appointmentId: string): Observable<WompiCheckoutData> {
    return this.api.post<WompiCheckoutData>(`/marketplace/appointments/${appointmentId}/checkout`, {});
  }

  /**
   * Simular pago instantáneo en Sandbox / Dev
   */
  simulateMockPayment(reference: string, status: 'APPROVED' | 'DECLINED' = 'APPROVED', paymentMethod: string = 'CARD'): Observable<any> {
    return this.api.post<any>('/marketplace/payments/mock-simulate', { reference, status, paymentMethod });
  }

  /**
   * Obtener comprobante digital (Voucher) de una cita
   */
  getAppointmentVoucher(appointmentId: string): Observable<AppointmentVoucherData> {
    return this.api.get<AppointmentVoucherData>(`/marketplace/appointments/${appointmentId}/voucher`);
  }

  /**
   * Consultar estado de membresía Pro Vet ⭐
   */
  getSubscriptionStatus(): Observable<ProVetSubscriptionStatus> {
    return this.api.get<ProVetSubscriptionStatus>('/marketplace/profile/subscription');
  }

  /**
   * Suscribirse o activar membresía Pro Vet ⭐ ($49.000 COP / mes)
   */
  subscribeProVet(instantActivate: boolean = true): Observable<any> {
    return this.api.post<any>('/marketplace/profile/subscription', { instantActivate });
  }
}

export interface WompiCheckoutData {
  paymentId: string;
  publicKey: string;
  currency: string;
  amountInCents: number;
  amount: number;
  platformFee: number;
  vetAmount: number;
  reference: string;
  signatureIntegrity: string;
  redirectUrl: string;
  customerData: {
    email?: string;
    fullName?: string;
    phoneNumber?: string;
  };
  appointment: {
    id: string;
    reservationCode: string;
    scheduledAt: string;
    serviceType: string;
    modality: string;
    patientName: string;
    vetName: string;
    clinicName: string;
  };
}

export interface AppointmentVoucherData {
  voucherId: string;
  reservationCode: string;
  appointmentId: string;
  scheduledAt: string;
  status: string;
  modality: string;
  serviceType: string;
  reason: string;
  notes?: string;
  address?: string;
  city?: string;
  pricing: {
    totalAmount: number;
    platformFee: number;
    netVetAmount: number;
    currency: string;
    paymentStatus: string;
    paymentMethod: string;
    paymentReference?: string;
    paidAt?: string;
  };
  patient: {
    id?: string;
    name: string;
    species: string;
    breed?: string;
  };
  tutor: {
    name: string;
    phone: string;
    email?: string;
    documentId?: string;
    address?: string;
  };
  vet: {
    name: string;
    phone?: string;
    professionalCard?: string;
    specialties: string[];
    isFeatured: boolean;
  };
  clinic: {
    name: string;
    nit?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
  };
  security: {
    voucherHash: string;
    issuedAt: string;
    verificationUrl: string;
  };
}

export interface ProVetSubscriptionStatus {
  isFeatured: boolean;
  subscriptionStatus: string;
  subscriptionExpiresAt?: string;
  isActive: boolean;
  pricePerMonth: number;
  currency: string;
  payments: any[];
}

