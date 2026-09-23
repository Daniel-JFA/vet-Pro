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
  reviews?: VetReviewItem[];
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
   * Panel Admin: Aprobar o rechazar verificación
   */
  verifyVet(id: string, body: { status: 'verified' | 'rejected'; notes?: string }): Observable<any> {
    return this.api.put<any>(`/marketplace/admin/verifications/${id}`, body);
  }
}
