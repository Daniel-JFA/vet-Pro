import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

type AstState = 'idle' | 'nudge' | 'thinking' | 'speaking';
type MsgKind = 'text' | 'project' | 'events' | 'unanswered' | 'steps';

interface Msg {
  from: 'user' | 'bot';
  full: string;
  shown: string;
  kind: MsgKind;
  done: boolean;
  rate?: 'up' | 'down';
  source?: string;
}

interface TourStep {
  sel: string;
  idx?: number;
  title: string;
  text: string;
}

interface Box { top: number; left: number; width: number; height: number; }

interface Reply {
  text: string;
  kind: MsgKind;
  source: string;
}

@Component({
  selector: 'app-asistente-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './asistente-widget.component.html',
  styleUrl: './asistente-widget.component.scss',
})
export class AsistenteWidgetComponent implements OnDestroy {
  @ViewChild('msgBox') msgBox?: ElementRef<HTMLDivElement>;
  
  private router = inject(Router);
  private api = inject(ApiService);

  visible = true;
  ctx: string = 'General';
  state: AstState = 'idle';
  open = false;
  nudgeShown = false;
  draft = '';
  msgs: Msg[] = [];

  readonly stateLabels: Record<AstState, string> = {
    idle: 'Reposo',
    nudge: 'Sugerencia',
    thinking: 'Pensando…',
    speaking: 'Explicando',
  };

  readonly chips = [
    { key: 'que_es', label: '¿Cómo funciona VetPro?' },
    { key: 'citas', label: '¿Cómo agendar una cita?' },
    { key: 'pacientes', label: 'Registrar un nuevo paciente' }
  ];

  private readonly replies: Record<string, Reply> = {
    que_es: {
      kind: 'text',
      source: 'Base de Conocimiento',
      text: 'VetPro es una plataforma integral para la gestión veterinaria. Te permite administrar pacientes, historiales clínicos, citas, inventario y facturación desde un solo lugar.',
    },
    citas: {
      kind: 'text',
      source: 'Manual de Usuario',
      text: 'Para agendar una cita, dirígete al módulo de "Citas & Agenda" en el menú principal, haz clic en un horario disponible o en el botón "Nueva Cita", y completa los datos del paciente y el motivo de consulta.',
    },
    pacientes: {
      kind: 'text',
      source: 'Manual de Usuario',
      text: 'Ve al módulo "Pacientes", haz clic en "Nuevo Paciente", ingresa la información de la mascota y asociala a un tutor existente o crea uno nuevo en el mismo paso.',
    },
    explicar_Dashboard: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en el Panel Principal (Dashboard). Aquí puedes ver un resumen de las citas de hoy, alertas importantes y el estado general de la clínica.' },
    explicar_Pacientes: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en el directorio de pacientes. Puedes buscar pacientes, ver su información básica y acceder a sus historiales clínicos.' },
    explicar_Tutores: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en la sección de Tutores. Aquí gestionas la información de los dueños de las mascotas y su información de contacto.' },
    explicar_Citas: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Citas & Agenda. Puedes visualizar el calendario de la clínica, agendar nuevas citas y gestionar las visitas del día.' },
    explicar_Historias: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Historias Clínicas. Aquí se registran las consultas, vacunas, desparasitaciones y evolución médica de los pacientes.' },
    explicar_Inventario: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en el Inventario. Controla los productos, medicamentos, lotes y niveles de stock de la clínica.' },
    explicar_Facturacion: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Facturación & POS. Desde aquí gestionas las ventas, cobros de consultas y emites recibos o facturas.' },
    explicar_Reportes: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Reportes. Visualiza métricas de ingresos, nuevos pacientes y el desempeño general de la clínica.' },
    explicar_Usuarios: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Equipo & Usuarios. Administra los accesos y roles del personal de la clínica.' },
    explicar_Peluqueria: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Peluquería & Spa. Aquí puedes gestionar los turnos de grooming y su estado en el kanban.' },
    explicar_Consentimientos: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Consentimientos. Genera y administra las firmas digitales de los tutores para procedimientos médicos.' },
    explicar_CRM: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en CRM de Reactivación. Aquí contactas a tutores de pacientes inactivos para programar nuevas visitas.' },
    explicar_Paseadores: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Paseadores. Administra la agenda de paseos y el personal asignado a esta tarea.' },
    explicar_Laboratorio: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Laboratorio. Gestiona las órdenes de exámenes, su estado y registra los resultados de las muestras.' },
    explicar_Hospitalizacion: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás en Hospitalización. Revisa el kardex de pacientes internados, sus constantes vitales y tratamientos activos.' },
    explicar_General: { kind: 'text', source: 'Contexto de pantalla', text: 'Estás explorando VetPro. Usa el menú lateral para navegar por los diferentes módulos de la aplicación.' },
    guiar: {
      kind: 'steps',
      source: 'Guía de pantalla',
      text: 'Te guío paso a paso por esta sección:',
    },
    libre: {
      kind: 'text',
      source: 'Asistente Virtual',
      text: 'Entiendo tu consulta. En la versión final te ayudaré a gestionar tareas y responder dudas con datos reales de la clínica. Por ahora estoy en modo de demostración.',
    },
  };

  readonly steps: Record<string, string[]> = {
    Dashboard: ['Mira los indicadores generales en la parte superior.', 'Revisa tus citas programadas para hoy.', 'Accede a acciones frecuentes rápidamente.'],
    Pacientes: ['Usa la barra de búsqueda para encontrar un paciente.', 'Haz clic en agregar para registrar un nuevo paciente.', 'Selecciona un paciente para ver su perfil completo.'],
    Tutores: ['Busca tutores por nombre o identificación.', 'Añade nuevos tutores y asóciales mascotas.', 'Revisa su estado de cuenta y datos de contacto.'],
    Citas: ['Visualiza las citas en vista de día, semana o mes.', 'Haz clic en un espacio vacío para agendar.', 'Arrastra las citas para reprogramarlas.'],
    Historias: ['Busca la historia clínica de un paciente.', 'Registra los síntomas y el diagnóstico.', 'Añade recetas y exámenes.'],
    Inventario: ['Revisa las existencias de productos.', 'Registra nuevas entradas o salidas.', 'Controla las fechas de caducidad.'],
    Facturacion: ['Crea nuevas facturas de venta.', 'Cobra las consultas terminadas.', 'Revisa el historial de transacciones.'],
    Reportes: ['Selecciona el rango de fechas a analizar.', 'Revisa los gráficos de ingresos y atenciones.', 'Exporta los datos para contabilidad.'],
    Usuarios: ['Visualiza al personal activo.', 'Asigna roles (Veterinario, Recepción, etc).', 'Controla los accesos al sistema.'],
    Peluqueria: ['Revisa los turnos del día en el tablero.', 'Arrastra las tarjetas para cambiar su estado (espera, proceso, finalizado).', 'Notifica al tutor cuando la mascota esté lista.'],
    Consentimientos: ['Busca consentimientos pendientes por firmar.', 'Genera nuevos documentos según el procedimiento.', 'Firma digitalmente en pantalla.'],
    CRM: ['Filtra los pacientes inactivos o sin visitas recientes.', 'Usa las plantillas de mensajes para contactarlos.', 'Registra el resultado de la comunicación.'],
    Paseadores: ['Consulta el mapa y la ruta de paseos programados.', 'Verifica la disponibilidad de cada paseador.', 'Asigna nuevos paseos a miembros del equipo.'],
    Laboratorio: ['Recibe nuevas órdenes de examen de las consultas.', 'Procesa las muestras y cambia su estado.', 'Ingresa los resultados para que el veterinario los evalúe.'],
    Hospitalizacion: ['Revisa la lista de pacientes internados.', 'Actualiza el kardex médico con cada control.', 'Anota los medicamentos administrados y la evolución.'],
    General: ['Usa el menú lateral para navegar.', 'Usa la barra superior para búsquedas rápidas o notificaciones.']
  };

  private readonly tourDef: Record<string, TourStep[]> = {
    Dashboard: [
      { sel: '.sidebar', title: 'Menú Principal', text: 'Navega rápidamente entre Pacientes, Citas, Inventario y el resto de los módulos de la clínica.' },
      { sel: '.topbar-search', title: 'Búsqueda Global', text: 'Encuentra al instante pacientes o tutores ingresando su nombre, teléfono o identificación. Puedes presionar Cmd+K (o Ctrl+K) para abrirla.' },
      { sel: '.topbar-branch', title: 'Sedes y Sucursales', text: 'Si tu clínica tiene múltiples sedes, aquí puedes alternar entre ellas para ver la información filtrada.' },
      { sel: '.user-chip', title: 'Tu Perfil', text: 'Accede a tu cuenta y a las configuraciones personales o cierra la sesión.' },
      { sel: '.dashboard-container, .page-content', title: 'Resumen del Día', text: 'En esta área verás las métricas principales, ingresos recientes, citas programadas para hoy y pacientes en atención.' },
    ],
    Pacientes: [
      { sel: '.sidebar', title: 'Navegación', text: 'Usa el menú lateral para cambiar de módulo en cualquier momento.' },
      { sel: '.page-header', title: 'Directorio de Pacientes', text: 'Desde el panel superior puedes buscar, filtrar resultados o hacer clic en "Nuevo Paciente" para registrar uno.' },
      { sel: '.patients-page, .page-content', title: 'Lista de Mascotas', text: 'Haz clic en cualquier paciente de la tabla para abrir su historial médico completo y ver sus atenciones.' }
    ],
    Tutores: [
      { sel: '.sidebar', title: 'Menú Principal', text: 'Regresa al panel de inicio o navega por otros módulos.' },
      { sel: '.page-header', title: 'Gestión de Tutores', text: 'Agrega y busca tutores responsables. Desde aquí también puedes enviar notificaciones masivas.' },
      { sel: '.page-content', title: 'Directorio de Clientes', text: 'Revisa la información de contacto, estado de cuenta y mascotas asociadas a cada tutor.' }
    ],
    Citas: [
      { sel: '.topbar-search', title: 'Buscador', text: 'Usa la barra superior para buscar un tutor antes de agendar si lo prefieres.' },
      { sel: '.page-header', title: 'Calendario y Filtros', text: 'Cambia entre las vistas de día, semana o mes, y filtra las citas por profesional veterinario.' },
      { sel: '.calendar-page, .page-content', title: 'Tu Agenda', text: 'Haz clic en cualquier espacio vacío para programar una visita, o arrastra las citas existentes para reprogramarlas.' }
    ],
    Historias: [
      { sel: '.page-header', title: 'Historias Clínicas', text: 'Inicia una nueva atención buscando al paciente o seleccionando uno en sala de espera.' },
      { sel: '.records-page, .page-content', title: 'Registros Médicos', text: 'Aquí se documentan los síntomas, diagnósticos, recetas y notas de evolución de cada consulta.' }
    ],
    Inventario: [
      { sel: '.page-header', title: 'Control de Inventario', text: 'Filtra productos por categoría, busca por código de barras o revisa alertas de stock bajo.' },
      { sel: '.inventory-page, .page-content', title: 'Catálogo de Productos', text: 'Actualiza existencias, ajusta precios, controla lotes y registra nuevas entradas al almacén.' }
    ],
    Facturacion: [
      { sel: '.page-header', title: 'Punto de Venta', text: 'Inicia un nuevo cobro seleccionando al cliente y los servicios prestados.' },
      { sel: '.billing-page, .page-content', title: 'Transacciones y Caja', text: 'Revisa el historial de facturas, recibos emitidos y el flujo de caja diario de la clínica.' }
    ],
    Reportes: [
      { sel: '.reports-header, .page-header', title: 'Filtros de Reportes', text: 'Selecciona el rango de fechas y la sede para analizar el periodo específico.' },
      { sel: '.reports-container, .page-content', title: 'Métricas y Gráficos', text: 'Visualiza el desempeño financiero, atenciones por veterinario y exporta datos para contabilidad.' }
    ],
    Usuarios: [
      { sel: '.page-header', title: 'Gestión de Personal', text: 'Invita a nuevos colaboradores a la plataforma.' },
      { sel: '.users-container, .page-content', title: 'Roles y Permisos', text: 'Asigna roles (Veterinario, Recepcionista, Admin) y controla a qué información tiene acceso cada usuario.' }
    ],
    Peluqueria: [
      { sel: '.page-header', title: 'Control de Turnos', text: 'Revisa rápidamente los servicios de grooming programados para el día.' },
      { sel: '.board-page, .page-content', title: 'Tablero Kanban', text: 'Arrastra las tarjetas de los pacientes a través de las columnas (En espera, Baño, Corte, Listo) para actualizar su estado.' }
    ],
    Consentimientos: [
      { sel: '.page-header', title: 'Firmas Digitales', text: 'Genera nuevos documentos legales o busca consentimientos pendientes de firma.' },
      { sel: '.consent-page, .page-content', title: 'Documentos', text: 'Envía los documentos al celular del tutor para firma remota o solicita la firma en pantalla.' }
    ],
    CRM: [
      { sel: '.page-header', title: 'Reactivación', text: 'Filtra pacientes que necesitan vacunas pronto o que llevan más de 6 meses sin visitarte.' },
      { sel: '.page-content', title: 'Campañas y Mensajes', text: 'Envía mensajes masivos por WhatsApp o correo usando plantillas predefinidas.' }
    ],
    Paseadores: [
      { sel: '.page-header', title: 'Servicios de Paseo', text: 'Administra al equipo de paseadores y la disponibilidad horaria.' },
      { sel: '.page-content', title: 'Rutas', text: 'Controla el progreso, ubicaciones de los paseadores y notificaciones a los tutores.' }
    ],
    Laboratorio: [
      { sel: '.page-header', title: 'Laboratorio', text: 'Filtra las órdenes médicas solicitadas en consulta.' },
      { sel: '.page-content', title: 'Procesamiento de Exámenes', text: 'Cambia el estado de las muestras e ingresa los resultados para que el veterinario pueda evaluarlos.' }
    ],
    Hospitalizacion: [
      { sel: '.page-header', title: 'Pacientes Internados', text: 'Monitorea la ocupación de jaulas y el estado crítico de los internados.' },
      { sel: '.page-content', title: 'Kardex Médico', text: 'Añade registros constantes de signos vitales, administración de medicamentos y notas de enfermería.' }
    ],
    General: [
      { sel: '.sidebar', title: 'Menú de Navegación', text: 'Este es el centro de control de VetPro. Desde aquí puedes saltar a cualquier módulo de la aplicación.' },
      { sel: '.topbar-search', title: 'Búsqueda Global', text: 'Usa esta barra desde cualquier lugar para encontrar pacientes o tutores rápidamente.' },
      { sel: '.topbar-actions', title: 'Herramientas', text: 'Aquí encontrarás notificaciones, cambio de sede y opciones de actualización de la app.' },
      { sel: '.page-content', title: 'Área de Trabajo', text: 'En este espacio principal se muestra toda la información interactiva de la vista actual.' }
    ]
  };

  touring = false;
  tourIdx = 0;
  tourSteps: { el: HTMLElement; title: string; text: string }[] = [];
  spot: Box | null = null;
  cardTop: number | null = null;
  cardBottom: number | null = null;
  cardLeft = 24;
  private tourTimer?: ReturnType<typeof setTimeout>;

  get tourStep() { return this.tourSteps[this.tourIdx]; }

  startTour(): void {
    // Retraso para asegurar que la ruta hija de Angular se haya renderizado
    setTimeout(() => {
      const steps = (this.tourDef[this.ctx] || this.tourDef['General'])
        .map((d) => {
          const all = Array.from(document.querySelectorAll<HTMLElement>(d.sel));
          // Encontrar el primer elemento que realmente esté visible (evita menús colapsados en móvil)
          const el = all.find(e => {
            const r = e.getBoundingClientRect();
            // El elemento debe tener tamaño y estar dentro del viewport o scrolleable (right > 0)
            return r.height > 0 && r.width > 0 && r.right > 0;
          });
          return el ? { el, title: d.title, text: d.text } : null;
        })
        .filter((x): x is { el: HTMLElement; title: string; text: string } => !!x);
        
      if (!steps.length) {
        this.openPanel();
        this.ask('guiar', 'Guíame en esta pantalla');
        return;
      }
      
      this.tourSteps = steps;
      this.tourIdx = 0;
      this.touring = true;
      this.open = false;
      this.nudgeShown = false;
      clearTimeout(this.nudgeTimer);
      this.goTo(0);
    }, 200); // 200ms de gracia para el ciclo de vida de componentes
  }

  goTo(i: number): void {
    if (i < 0 || i >= this.tourSteps.length) return;
    this.tourIdx = i;
    this.state = 'speaking';
    const el = this.tourSteps[i].el;
    const nav = 60; 
    const r = el.getBoundingClientRect();
    const target = r.height + nav > window.innerHeight - 220
      ? window.scrollY + r.top - nav - 12                       
      : window.scrollY + r.top - (window.innerHeight - r.height) / 2 + 40; 
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    this.measure();
    clearTimeout(this.tourTimer);
    this.tourTimer = setTimeout(() => { this.measure(); this.state = 'idle'; }, 650);
  }

  next(): void { this.tourIdx < this.tourSteps.length - 1 ? this.goTo(this.tourIdx + 1) : this.endTour(); }
  prev(): void { this.goTo(this.tourIdx - 1); }

  endTour(): void {
    this.touring = false;
    this.spot = null;
    this.state = 'idle';
    clearTimeout(this.tourTimer);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  measure(): void {
    if (!this.touring || !this.tourStep) return;
    const r = this.tourStep.el.getBoundingClientRect();
    const pad = 8, vh = window.innerHeight, vw = window.innerWidth;
    const top = Math.max(r.top - pad, 6), bottom = Math.min(r.bottom + pad, vh - 6);
    const left = Math.max(r.left - pad, 6), right = Math.min(r.right + pad, vw - 6);
    this.spot = { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
    const cardW = Math.min(360, vw - 32);
    this.cardLeft = Math.min(Math.max(left, 16), vw - cardW - 16);
    this.cardTop = this.cardBottom = null;
    if (vh - bottom > 230) this.cardTop = bottom + 14;            
    else if (top > 260) this.cardBottom = vh - top + 14;           
    else { this.cardBottom = 24; this.cardLeft = 16; }             
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.touring) return;
    if (e.key === 'Escape') this.endTour();
    else if (e.key === 'ArrowRight') this.next();
    else if (e.key === 'ArrowLeft') this.prev();
  }

  private sub: Subscription;
  private nudgeTimer?: ReturnType<typeof setTimeout>;
  private thinkTimer?: ReturnType<typeof setTimeout>;
  private typeTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.onRoute(this.router.url);
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.onRoute(e.urlAfterRedirects));
  }

  private onRoute(url: string): void {
    const path = url.split(/[?#]/)[0];
    
    if (path.includes('dashboard')) {
      this.ctx = 'Dashboard';
    } else if (path.includes('patients')) {
      this.ctx = 'Pacientes';
    } else if (path.includes('tutors')) {
      this.ctx = 'Tutores';
    } else if (path.includes('appointments')) {
      this.ctx = 'Citas';
    } else if (path.includes('medical-records')) {
      this.ctx = 'Historias';
    } else if (path.includes('inventory')) {
      this.ctx = 'Inventario';
    } else if (path.includes('billing')) {
      this.ctx = 'Facturacion';
    } else if (path.includes('reports')) {
      this.ctx = 'Reportes';
    } else if (path.includes('users')) {
      this.ctx = 'Usuarios';
    } else if (path.includes('grooming')) {
      this.ctx = 'Peluqueria';
    } else if (path.includes('consent')) {
      this.ctx = 'Consentimientos';
    } else if (path.includes('crm')) {
      this.ctx = 'CRM';
    } else if (path.includes('walkers')) {
      this.ctx = 'Paseadores';
    } else if (path.includes('labs')) {
      this.ctx = 'Laboratorio';
    } else if (path.includes('hospitalization')) {
      this.ctx = 'Hospitalizacion';
    } else {
      this.ctx = 'General';
    }
    
    this.endTour();
    this.nudgeShown = false;
    if (this.state === 'nudge') this.state = 'idle';
    clearTimeout(this.nudgeTimer);
    
    if (this.visible && !this.open) {
      this.nudgeTimer = setTimeout(() => {
        this.nudgeShown = true;
        this.state = 'nudge';
      }, 5000);
    }
  }

  get nudgeText(): string {
    return '¿Necesitas ayuda con esta pantalla?';
  }

  toggle(): void {
    this.open ? this.close() : this.openPanel();
  }

  openPanel(): void {
    this.open = true;
    this.nudgeShown = false;
    clearTimeout(this.nudgeTimer);
    if (this.state === 'nudge') this.state = 'idle';
    if (!this.msgs.length) {
      const hello = `¡Hola! Soy el asistente virtual de VetPro. Estás en la sección de ${this.ctx}. ¿En qué te puedo ayudar hoy?`;
      this.msgs.push({ from: 'bot', full: hello, shown: hello, kind: 'text', done: true });
    }
  }

  close(): void {
    this.open = false;
  }

  acceptNudge(): void {
    this.openPanel();
    this.ask('guiar', 'Guíame en esta pantalla');
  }

  dismissNudge(): void {
    this.nudgeShown = false;
    this.state = 'idle';
  }

  reset(): void {
    this.stopTimers();
    this.msgs = [];
    this.state = 'idle';
    this.openPanel();
  }

  chip(key: string, label: string): void {
    this.ask(key, label);
  }

  explain(): void {
    const key = this.replies['explicar_' + this.ctx] ? 'explicar_' + this.ctx : 'explicar_General';
    this.ask(key, 'Explícame esta vista');
  }

  guide(): void {
    this.startTour();
  }

  async send(): Promise<void> {
    const q = this.draft.trim();
    if (!q) return;
    this.draft = '';
    
    // Mostramos la pregunta del usuario
    this.stopTimers();
    this.msgs.forEach((m) => { m.shown = m.full; m.done = true; });
    this.msgs.push({ from: 'user', full: q, shown: q, kind: 'text', done: true });
    this.state = 'thinking';
    this.scroll();

    try {
      // ApiService agrega la sesión (y la renueva si venció) y usa la URL de la API correcta
      const data = await firstValueFrom(
        this.api.post<{ action: 'REPLY' | 'NAVIGATE'; payload: string }>('/assistant/chat', { message: q, context: this.ctx })
      );

      if (data.action === 'NAVIGATE') {
        const replyText = `¡Claro! Te llevo a esa sección enseguida.`;
        this.typeResponse(replyText, 'text', 'Navegación');
        setTimeout(() => {
          this.router.navigateByUrl(data.payload);
          this.close();
        }, 1500);
      } else {
        this.typeResponse(data.payload, 'text', 'Asistente IA');
      }

    } catch (error) {
      console.error('Error contacting AI assistant:', error);
      this.typeResponse('Lo siento, no pude procesar tu solicitud. Por favor intenta de nuevo.', 'text', 'Error');
    }
  }

  private typeResponse(text: string, kind: MsgKind, source: string): void {
    const m: Msg = { from: 'bot', full: text, shown: '', kind, done: false, source };
    this.msgs.push(m);
    this.state = 'speaking';
    this.typeTimer = setInterval(() => {
      m.shown = m.full.slice(0, m.shown.length + 3);
      this.scroll();
      if (m.shown.length >= m.full.length) {
        clearInterval(this.typeTimer);
        m.done = true;
        this.state = 'idle';
        this.scroll();
      }
    }, 22);
  }

  rate(m: Msg, v: 'up' | 'down'): void {
    if (!m.rate) m.rate = v;
  }

  private ask(key: string, question: string): void {
    this.stopTimers();
    this.msgs.forEach((m) => { m.shown = m.full; m.done = true; });
    this.msgs.push({ from: 'user', full: question, shown: question, kind: 'text', done: true });
    this.state = 'thinking';
    this.scroll();
    const r = this.replies[key] ?? this.replies['libre'];
    this.thinkTimer = setTimeout(() => {
      const m: Msg = { from: 'bot', full: r.text, shown: '', kind: r.kind, done: false, source: r.source };
      this.msgs.push(m);
      this.state = 'speaking';
      this.typeTimer = setInterval(() => {
        m.shown = m.full.slice(0, m.shown.length + 3);
        this.scroll();
        if (m.shown.length >= m.full.length) {
          clearInterval(this.typeTimer);
          m.done = true;
          this.state = 'idle';
          this.scroll();
        }
      }, 22);
    }, 800);
  }

  private scroll(): void {
    setTimeout(() => {
      const el = this.msgBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private stopTimers(): void {
    clearTimeout(this.thinkTimer);
    clearInterval(this.typeTimer);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.nudgeTimer);
    clearTimeout(this.tourTimer);
    this.stopTimers();
  }
}
