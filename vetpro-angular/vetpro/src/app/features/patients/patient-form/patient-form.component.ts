import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { Patient, Tutor, Species, PatientStatus } from '../../../core/models';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.scss'
})
export class PatientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(PatientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  patientId = signal<string | null>(null);
  loading = signal(false);
  submitting = signal(false);

  // Modo de asignación de tutor: 'select' (existente) o 'new' (crear nuevo en línea)
  tutorMode = signal<'select' | 'new'>('select');

  // Listado de tutores para el selector
  tutors = signal<Tutor[]>([]);

  // Formulario principal (Mascota)
  form!: FormGroup;

  // Formulario de nuevo tutor
  tutorForm!: FormGroup;

  speciesOptions: { value: Species; label: string }[] = [
    { value: 'dog', label: 'Perro' },
    { value: 'cat', label: 'Gato' },
    { value: 'rabbit', label: 'Conejo' },
    { value: 'bird', label: 'Ave' },
    { value: 'reptile', label: 'Reptil' },
    { value: 'horse', label: 'Caballo' },
    { value: 'cow', label: 'Vaca' },
    { value: 'pig', label: 'Cerdo' },
    { value: 'other', label: 'Otro' }
  ];

  statusOptions: { value: PatientStatus; label: string }[] = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'deceased', label: 'Fallecido' }
  ];

  // Simulación de carga de foto
  previewPhotoUrl = signal<string | null>(null);

  ngOnInit() {
    this.initForms();
    this.loadTutors();

    // Comprobar si estamos en modo edición
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.patientId.set(id);
      this.loadPatient(id);
    }
  }

  private initForms() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      species: ['dog', Validators.required],
      breed: [''],
      birthDate: [''],
      sex: ['male', Validators.required],
      sterilized: [false],
      weight: [null, [Validators.min(0)]],
      chipId: [''],
      photoUrl: [''],
      allergies: [''],
      notes: [''],
      status: ['active', Validators.required],
      tutorId: ['', Validators.required]
    });

    this.tutorForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+() -]+$/)]],
      documentId: [''],
      address: [''],
      notes: ['']
    });  }

  setTutorMode(mode: 'select' | 'new') {
    this.tutorMode.set(mode);
    const tutorIdCtrl = this.form.get('tutorId');
    if (mode === 'select') {
      tutorIdCtrl?.setValidators([Validators.required]);
    } else {
      tutorIdCtrl?.clearValidators();
    }
    tutorIdCtrl?.updateValueAndValidity();
  }


  private loadTutors() {
    this.svc.getTutors().subscribe({
      next: res => {
        this.tutors.set(res.data);
      },
      error: () => {
        // Fallback mock data para tutores
        this.tutors.set(MOCK_TUTORS_FORM);
      }
    });
  }

  private loadPatient(id: string) {
    this.loading.set(true);
    this.svc.getPatient(id).subscribe({
      next: p => {
        this.fillForm(p);
        this.loading.set(false);
      },
      error: () => {
        // Fallback mock en caso de edición sin backend
        const mockP = MOCK_PATIENTS_FORM.find(p => p.id === id);
        if (mockP) {
          this.fillForm(mockP);
        }
        this.loading.set(false);
      }
    });
  }

  private fillForm(p: Patient) {
    this.form.patchValue({
      name: p.name,
      species: p.species,
      breed: p.breed,
      birthDate: p.birthDate ? new Date(p.birthDate).toISOString().substring(0, 10) : '',
      sex: p.sex,
      sterilized: p.sterilized,
      weight: p.weight,
      chipId: p.chipId,
      photoUrl: p.photoUrl,
      allergies: p.allergies,
      notes: p.notes,
      status: p.status,
      tutorId: p.tutorId
    });
    this.previewPhotoUrl.set(p.photoUrl || null);
  }

  // Simular la carga de foto de mascota (elige una foto aleatoria premium según la especie)
  simulatePhotoUpload() {
    const spec = this.form.get('species')?.value as Species;
    let url = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200'; // perro default
    if (spec === 'cat') {
      url = 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&q=80&w=200';
    } else if (spec === 'rabbit') {
      url = 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=200';
    } else if (spec === 'bird') {
      url = 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&q=80&w=200';
    }
    this.form.patchValue({ photoUrl: url });
    this.previewPhotoUrl.set(url);
  }

  removePhoto() {
    this.form.patchValue({ photoUrl: '' });
    this.previewPhotoUrl.set(null);
  }

  submit() {
    if (this.form.invalid && this.tutorMode() === 'select') {
      this.markAllAsTouched(this.form);
      return;
    }
    if (this.tutorMode() === 'new' && (this.tutorForm.invalid || this.form.get('name')?.invalid || this.form.get('species')?.invalid)) {
      this.markAllAsTouched(this.form);
      this.markAllAsTouched(this.tutorForm);
      return;
    }

    this.submitting.set(true);

    const patientData = { ...this.form.value };

    // Si se crea un tutor nuevo inline, primero simulamos guardarlo
    if (this.tutorMode() === 'new') {
      const newTutor: Tutor = {
        id: 't_new_' + Math.random().toString(36).substr(2, 9),
        clinicId: 'c1',
        ...this.tutorForm.value,
        createdAt: new Date()
      };
      patientData.tutorId = newTutor.id;
      patientData.tutor = newTutor;
    }

    if (this.isEditMode()) {
      this.svc.updatePatient(this.patientId()!, patientData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/patients']);
        },
        error: () => {
          // Fallback de éxito local offline
          this.submitting.set(false);
          this.router.navigate(['/patients']);
        }
      });
    } else {
      this.svc.createPatient(patientData).subscribe({
        next: () => {
          this.submitting.set(false);
          this.router.navigate(['/patients']);
        },
        error: () => {
          // Fallback de éxito local offline
          this.submitting.set(false);
          this.router.navigate(['/patients']);
        }
      });
    }
  }

  private markAllAsTouched(fg: FormGroup) {
    Object.values(fg.controls).forEach(control => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markAllAsTouched(control as FormGroup);
      }
    });
  }
}

// ── MOCK DATA ─────────────────────────────────

const MOCK_TUTORS_FORM: Tutor[] = [
  { id: 't1', clinicId: 'c1', firstName: 'Carlos', lastName: 'Gómez', email: 'carlos@gmail.com', phone: '3124567890', documentId: '1018234567', address: 'Calle 100 #15-30, Bogotá', createdAt: new Date() },
  { id: 't2', clinicId: 'c1', firstName: 'María', lastName: 'Rodríguez', email: 'maria@outlook.com', phone: '3157891234', documentId: '52345678', address: 'Carrera 7 #45-12, Medellín', createdAt: new Date() },
  { id: 't3', clinicId: 'c1', firstName: 'Diana', lastName: 'Pérez', email: 'diana@hotmail.com', phone: '3209876543', documentId: '1032456789', address: 'Av. El Poblado #3-45, Envigado', createdAt: new Date() },
  { id: 't4', clinicId: 'c1', firstName: 'Juan', lastName: 'Sánchez', email: 'juan@gmail.com', phone: '3001234567', documentId: '79876543', address: 'Transversal 5 #80-22, Cali', createdAt: new Date() }
];

const MOCK_PATIENTS_FORM: Patient[] = [
  { id: 'p1', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTORS_FORM[0], name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, weight: 32.5, chipId: '985112003456789', photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150', status: 'active', createdAt: new Date() },
  { id: 'p2', clinicId: 'c1', tutorId: 't2', tutor: MOCK_TUTORS_FORM[1], name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, weight: 4.2, chipId: '985112003456780', photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150', status: 'active', createdAt: new Date() },
  { id: 'p3', clinicId: 'c1', tutorId: 't1', tutor: MOCK_TUTORS_FORM[0], name: 'Kira', species: 'dog', breed: 'Bulldog Francés', sex: 'female', sterilized: false, weight: 11.8, chipId: '985112003456781', status: 'active', createdAt: new Date() },
  { id: 'p4', clinicId: 'c1', tutorId: 't3', tutor: MOCK_TUTORS_FORM[2], name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, weight: 2.1, status: 'active', createdAt: new Date() },
  { id: 'p5', clinicId: 'c1', tutorId: 't4', tutor: MOCK_TUTORS_FORM[3], name: 'Rocky', species: 'dog', breed: 'Pastor Alemán', sex: 'male', sterilized: true, weight: 38.0, chipId: '985112003456782', photoUrl: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&q=80&w=150', status: 'inactive', createdAt: new Date() },
  { id: 'p6', clinicId: 'c1', tutorId: 't2', tutor: MOCK_TUTORS_FORM[1], name: 'Mimi', species: 'cat', breed: 'Persa', sex: 'female', sterilized: true, weight: 3.8, status: 'active', createdAt: new Date() }
];
