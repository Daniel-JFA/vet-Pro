import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { Patient, Tutor, Species, PatientStatus } from '../../../core/models';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss'
})
export class PatientListComponent implements OnInit {
  private svc = inject(PatientService);

  patients = signal<Patient[]>([]);
  loading = signal(true);
  search = signal('');
  speciesFilter = signal<Species | ''>('');
  statusFilter = signal<PatientStatus | 'all'>('all');
  page = signal(1);
  pageSize = 15;
  total = signal(0);

  speciesOptions: { value: Species | ''; label: string; icon: string }[] = [
    { value: '', label: 'Todas las especies', icon: 'pets' },
    { value: 'dog', label: 'Perros', icon: 'sound_detection_dog_barking' },
    { value: 'cat', label: 'Gatos', icon: 'cat' },
    { value: 'rabbit', label: 'Conejos', icon: 'cruelty_free' },
    { value: 'bird', label: 'Aves', icon: 'nest_gator' },
    { value: 'reptile', label: 'Reptiles', icon: 'thermostat' },
    { value: 'other', label: 'Otros', icon: 'help' }
  ];

  statusOptions: { value: PatientStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'deceased', label: 'Fallecidos' }
  ];

  filtered = computed(() => {
    let list = this.patients();
    const q = this.search().trim().toLowerCase();

    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.breed && p.breed.toLowerCase().includes(q)) ||
        (p.chipId && p.chipId.toLowerCase().includes(q)) ||
        (p.tutor && (
          p.tutor.firstName.toLowerCase().includes(q) ||
          p.tutor.lastName.toLowerCase().includes(q) ||
          p.tutor.phone.includes(q)
        ))
      );
    }

    if (this.speciesFilter()) {
      list = list.filter(p => p.species === this.speciesFilter());
    }

    if (this.statusFilter() !== 'all') {
      list = list.filter(p => p.status === this.statusFilter());
    }

    return list;
  });

  stats = computed(() => ({
    total: this.patients().length,
    dogs: this.patients().filter(p => p.species === 'dog').length,
    cats: this.patients().filter(p => p.species === 'cat').length,
    active: this.patients().filter(p => p.status === 'active').length,
  }));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getPatients({ page: this.page(), pageSize: this.pageSize }).subscribe({
      next: res => {
        this.patients.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        // En caso de error (cuando el backend no está corriendo aún), cargamos datos Mock
        this.patients.set(MOCK_PATIENTS);
        this.total.set(MOCK_PATIENTS.length);
        this.loading.set(false);
      }
    });
  }

  speciesLabel(spec: Species): string {
    switch (spec) {
      case 'dog': return 'Perro';
      case 'cat': return 'Gato';
      case 'rabbit': return 'Conejo';
      case 'bird': return 'Ave';
      case 'reptile': return 'Reptil';
      default: return 'Otro';
    }
  }

  statusLabel(status: PatientStatus): string {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'deceased': return 'Fallecido';
      default: return 'Desconocido';
    }
  }

  trackById(_: number, p: Patient) {
    return p.id;
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_TUTORS: Tutor[] = [
  { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', email: 'carlos@gmail.com', phone: '3124567890', documentId: '1018234567', address: 'Calle 100 #15-30, Bogotá', createdAt: new Date() },
  { id: 't2', clinicId: 'c1', firstName: 'María', lastName: 'Rodríguez', email: 'maria@outlook.com', phone: '3157891234', documentId: '52345678', address: 'Carrera 7 #45-12, Medellín', createdAt: new Date() },
  { id: 't3', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', email: 'diana@hotmail.com', phone: '3209876543', documentId: '1032456789', address: 'Av. El Poblado #3-45, Envigado', createdAt: new Date() },
  { id: 't4', clinicId: 'c1', firstName: 'Juan', lastName: 'Sánchez', email: 'juan@gmail.com', phone: '3001234567', documentId: '79876543', address: 'Transversal 5 #80-22, Cali', createdAt: new Date() }
];

const MOCK_PATIENTS: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTORS[0], name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, weight: 32.5, chipId: '985112003456789', photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150', status: 'active', createdAt: new Date() },
  { id: 'p2', clinicId: 'c1', tutorId: 't2', tutor: MOCK_TUTORS[1], name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, weight: 4.2, chipId: '985112003456780', photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150', status: 'active', createdAt: new Date() },
  { id: 'p3', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTORS[0], name: 'Kira', species: 'dog', breed: 'Bulldog Francés', sex: 'female', sterilized: false, weight: 11.8, chipId: '985112003456781', status: 'active', createdAt: new Date() },
  { id: 'p4', clinicId: 'c1', tutorId: 't3', tutor: MOCK_TUTORS[2], name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, weight: 2.1, status: 'active', createdAt: new Date() },
  { id: 'p5', clinicId: 'c1', tutorId: 't4', tutor: MOCK_TUTORS[3], name: 'Rocky', species: 'dog', breed: 'Pastor Alemán', sex: 'male', sterilized: true, weight: 38.0, chipId: '985112003456782', photoUrl: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&q=80&w=150', status: 'inactive', createdAt: new Date() },
  { id: 'p6', clinicId: 'c1', tutorId: 't2', tutor: MOCK_TUTORS[1], name: 'Mimi', species: 'cat', breed: 'Persa', sex: 'female', sterilized: true, weight: 3.8, status: 'active', createdAt: new Date() }
];
