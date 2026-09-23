import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketplaceService, MyVetProfile } from '../../../core/services/marketplace.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-vet-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vet-profile-edit.component.html',
  styleUrls: ['./vet-profile-edit.component.scss']
})
export class VetProfileEditComponent implements OnInit {
  private marketplaceService = inject(MarketplaceService);
  private toast = inject(ToastService);

  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  uploadingDocs = signal<boolean>(false);

  profile = signal<MyVetProfile | null>(null);

  // Campos de formulario
  professionalCard = '';
  bio = '';
  consultationPrice = 50000;
  homeVisitPrice: number | null = null;
  city = '';
  whatsappNumber = '';
  isPublic = false;

  // Listas de selección
  availableSpecialties = [
    'Medicina General',
    'Medicina Felina',
    'Dermatología',
    'Cirugía de Tejidos Blandos',
    'Ortopedia',
    'Odontología',
    'Cardiología',
    'Oftalmología',
    'Ecografía y Rayos X',
    'Nutrición y Dietética'
  ];
  selectedSpecialties: string[] = [];

  attendsHome = true;
  attendsClinic = true;

  zonesInput = '';

  // Archivos seleccionados
  selectedCardFile: File | null = null;
  selectedIdFile: File | null = null;

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.marketplaceService.getMyProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.professionalCard = p.professionalCard || '';
        this.bio = p.bio || '';
        this.consultationPrice = p.consultationPrice || 50000;
        this.homeVisitPrice = p.homeVisitPrice || null;
        this.city = p.city || '';
        this.whatsappNumber = p.whatsappNumber || '';
        this.isPublic = p.isPublic;
        this.selectedSpecialties = p.specialties || [];
        this.attendsHome = (p.modalities || []).includes('domicilio');
        this.attendsClinic = (p.modalities || []).includes('consultorio');
        this.zonesInput = (p.coverageZones || []).join(', ');
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error al cargar la información del perfil');
        this.loading.set(false);
      }
    });
  }

  toggleSpecialty(spec: string): void {
    const idx = this.selectedSpecialties.indexOf(spec);
    if (idx >= 0) {
      this.selectedSpecialties.splice(idx, 1);
    } else {
      this.selectedSpecialties.push(spec);
    }
  }

  onCardFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedCardFile = file;
    }
  }

  onIdFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedIdFile = file;
    }
  }

  uploadDocuments(): void {
    if (!this.selectedCardFile && !this.selectedIdFile) {
      this.toast.error('Selecciona al menos un documento para subir');
      return;
    }

    const formData = new FormData();
    if (this.selectedCardFile) {
      formData.append('cardDocument', this.selectedCardFile);
    }
    if (this.selectedIdFile) {
      formData.append('idDocument', this.selectedIdFile);
    }

    this.uploadingDocs.set(true);
    this.marketplaceService.uploadDocuments(formData).subscribe({
      next: (res) => {
        this.toast.success('Documentos cargados. Tu perfil está en revisión.');
        this.profile.set(res.profile);
        this.uploadingDocs.set(false);
        this.selectedCardFile = null;
        this.selectedIdFile = null;
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al subir los documentos');
        this.uploadingDocs.set(false);
      }
    });
  }

  saveProfile(): void {
    const modalities: string[] = [];
    if (this.attendsHome) modalities.push('domicilio');
    if (this.attendsClinic) modalities.push('consultorio');

    const zones = this.zonesInput
      .split(',')
      .map((z) => z.trim())
      .filter((z) => z.length > 0);

    this.saving.set(true);
    this.marketplaceService
      .updateMyProfile({
        professionalCard: this.professionalCard,
        bio: this.bio,
        consultationPrice: Number(this.consultationPrice) || 0,
        homeVisitPrice: this.homeVisitPrice ? Number(this.homeVisitPrice) : null,
        city: this.city,
        whatsappNumber: this.whatsappNumber,
        isPublic: this.isPublic,
        specialties: this.selectedSpecialties,
        modalities,
        coverageZones: zones
      })
      .subscribe({
        next: (updated) => {
          this.toast.success('Perfil profesional actualizado con éxito');
          this.profile.set(updated);
          this.saving.set(false);
        },
        error: (err) => {
          this.toast.error(err.error?.error || 'Error al guardar el perfil');
          this.saving.set(false);
        }
      });
  }
}
