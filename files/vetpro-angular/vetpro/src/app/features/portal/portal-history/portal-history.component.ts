import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TutorPortalService, PortalPatient, MedicalRecordItem, VaccineItem } from '../../../core/services/tutor-portal.service';

@Component({
  selector: 'app-portal-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portal-history.component.html',
  styleUrl: './portal-history.component.scss'
})
export class PortalHistoryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private portalSvc = inject(TutorPortalService);

  patientId = '';
  patient = signal<PortalPatient | null>(null);
  records = signal<MedicalRecordItem[]>([]);
  vaccines = signal<VaccineItem[]>([]);
  loading = signal(true);
  error = signal('');
  activeTab = signal<'records' | 'vaccines'>('records');

  // Controla qué consultas están colapsadas/expandidas
  expandedRecords = signal<Record<string, boolean>>({});

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.patientId = params['id'];
      if (this.patientId) {
        this.loadHistory();
      }
    });
  }

  loadHistory() {
    this.loading.set(true);
    this.error.set('');

    this.portalSvc.getPatientHistory(this.patientId).subscribe({
      next: (res) => {
        this.patient.set(res.patient);
        this.records.set(res.medicalRecords);
        this.vaccines.set(res.vaccines);
        
        // Expandir por defecto el primer registro médico si existe
        if (res.medicalRecords.length > 0) {
          this.expandedRecords.set({ [res.medicalRecords[0].id]: true });
        }
        
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar historial médico:', err);
        this.error.set('No se pudo obtener la historia clínica de la mascota.');
        this.loading.set(false);
      }
    });
  }

  toggleRecord(id: string) {
    const current = this.expandedRecords();
    this.expandedRecords.set({
      ...current,
      [id]: !current[id]
    });
  }

  getSpeciesLabel(spec?: string): string {
    if (!spec) return '';
    switch (spec) {
      case 'dog': return 'Perro';
      case 'cat': return 'Gato';
      case 'rabbit': return 'Conejo';
      case 'bird': return 'Ave';
      case 'reptile': return 'Reptil';
      default: return 'Otro';
    }
  }

  // Generador de cartilla de vacunas PDF (Ventana de impresión limpia e independiente)
  printVaccineCard() {
    const pet = this.patient();
    const vaccs = this.vaccines();
    if (!pet) return;

    // Crear ventana emergente
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para poder generar la cartilla.');
      return;
    }

    // Construir tabla de vacunas
    let vaccineRows = '';
    vaccs.forEach((v) => {
      const applied = new Date(v.appliedAt).toLocaleDateString('es-CO');
      const next = v.nextDueAt ? new Date(v.nextDueAt).toLocaleDateString('es-CO') : 'N/A';
      const vetName = `Dr(a). ${v.vet.firstName} ${v.vet.lastName}`;

      vaccineRows += `
        <tr>
          <td><strong>${v.name}</strong></td>
          <td>${v.brand || 'N/A'}</td>
          <td>${v.batch || 'N/A'}</td>
          <td>${applied}</td>
          <td><span class="next-due">${next}</span></td>
          <td>${vetName}</td>
        </tr>
      `;
    });

    if (vaccs.length === 0) {
      vaccineRows = `<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 20px;">No se registran vacunas aplicadas en el sistema.</td></tr>`;
    }

    // HTML del documento imprimible
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Cartilla de Vacunación — ${pet.name}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1f2937;
            margin: 40px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-text {
            font-size: 24px;
            font-weight: 800;
            color: #10b981;
          }
          .logo-text span {
            color: #1f2937;
          }
          .title {
            text-align: right;
            font-size: 14px;
            color: #6b7280;
          }
          .title h1 {
            font-size: 20px;
            color: #111827;
            margin: 0 0 5px;
          }
          .pet-info {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          .info-group strong {
            color: #4b5563;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 3px;
          }
          .info-group span {
            font-size: 15px;
            font-weight: 600;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid #e5e7eb;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13.5px;
          }
          tr:hover {
            background-color: #f9fafb;
          }
          .next-due {
            color: #059669;
            font-weight: 700;
          }
          .footer {
            margin-top: 50px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-text">VetPro<span>Portal</span></div>
          <div class="title">
            <h1>CARTILLA DE VACUNACIÓN</h1>
            <span>Documento Oficial de Salud Animal</span>
          </div>
        </div>

        <div class="pet-info">
          <div class="info-group">
            <strong>Mascota:</strong>
            <span>${pet.name}</span>
          </div>
          <div class="info-group">
            <strong>Especie y Raza:</strong>
            <span>${this.getSpeciesLabel(pet.species)} (${pet.breed || 'Sin raza'})</span>
          </div>
          <div class="info-group">
            <strong>Sexo y Estado:</strong>
            <span>${pet.sex === 'male' ? 'Macho' : 'Hembra'} (${pet.sterilized ? 'Esterilizado' : 'Entero'})</span>
          </div>
          <div class="info-group">
            <strong>Código de Chip:</strong>
            <span>${pet.chipId || 'Sin registrar'}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Vacuna</th>
              <th>Laboratorio</th>
              <th>Lote</th>
              <th>Aplicación</th>
              <th>Próximo Refuerzo</th>
              <th>Veterinario Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${vaccineRows}
          </tbody>
        </table>

        <div class="footer">
          Este documento es generado dinámicamente desde el sistema central de VetPro SaaS. 
          Consulte a su clínica veterinaria si requiere firmas o sellos físicos adicionales.
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    // Escribir e imprimir
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
