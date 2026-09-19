import { Component, signal } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  isRecording = signal(false);
  isAnalyzing = signal(false);
  showNote = signal(false);

  typedSpeech = signal('');
  fullSpeech =
    'Paciente Toby, canino Golden Retriever de 5 años. Presenta cojera en miembro posterior derecho después de correr en el parque. Al examen físico hay dolor moderado y test de Cajón Anterior positivo. Sospecha de ruptura de ligamento cruzado. Tratamiento: reposo absoluto por 15 días y Meloxicam 0.1 mg cada 24 horas.';

  openFaq = signal<number | null>(null);

  faqList = signal([
    {
      q: '¿Cómo funciona la transcripción clínica por Inteligencia Artificial?',
      a: 'VetPro integra Whisper de OpenAI para capturar y transcribir tu dictado clínico con precisión. Luego, a través de Claude AI y Prompt Engineering especializado, procesamos el texto libre estructurándolo en formato médico SOAP (Anamnesis, Examen Físico, Diagnóstico y Tratamiento) con dosis calculadas automáticamente.',
    },
    {
      q: '¿Qué es el Portal del Tutor Passwordless?',
      a: 'Es una aplicación progresiva (PWA) diseñada para dueños de mascotas. El tutor recibe un correo con un enlace seguro (Magic Link) de un solo uso. Al dar clic, ingresa instantáneamente a la app sin crear usuarios o contraseñas engorrosas.',
    },
    {
      q: '¿Se integra con WhatsApp para alertas automatizadas?',
      a: 'La plataforma prepara recordatorios y campañas de reactivación listos para enviar por WhatsApp; si tienes credenciales de WhatsApp Business API configuradas, el envío es automático, y si no, genera el enlace de chat para que tu equipo lo despache con un clic.',
    },
    {
      q: '¿Cumple con la normatividad de protección de datos en Colombia?',
      a: 'Por supuesto. VetPro SaaS está totalmente adaptado a la Ley 1581 de 2012 de Habeas Data colombiana, garantizando la privacidad de los historiales clínicos, firmas de consentimiento informado digitalizadas y derechos ARCO para tutores de mascotas.',
    },
  ]);

  toggleFaq(index: number) {
    if (this.openFaq() === index) {
      this.openFaq.set(null);
    } else {
      this.openFaq.set(index);
    }
  }

  startSimulatedRecording() {
    this.isRecording.set(true);
    this.showNote.set(false);
    this.typedSpeech.set('');

    // Simulate speech-to-text typing effect
    let charIndex = 0;
    const interval = setInterval(() => {
      if (charIndex < this.fullSpeech.length) {
        this.typedSpeech.update((prev) => prev + this.fullSpeech.charAt(charIndex));
        charIndex += 4; // Fast type simulation
      } else {
        clearInterval(interval);
        this.finishRecording();
      }
    }, 50);
  }

  finishRecording() {
    this.isRecording.set(false);
    this.isAnalyzing.set(true);

    // Simulate AI clinical structured notes parsing time
    setTimeout(() => {
      this.isAnalyzing.set(false);
      this.showNote.set(true);
    }, 2000);
  }

  resetDemo() {
    this.showNote.set(false);
    this.typedSpeech.set('');
    this.isRecording.set(false);
    this.isAnalyzing.set(false);
  }
}
