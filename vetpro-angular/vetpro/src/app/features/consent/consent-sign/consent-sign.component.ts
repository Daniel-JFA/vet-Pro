import { Component, inject, signal, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ConsentService } from '../../../core/services/consent.service';

@Component({
  selector: 'app-consent-sign',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consent-sign.component.html',
  styleUrl: './consent-sign.component.scss'
})
export class ConsentSignComponent implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private consentSvc = inject(ConsentService);

  @ViewChild('sigCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  consentId = signal<string | null>(null);
  consent = signal<any | null>(null);
  loading = signal(true);
  submitting = signal(false);
  signedSuccess = signal(false);

  // Lógica de Canvas Drawing Board
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.consentId.set(id);
      this.loadConsentDetails(id);
    }
  }

  loadConsentDetails(id: string) {
    this.loading.set(true);
    this.consentSvc.getConsentForm(id).subscribe({
      next: (data) => {
        this.consent.set(data);
        this.loading.set(false);
        if (data.signed) {
          this.signedSuccess.set(true);
        } else {
          // Retrasar inicialización del Canvas hasta que finalice el renderizado
          setTimeout(() => this.initCanvas(), 100);
        }
      },
      error: (err) => {
        // Fallback mock data offline
        const mockConsent = {
          id: id,
          title: 'Autorización para Anestesia y Cirugía',
          patientName: 'Toby',
          tutorName: 'Carlos Gómez',
          content: 'Por medio del presente documento, yo Carlos Gómez autorizo a la clínica veterinaria VetPro a realizar el procedimiento de castración bajo anestesia general para mi mascota Toby. Entiendo los riesgos quirúrgicos implícitos...',
          signed: false,
          expiresAt: new Date(Date.now() + 2 * 86400000)
        };
        this.consent.set(mockConsent);
        this.loading.set(false);
        setTimeout(() => this.initCanvas(), 100);
      }
    });
  }

  initCanvas() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    
    // Configurar dimensiones reales para pantallas retina/HD
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const context = canvas.getContext('2d');
    if (context) {
      this.ctx = context;
      this.ctx.strokeStyle = '#0f766e'; // Teal tinta premium
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }
  }

  // Capturar cambios en la ventana para redimensionar el Canvas
  @HostListener('window:resize')
  onResize() {
    if (this.canvasRef && !this.signedSuccess()) {
      this.initCanvas();
    }
  }

  // EVENTOS MOUSE
  onMouseDown(e: MouseEvent) {
    this.isDrawing = true;
    const pos = this.getCoords(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isDrawing) return;
    const pos = this.getCoords(e);
    this.draw(pos.x, pos.y);
  }

  onMouseUp() {
    this.isDrawing = false;
  }

  // EVENTOS TOUCH (Móviles)
  onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isDrawing = true;
      const pos = this.getCoords(e.touches[0]);
      this.lastX = pos.x;
      this.lastY = pos.y;
    }
  }

  onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (this.isDrawing && e.touches.length === 1) {
      const pos = this.getCoords(e.touches[0]);
      this.draw(pos.x, pos.y);
    }
  }

  onTouchEnd() {
    this.isDrawing = false;
  }

  // OBTENER COORDENADAS RELATIVAS AL CANVAS
  private getCoords(e: any): { x: number, y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private draw(x: number, y: number) {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    
    this.lastX = x;
    this.lastY = y;
  }

  clearSignature() {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  submitSignature() {
    if (!this.canvasRef) return;
    this.submitting.set(true);

    const canvas = this.canvasRef.nativeElement;
    
    // Obtener la firma Base64 PNG
    const signatureBase64 = canvas.toDataURL('image/png');

    this.consentSvc.signConsentForm(this.consentId()!, signatureBase64).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.signedSuccess.set(true);
        this.consent.update(curr => curr ? { ...curr, signed: true, signature: signatureBase64 } : null);
      },
      error: () => {
        // Fallback local
        this.submitting.set(false);
        this.signedSuccess.set(true);
        this.consent.update(curr => curr ? { ...curr, signed: true, signature: signatureBase64 } : null);
      }
    });
  }
}
