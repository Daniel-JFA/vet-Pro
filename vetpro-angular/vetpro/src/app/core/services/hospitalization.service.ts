import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Bed {
  id: string;
  code: string;
  name: string;
  type: string;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning';
  dailyRate: number;
  notes?: string;
  branch?: { id: string; name: string };
}

export interface MedicationDose {
  id: string;
  medicationId?: string;
  timeSlot: string;
  drugName: string;
  dose: string;
  route: string;
  applied: boolean;
  appliedAt?: Date;
  appliedBy?: string;
}

export interface HospitalizedPatient {
  id: string;
  cageNumber: string;
  cageType: string;
  bedId: string;
  status: 'admitted' | 'critical' | 'stable' | 'ready_for_discharge' | 'discharged';
  patientId: string;
  patientName: string;
  patientSpecies: string;
  patientBreed: string;
  weight: number;
  tutorName: string;
  tutorPhone: string;
  admittedAt: Date;
  daysHospitalized: number;
  admissionReason: string;
  diagnosis?: string;
  fluidTherapy?: string;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  medications: MedicationDose[];
  evolutions?: any[];
}

@Injectable({ providedIn: 'root' })
export class HospitalizationService {
  private api = inject(ApiService);

  getBeds(branchId?: string): Observable<Bed[]> {
    return this.api.get<Bed[]>('/hospitalizations/beds', branchId ? { branchId } : undefined);
  }

  createBed(bed: Partial<Bed> & { branchId: string }): Observable<Bed> {
    return this.api.post<Bed>('/hospitalizations/beds', bed);
  }

  getActiveHospitalizations(branchId?: string): Observable<HospitalizedPatient[]> {
    return this.api.get<HospitalizedPatient[]>('/hospitalizations/active', branchId ? { branchId } : undefined);
  }

  admitPatient(data: {
    patientId: string;
    branchId: string;
    bedId: string;
    admissionReason: string;
    diagnosis?: string;
    fluidTherapy?: string;
    dailyRate?: number;
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    medications?: any[];
  }): Observable<any> {
    return this.api.post('/hospitalizations/admit', data);
  }

  addEvolution(hospId: string, data: {
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    capillaryRefillTime?: number;
    bloodGlucose?: number;
    fluidTherapyRate?: string;
    notes: string;
  }): Observable<any> {
    return this.api.post(`/hospitalizations/${hospId}/evolutions`, data);
  }

  addMedication(hospId: string, data: {
    drugName: string;
    dose: string;
    route: string;
    frequencyHours: number;
    timeSlots: string[];
    productId?: string;
    instructions?: string;
  }): Observable<any> {
    return this.api.post(`/hospitalizations/${hospId}/medications`, data);
  }

  administerDose(hospId: string, data: {
    medicationId: string;
    timeSlot: string;
    notes?: string;
    deductStock?: boolean;
  }): Observable<{ success: boolean; dose: any }> {
    return this.api.post(`/hospitalizations/${hospId}/doses/administer`, data);
  }

  dischargePatient(hospId: string, data: {
    dischargeSummary: string;
  }): Observable<any> {
    return this.api.post(`/hospitalizations/${hospId}/discharge`, data);
  }
}
