import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PortalPatient {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'reptile' | 'other';
  breed?: string;
  birthDate?: string;
  sex: 'male' | 'female';
  sterilized: boolean;
  weight?: number;
  chipId?: string;
  photoUrl?: string;
  allergies?: string;
  notes?: string;
  status: string;
}

export interface MedicalRecordItem {
  id: string;
  title: string;
  type: string;
  anamnesis?: string;
  physicalExam?: string;
  diagnosis?: string;
  treatment?: string;
  observations?: string;
  createdAt: string;
  vet: {
    firstName: string;
    lastName: string;
  };
}

export interface VaccineItem {
  id: string;
  name: string;
  brand?: string;
  batch?: string;
  appliedAt: string;
  nextDueAt?: string;
  notes?: string;
  vet: {
    firstName: string;
    lastName: string;
  };
}

export interface PatientHistoryResponse {
  patient: PortalPatient;
  medicalRecords: MedicalRecordItem[];
  vaccines: VaccineItem[];
}

@Injectable({ providedIn: 'root' })
export class TutorPortalService {
  private api = inject(ApiService);

  // Obtener todas las mascotas del tutor logueado
  getPatients(): Observable<PortalPatient[]> {
    return this.api.get<PortalPatient[]>('/portal/patients');
  }

  // Obtener historial médico y vacunas de una mascota
  getPatientHistory(patientId: string): Observable<PatientHistoryResponse> {
    return this.api.get<PatientHistoryResponse>(`/portal/patients/${patientId}/history`);
  }

  // Obtener veterinarios de la clínica
  getVets(): Observable<any[]> {
    return this.api.get<any[]>('/portal/booking/vets');
  }

  // Reservar una nueva cita
  bookAppointment(data: {
    patientId: string;
    vetId: string;
    serviceType: string;
    scheduledAt: string;
    reason?: string;
  }): Observable<any> {
    return this.api.post<any>('/portal/booking', data);
  }
}
