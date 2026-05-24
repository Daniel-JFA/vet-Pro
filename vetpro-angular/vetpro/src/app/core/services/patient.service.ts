import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Patient, Tutor, Vaccine, MedicalRecord, PagedResult, QueryParams } from '../models';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private api = inject(ApiService);

  getPatients(params?: QueryParams): Observable<PagedResult<Patient>> {
    return this.api.getPaged<Patient>('/patients', params);
  }

  getPatient(id: string): Observable<Patient> {
    return this.api.get<Patient>(`/patients/${id}`);
  }

  createPatient(data: Partial<Patient>): Observable<Patient> {
    return this.api.post<Patient>('/patients', data);
  }

  updatePatient(id: string, data: Partial<Patient>): Observable<Patient> {
    return this.api.put<Patient>(`/patients/${id}`, data);
  }

  getMedicalHistory(patientId: string): Observable<MedicalRecord[]> {
    return this.api.get<MedicalRecord[]>(`/patients/${patientId}/medical-records`);
  }

  getMedicalRecord(id: string): Observable<MedicalRecord> {
    return this.api.get<MedicalRecord>(`/medical-records/${id}`);
  }

  createMedicalRecord(data: any): Observable<MedicalRecord> {
    return this.api.post<MedicalRecord>('/medical-records', data);
  }

  transcribeVoice(durationSeconds: number, text?: string): Observable<any> {
    return this.api.post<any>('/medical-records/transcribe', { durationSeconds, text });
  }

  getVaccines(patientId: string): Observable<Vaccine[]> {
    return this.api.get<Vaccine[]>(`/patients/${patientId}/vaccines`);
  }

  getTutors(params?: QueryParams): Observable<PagedResult<Tutor>> {
    return this.api.getPaged<Tutor>('/tutors', params);
  }

  createTutor(data: Partial<Tutor>): Observable<Tutor> {
    return this.api.post<Tutor>('/tutors', data);
  }
}
