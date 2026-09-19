import { Component, inject, signal, computed, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient, Species, PatientStatus } from '../../../core/models';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './patient-list.component.html',
  styleUrl: './patient-list.component.scss',
})
export class PatientListComponent implements OnInit {
  private svc = inject(PatientService);
  private toast = inject(ToastService);

  patients = signal<Patient[]>([]);
  loading = signal(true);
  loadError = signal(false);
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
    { value: 'horse', label: 'Caballos', icon: 'pets' },
    { value: 'cow', label: 'Vacas', icon: 'agriculture' },
    { value: 'pig', label: 'Cerdos', icon: 'pets' },
    { value: 'other', label: 'Otros', icon: 'help' },
  ];

  statusOptions: { value: PatientStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'deceased', label: 'Fallecidos' },
  ];

  filtered = computed(() => {
    let list = this.patients();
    const q = this.search().trim().toLowerCase();

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.breed && p.breed.toLowerCase().includes(q)) ||
          (p.chipId && p.chipId.toLowerCase().includes(q)) ||
          (p.tutor &&
            (p.tutor.firstName.toLowerCase().includes(q) ||
              p.tutor.lastName.toLowerCase().includes(q) ||
              p.tutor.phone.includes(q))),
      );
    }

    if (this.speciesFilter()) {
      list = list.filter((p) => p.species === this.speciesFilter());
    }

    if (this.statusFilter() !== 'all') {
      list = list.filter((p) => p.status === this.statusFilter());
    }

    return list;
  });

  stats = computed(() => ({
    total: this.patients().length,
    dogs: this.patients().filter((p) => p.species === 'dog').length,
    cats: this.patients().filter((p) => p.species === 'cat').length,
    active: this.patients().filter((p) => p.status === 'active').length,
  }));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.svc.getPatients({ page: this.page(), pageSize: this.pageSize }).subscribe({
      next: (res) => {
        this.patients.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.toast.error(
          'No se pudo cargar el listado de pacientes. Verifique su conexión e intente de nuevo.',
        );
      },
    });
  }

  speciesLabel(spec: Species): string {
    switch (spec) {
      case 'dog':
        return 'Perro';
      case 'cat':
        return 'Gato';
      case 'rabbit':
        return 'Conejo';
      case 'bird':
        return 'Ave';
      case 'reptile':
        return 'Reptil';
      default:
        return 'Otro';
    }
  }

  statusLabel(status: PatientStatus): string {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'inactive':
        return 'Inactivo';
      case 'deceased':
        return 'Fallecido';
      default:
        return 'Desconocido';
    }
  }

  trackById(_: number, p: Patient) {
    return p.id;
  }
}
