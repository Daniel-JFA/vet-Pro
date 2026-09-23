import { Component, inject, signal, computed, OnInit } from '@angular/core';

import { RouterLink, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

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
    if (this.route.snapshot.queryParamMap.get('openImport') === 'true') {
      this.openImportModal();
    }
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

  // ─────────────────────────────────────────────
  // IMPORTACIÓN MASIVA DESDE EXCEL / CSV
  // ─────────────────────────────────────────────
  showImportModal = signal(false);
  importing = signal(false);
  importPreview = signal<any[]>([]);
  importResults = signal<{ total: number; imported: number; errors: any[] } | null>(null);
  selectedFileName = signal<string>('');

  openImportModal() {
    this.importPreview.set([]);
    this.importResults.set(null);
    this.selectedFileName.set('');
    this.showImportModal.set(true);
  }

  closeImportModal() {
    this.showImportModal.set(false);
  }

  downloadTemplate() {
    const csvContent =
      '\uFEFF' +
      'Nombre Mascota,Especie,Raza,Sexo,Peso,Nombre Tutor,Apellido Tutor,Telefono,Email,Documento,Direccion\n' +
      'Toby,perro,Golden Retriever,macho,28.5,Carlos,Gomez,3001234567,carlos@ejemplo.com,1020304050,Calle 10 # 20-30\n' +
      'Michi,gato,Siames,hembra,4.2,Ana,Martinez,3109876543,ana@ejemplo.com,987654321,Carrera 15 # 45-12\n' +
      'Copito,conejo,Mini Lop,macho,1.8,Laura,Perez,3155550199,laura@ejemplo.com,,Transversal 7 # 8-90';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_pacientes_vetpro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.selectedFileName.set(file.name);
    this.importResults.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      this.parseCsv(text);
    };
    reader.readAsText(file);
  }

  private parseCsv(content: string) {
    const lines = content
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) {
      this.toast.error('El archivo CSV debe contener una fila de encabezados y al menos una fila de datos.');
      return;
    }

    // Detectar delimitador (coma o punto y coma)
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const rawHeaders = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

    const findIndex = (aliases: string[]) =>
      rawHeaders.findIndex((h) => aliases.some((a) => h.includes(a)));

    const petNameIdx = findIndex(['mascota', 'paciente', 'nombre de mascota', 'pet']);
    const speciesIdx = findIndex(['especie', 'species', 'tipo']);
    const breedIdx = findIndex(['raza', 'breed']);
    const sexIdx = findIndex(['sexo', 'genero', 'sex']);
    const weightIdx = findIndex(['peso', 'weight']);
    const tutorNameIdx = findIndex(['nombre tutor', 'tutor', 'nombre_tutor']);
    const tutorLastIdx = findIndex(['apellido tutor', 'apellido_tutor', 'apellido']);
    const phoneIdx = findIndex(['telefono', 'teléfono', 'celular', 'phone']);
    const emailIdx = findIndex(['email', 'correo', 'mail']);
    const docIdx = findIndex(['documento', 'cedula', 'cédula', 'nit', 'doc']);
    const addrIdx = findIndex(['direccion', 'dirección', 'address']);

    const parsedItems: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(delimiter).map((col) => col.replace(/^["']|["']$/g, '').trim());
      if (row.length === 0 || row.every((c) => !c)) continue;

      const petName = petNameIdx >= 0 ? row[petNameIdx] : row[0];
      const tutorPhone = phoneIdx >= 0 ? row[phoneIdx] : '';
      const tutorName = tutorNameIdx >= 0 ? row[tutorNameIdx] : 'Tutor';

      if (!petName || !tutorPhone) continue;

      parsedItems.push({
        name: petName,
        species: speciesIdx >= 0 ? row[speciesIdx] || 'perro' : 'perro',
        breed: breedIdx >= 0 ? row[breedIdx] || null : null,
        sex: sexIdx >= 0 ? row[sexIdx] || 'macho' : 'macho',
        weight: weightIdx >= 0 && row[weightIdx] ? parseFloat(row[weightIdx].replace(',', '.')) : null,
        tutorFirstName: tutorName,
        tutorLastName: tutorLastIdx >= 0 ? row[tutorLastIdx] || '' : '',
        tutorPhone: tutorPhone,
        tutorEmail: emailIdx >= 0 ? row[emailIdx] || null : null,
        tutorDocument: docIdx >= 0 ? row[docIdx] || null : null,
        tutorAddress: addrIdx >= 0 ? row[addrIdx] || null : null,
      });
    }

    if (parsedItems.length === 0) {
      this.toast.error('No se encontraron registros válidos en el archivo. Verifica el formato de la plantilla.');
      return;
    }

    this.importPreview.set(parsedItems);
    this.toast.success(`Se leyeron ${parsedItems.length} registros listos para importar.`);
  }

  executeImport() {
    const items = this.importPreview();
    if (items.length === 0) return;

    this.importing.set(true);
    this.svc.importPatients(items).subscribe({
      next: (res) => {
        this.importing.set(false);
        this.importResults.set(res.data);
        this.toast.success(res.message);
        this.load();
      },
      error: (err) => {
        this.importing.set(false);
        this.toast.error(err?.error?.error || 'Error al ejecutar la importación masiva.');
      },
    });
  }
}
