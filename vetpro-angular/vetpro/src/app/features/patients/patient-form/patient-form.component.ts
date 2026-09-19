import { Component, inject, signal, OnInit } from '@angular/core';

import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PatientService } from '../../../core/services/patient.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient, Tutor, Species, PatientStatus } from '../../../core/models';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.scss',
})
export class PatientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(PatientService);
  private appointmentSvc = inject(AppointmentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

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

  // Tutor existente con el mismo teléfono/documento (aviso antes de duplicar)
  duplicateTutor = signal<Tutor | null>(null);

  speciesOptions: { value: Species; label: string }[] = [
    { value: 'dog', label: 'Perro' },
    { value: 'cat', label: 'Gato' },
    { value: 'rabbit', label: 'Conejo' },
    { value: 'bird', label: 'Ave' },
    { value: 'reptile', label: 'Reptil' },
    { value: 'horse', label: 'Caballo' },
    { value: 'cow', label: 'Vaca' },
    { value: 'pig', label: 'Cerdo' },
    { value: 'other', label: 'Otro' },
  ];

  statusOptions: { value: PatientStatus; label: string }[] = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'deceased', label: 'Fallecido' },
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
      return;
    }

    // Venimos de "agendar cita para mascota nueva" — precargar datos del prospecto
    // y arrancar directo en modo "tutor nuevo"
    const prospectName = this.route.snapshot.queryParamMap.get('prospectName');
    const prospectPhone = this.route.snapshot.queryParamMap.get('prospectPhone');
    if (prospectName || prospectPhone) {
      this.setTutorMode('new');
      const [firstName, ...rest] = (prospectName || '').split(' ');
      this.tutorForm.patchValue({
        firstName: firstName || '',
        lastName: rest.join(' '),
        phone: prospectPhone || '',
      });
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
      tutorId: ['', Validators.required],
    });

    this.tutorForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+() -]+$/)]],
      documentId: [''],
      address: [''],
      notes: [''],
    });
  }

  // El tutor ya existía: se usa ese en vez de crear uno duplicado
  useExistingTutor() {
    const existing = this.duplicateTutor();
    if (!existing) return;
    if (!this.tutors().some((t) => t.id === existing.id)) {
      this.tutors.update((list) => [...list, existing]);
    }
    this.duplicateTutor.set(null);
    this.setTutorMode('select');
    this.form.patchValue({ tutorId: existing.id });
  }

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
    this.svc.getTutors({ pageSize: 500 }).subscribe({
      next: (res) => {
        this.tutors.set(res.data);
        // Viene de "Agregar mascota" en la página de Tutores
        const preselected = this.route.snapshot.queryParamMap.get('tutorId');
        if (preselected && !this.isEditMode()) this.form.patchValue({ tutorId: preselected });
      },
      error: () => {
        this.toast.error('No se pudo cargar el listado de tutores. Intenta recargar la página.');
      },
    });
  }

  private loadPatient(id: string) {
    this.loading.set(true);
    this.svc.getPatient(id).subscribe({
      next: (p) => {
        this.fillForm(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('No se pudo cargar la información del paciente a editar.');
        this.router.navigate(['/patients']);
      },
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
      tutorId: p.tutorId,
    });
    this.previewPhotoUrl.set(p.photoUrl || null);
  }

  uploadingPhoto = signal(false);

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const patientId = this.patientId();
    if (!patientId) return;

    this.uploadingPhoto.set(true);
    this.svc.uploadPatientPhoto(patientId, file).subscribe({
      next: (res) => {
        this.uploadingPhoto.set(false);
        this.previewPhotoUrl.set(res.photoUrl);
        this.form.patchValue({ photoUrl: res.photoUrl });
        this.toast.success('Foto actualizada exitosamente.');
        input.value = '';
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.toast.error(err?.error?.error || 'No se pudo subir la foto. Intenta de nuevo.');
        input.value = '';
      },
    });
  }

  removePhoto() {
    this.form.patchValue({ photoUrl: '' });
    this.previewPhotoUrl.set(null);
  }

  submit(allowDuplicate = false) {
    if (this.form.invalid && this.tutorMode() === 'select') {
      this.markAllAsTouched(this.form);
      return;
    }
    if (
      this.tutorMode() === 'new' &&
      (this.tutorForm.invalid ||
        this.form.get('name')?.invalid ||
        this.form.get('species')?.invalid)
    ) {
      this.markAllAsTouched(this.form);
      this.markAllAsTouched(this.tutorForm);
      return;
    }

    this.submitting.set(true);

    // Si se crea un tutor nuevo inline, hay que registrarlo primero en el
    // backend (antes no se hacía: se inventaba un id falso en el navegador
    // y el backend siempre rechazaba la creación del paciente).
    if (this.tutorMode() === 'new') {
      this.duplicateTutor.set(null);
      this.svc.createTutor({ ...this.tutorForm.value, allowDuplicate }).subscribe({
        next: (newTutor) => this.savePatient({ ...this.form.value, tutorId: newTutor.id }),
        error: (err) => {
          this.submitting.set(false);
          if (err?.status === 409 && err.error?.code === 'DUPLICATE_TUTOR') {
            this.duplicateTutor.set(err.error.existing);
            return;
          }
          this.toast.error('No se pudo registrar el tutor. Verifica los datos e intenta de nuevo.');
        },
      });
    } else {
      this.savePatient({ ...this.form.value });
    }
  }

  private savePatient(patientData: any) {
    if (this.isEditMode()) {
      this.svc.updatePatient(this.patientId()!, patientData).subscribe({
        next: (patient) => {
          this.submitting.set(false);
          this.toast.success('Paciente actualizado exitosamente.');
          this.afterSave(patient);
        },
        error: () => {
          this.submitting.set(false);
          this.toast.error(
            'No se pudo actualizar el paciente. Verifica los datos e intenta de nuevo.',
          );
        },
      });
    } else {
      this.svc.createPatient(patientData).subscribe({
        next: (patient) => {
          this.submitting.set(false);
          this.toast.success('Paciente registrado exitosamente.');
          this.afterSave(patient);
        },
        error: () => {
          this.submitting.set(false);
          this.toast.error(
            'No se pudo registrar el paciente. Verifica los datos e intenta de nuevo.',
          );
        },
      });
    }
  }

  // Si venimos de "agendar cita para mascota nueva", vincula el paciente recién
  // creado a esa cita y vuelve al calendario en vez de al listado de pacientes.
  private afterSave(patient: Patient) {
    const returnAppointmentId = this.route.snapshot.queryParamMap.get('returnAppointmentId');
    if (returnAppointmentId) {
      this.appointmentSvc.linkPatient(returnAppointmentId, patient.id).subscribe({
        next: () =>
          this.router.navigate(['/medical-records', 'new', patient.id], {
            queryParams: { appointmentId: returnAppointmentId },
          }),
        error: () => {
          this.toast.error('El paciente se creó, pero no se pudo vincular a la cita.');
          this.router.navigate(['/appointments/calendar']);
        },
      });
    } else {
      this.router.navigate(['/patients']);
    }
  }

  private markAllAsTouched(fg: FormGroup) {
    Object.values(fg.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markAllAsTouched(control as FormGroup);
      }
    });
  }
}
