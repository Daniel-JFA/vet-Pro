import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Departamento {
  code: string;
  nombre: string;
}

export interface Municipio {
  id: string;
  deptoCode: string;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private api = inject(ApiService);

  getDepartamentos(): Observable<Departamento[]> {
    return this.api.get<Departamento[]>('/geo/departamentos');
  }

  getMunicipios(deptoCode: string): Observable<Municipio[]> {
    return this.api.get<Municipio[]>('/geo/municipios', { deptoCode });
  }
}
