import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationsService, NotificationTemplate } from '../../../core/services/notifications.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-notification-templates',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notification-templates.component.html',
  styleUrl: './notification-templates.component.scss',
})
export class NotificationTemplatesComponent implements OnInit {
  private notificationsService = inject(NotificationsService);
  private toast = inject(ToastService);

  loading = signal(false);
  submitting = signal(false);

  templates = signal<NotificationTemplate[]>([]);
  selectedTemplateId = signal<string>('');

  selectedTemplate = computed(
    () => this.templates().find((t) => t.id === this.selectedTemplateId()) || this.templates()[0],
  );

  editableBody = signal<string>('');

  // Lista de placeholders que se pueden inyectar
  placeholders = [
    { token: '{{nombre_tutor}}', label: 'Nombre Tutor' },
    { token: '{{nombre_mascota}}', label: 'Nombre Mascota' },
    { token: '{{fecha_cita}}', label: 'Fecha Cita' },
    { token: '{{hora_cita}}', label: 'Hora Cita' },
    { token: '{{veterinario}}', label: 'Veterinario' },
  ];

  // Datos demo para el Reemplazo en el simulador de WhatsApp
  demoData = {
    tutor: 'Carlos Gómez',
    mascota: 'Toby',
    fecha: 'Mañana, 25 de Mayo',
    hora: '09:00 AM',
    vet: 'Dr. Andrés Espinoza',
  };

  previewReplacedBody = computed(() => {
    let text = this.editableBody();
    text = text.replace(/\{\{nombre_tutor\}\}/g, this.demoData.tutor);
    text = text.replace(/\{\{nombre_mascota\}\}/g, this.demoData.mascota);
    text = text.replace(/\{\{fecha_cita\}\}/g, this.demoData.fecha);
    text = text.replace(/\{\{hora_cita\}\}/g, this.demoData.hora);
    text = text.replace(/\{\{veterinario\}\}/g, this.demoData.vet);
    return text;
  });

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading.set(true);
    this.notificationsService.getTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.data);
        if (res.data.length > 0) {
          const first = res.data[0];
          this.selectedTemplateId.set(first.id);
          this.editableBody.set(first.body);
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Error al cargar las plantillas de notificación.');
        this.loading.set(false);
      },
    });
  }

  selectTemplate(id: string) {
    this.selectedTemplateId.set(id);
    const tpl = this.templates().find((t) => t.id === id);
    if (tpl) {
      this.editableBody.set(tpl.body);
    }
  }

  injectPlaceholder(token: string) {
    const textarea = document.getElementById('template-body-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = this.editableBody();

    const newText = currentText.substring(0, start) + token + currentText.substring(end);
    this.editableBody.set(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  }

  toggleActive() {
    const current = this.selectedTemplate();
    if (!current) return;

    this.notificationsService.toggleTemplate(current.id).subscribe({
      next: (res) => {
        this.templates.update((list) =>
          list.map((t) => (t.id === current.id ? { ...t, active: res.data.active } : t)),
        );
        this.toast.success(
          res.data.active ? 'Plantilla activada para envíos automáticos.' : 'Plantilla desactivada.',
        );
      },
      error: () => {
        this.toast.error('No se pudo cambiar el estado de la plantilla.');
      },
    });
  }

  save() {
    const activeTemplate = this.selectedTemplate();
    if (!activeTemplate) return;

    this.submitting.set(true);
    const updatedBody = this.editableBody();

    this.notificationsService.updateTemplate(activeTemplate.id, { body: updatedBody }).subscribe({
      next: (res) => {
        this.templates.update((list) =>
          list.map((t) => (t.id === activeTemplate.id ? { ...t, body: res.data.body } : t)),
        );
        this.submitting.set(false);
        this.toast.success('Plantilla guardada exitosamente.');
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Error al guardar la plantilla.');
      },
    });
  }
}
