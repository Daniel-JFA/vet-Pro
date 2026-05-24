import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TutorPortalService, PortalPatient } from '../../../core/services/tutor-portal.service';
import { TutorAuthService } from '../../../core/services/tutor-auth.service';

@Component({
  selector: 'app-portal-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-booking.component.html',
  styleUrl: './portal-booking.component.scss'
})
export class PortalBookingComponent implements OnInit {
  private portalSvc = inject(TutorPortalService);
  authSvc = inject(TutorAuthService);
  private router = inject(Router);

  // Estados de datos
  patients = signal<PortalPatient[]>([]);
  vets = signal<any[]>([]);
  loading = signal(true);
  error = signal('');

  // Paso actual del asistente (1 a 5, o 6 para éxito)
  currentStep = signal(1);

  // Formulario reactivo simplificado con signals
  selectedPatientId = signal('');
  selectedService = signal('');
  selectedVetId = signal('');
  selectedDate = signal('');
  selectedTime = signal('');
  reason = signal('');

  // Opciones estáticas de servicios
  services = [
    { id: 'Consulta General', label: 'Consulta General', icon: 'stethoscope', desc: 'Chequeo de rutina, malestares generales o revisión' },
    { id: 'Control', label: 'Control Médico', icon: 'clinical_notes', desc: 'Seguimiento de un tratamiento previo' },
    { id: 'Vacunación', label: 'Vacunación', icon: 'vaccines', desc: 'Aplicación de vacunas y refuerzos' },
    { id: 'Cirugía', label: 'Consulta de Especialidad / Pre-quirúrgica', icon: 'medical_services', desc: 'Revisión técnica o cirugía menor' }
  ];

  // Slots de horas ficticios disponibles
  timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  ngOnInit() {
    this.loadInitialData();
  }

  loadInitialData() {
    this.loading.set(true);
    this.error.set('');

    // Cargar mascotas y veterinarios en paralelo
    this.portalSvc.getPatients().subscribe({
      next: (pets) => {
        this.patients.set(pets);
        if (pets.length > 0) {
          this.selectedPatientId.set(pets[0].id);
        }

        this.portalSvc.getVets().subscribe({
          next: (vetsList) => {
            this.vets.set(vetsList);
            if (vetsList.length > 0) {
              this.selectedVetId.set(vetsList[0].id);
            }
            this.loading.set(false);
          },
          error: (vetsErr) => {
            console.error('Error al cargar veterinarios:', vetsErr);
            this.error.set('No se pudo cargar la lista de médicos veterinarios.');
            this.loading.set(false);
          }
        });
      },
      error: (petsErr) => {
        console.error('Error al cargar mascotas para booking:', petsErr);
        this.error.set('No se pudieron obtener tus mascotas.');
        this.loading.set(false);
      }
    });
  }

  // Navegación del asistente
  nextStep() {
    if (this.currentStep() === 1 && !this.selectedPatientId()) return;
    if (this.currentStep() === 2 && !this.selectedService()) return;
    if (this.currentStep() === 3 && !this.selectedVetId()) return;
    if (this.currentStep() === 4 && (!this.selectedDate() || !this.selectedTime())) return;

    this.currentStep.set(this.currentStep() + 1);
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    }
  }

  // Getters auxiliares para resumen
  getSelectedPatientName(): string {
    const pet = this.patients().find(p => p.id === this.selectedPatientId());
    return pet ? pet.name : '';
  }

  getSelectedVetName(): string {
    const vet = this.vets().find(v => v.id === this.selectedVetId());
    return vet ? `Dr(a). ${vet.firstName} ${vet.lastName}` : '';
  }

  // Agendamiento final
  confirmBooking() {
    this.loading.set(true);
    this.error.set('');

    // Unir fecha y hora para enviarlo en formato ISO estándar
    const dateStr = this.selectedDate(); // YYYY-MM-DD
    const timeStr = this.selectedTime(); // HH:MM AM/PM
    
    // Parse de la hora
    let [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    let hrs = parseInt(hours);
    if (modifier === 'PM' && hrs < 12) hrs += 12;
    if (modifier === 'AM' && hrs === 12) hrs = 0;
    
    const finalDate = new Date(dateStr);
    finalDate.setHours(hrs, parseInt(minutes), 0, 0);

    const bookingData = {
      patientId: this.selectedPatientId(),
      vetId: this.selectedVetId(),
      serviceType: this.selectedService(),
      scheduledAt: finalDate.toISOString(),
      reason: this.reason().trim() || undefined
    };

    this.portalSvc.bookAppointment(bookingData).subscribe({
      next: () => {
        this.loading.set(false);
        this.currentStep.set(6); // Éxito
      },
      error: (err) => {
        console.error('Error al agendar cita:', err);
        this.error.set(err.error?.error || 'No se pudo procesar tu agendamiento. Reintenta.');
        this.loading.set(false);
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/portal/dashboard']);
  }
}
