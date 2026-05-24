import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationTemplate } from '../../../core/models';

@Component({
  selector: 'app-notification-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-templates.component.html',
  styleUrl: './notification-templates.component.scss'
})
export class NotificationTemplatesComponent {
  loading = signal(false);
  submitting = signal(false);

  // Listado de plantillas configuradas (Mock para desarrollo)
  templates = signal<NotificationTemplate[]>([
    {
      id: 'nt1',
      clinicId: 'c1',
      name: 'Recordatorio de Cita (24h antes)',
      trigger: 'appointment-reminder-24h',
      channel: 'whatsapp',
      body: 'Hola {{nombre_tutor}}, te recordamos que mañana {{fecha_cita}} a las {{hora_cita}} tienes una cita programada para tu mascota {{nombre_mascota}} con el profesional {{veterinario}}. ¡Te esperamos!',
      active: true
    },
    {
      id: 'nt2',
      clinicId: 'c1',
      name: 'Aviso de Llegada a Sala',
      trigger: 'custom',
      channel: 'whatsapp',
      body: 'Estimado(a) {{nombre_tutor}}, te informamos que {{nombre_mascota}} ya ha ingresado a nuestra sala de espera. Estará ingresando a consultorio en unos minutos.',
      active: true
    },
    {
      id: 'nt3',
      clinicId: 'c1',
      name: 'Alerta de Refuerzo de Vacuna',
      trigger: 'vaccine-due',
      channel: 'whatsapp',
      body: '¡Hola {{nombre_tutor}}! Te recordamos que ya se acerca la fecha de refuerzo de la vacuna de {{nombre_mascota}}. Por favor ponte en contacto con nosotros para agendar su cita.',
      active: false
    }
  ]);

  selectedTemplateId = signal<string>('nt1');

  // Obtener la plantilla activa seleccionada
  selectedTemplate = computed(() => 
    this.templates().find(t => t.id === this.selectedTemplateId()) || this.templates()[0]
  );

  // Cuerpo editable temporal para no mutar el estado global directamente antes de guardar
  editableBody = signal<string>('');

  constructor() {
    // Sincronizar el cuerpo editable cuando cambia la plantilla elegida
    this.editableBody.set(this.selectedTemplate().body);
  }

  selectTemplate(id: string) {
    this.selectedTemplateId.set(id);
    this.editableBody.set(this.selectedTemplate().body);
  }

  // Lista de placeholders que se pueden inyectar
  placeholders = [
    { token: '{{nombre_tutor}}', label: 'Nombre Tutor' },
    { token: '{{nombre_mascota}}', label: 'Nombre Mascota' },
    { token: '{{fecha_cita}}', label: 'Fecha Cita' },
    { token: '{{hora_cita}}', label: 'Hora Cita' },
    { token: '{{veterinario}}', label: 'Veterinario' }
  ];

  // Datos demo para el Reemplazo en el simulador de WhatsApp
  demoData = {
    tutor: 'Carlos Gómez',
    mascota: 'Toby',
    fecha: 'Mañana, 25 de Mayo',
    hora: '09:00 AM',
    vet: 'Dr. Andrés Espinoza'
  };

  // Reemplazar marcadores dinámicos por datos de prueba en la vista previa
  previewReplacedBody = computed(() => {
    let text = this.editableBody();
    text = text.replace(/\{\{nombre_tutor\}\}/g, this.demoData.tutor);
    text = text.replace(/\{\{nombre_mascota\}\}/g, this.demoData.mascota);
    text = text.replace(/\{\{fecha_cita\}\}/g, this.demoData.fecha);
    text = text.replace(/\{\{hora_cita\}\}/g, this.demoData.hora);
    text = text.replace(/\{\{veterinario\}\}/g, this.demoData.vet);
    return text;
  });

  // Insertar un marcador de posición en la posición actual del cursor en el textarea
  injectPlaceholder(token: string) {
    const textarea = document.getElementById('template-body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = this.editableBody();
    
    const newText = currentText.substring(0, start) + token + currentText.substring(end);
    this.editableBody.set(newText);

    // Reposicionar el cursor después de insertar el token
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  }

  toggleActive() {
    const current = this.selectedTemplate();
    this.templates.update(list => 
      list.map(t => t.id === current.id ? { ...t, active: !t.active } : t)
    );
  }

  save() {
    this.submitting.set(true);
    const activeTemplate = this.selectedTemplate();
    const updatedBody = this.editableBody();

    // Simulación de guardado
    setTimeout(() => {
      this.templates.update(list => 
        list.map(t => t.id === activeTemplate.id ? { ...t, body: updatedBody } : t)
      );
      this.submitting.set(false);
    }, 600);
  }
}
