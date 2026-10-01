import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_INFO } from '../../core/legal/legal-info';

// Política de Tratamiento de Datos Personales (Ley 1581 de 2012, Decreto 1377 de 2013).
// Es la URL pública que exigen App Store y Google Play.
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['./legal-page.scss'],
  template: `
    <main class="legal-page">
      <article class="legal-card">
        <a routerLink="/landing" class="back-link">← Volver a VetPro</a>
        <h1>Política de Tratamiento de Datos Personales</h1>
        <p class="meta">Última actualización: {{ legal.policyUpdatedAt }}</p>

        <p>
          Esta política explica cómo VetPro recolecta, usa, guarda y elimina datos personales, en cumplimiento de la
          <strong>Ley 1581 de 2012</strong>, el <strong>Decreto 1377 de 2013</strong> (compilado en el Decreto 1074 de 2015)
          y demás normas colombianas de protección de datos.
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <ul class="plain">
          <li><strong>Responsable:</strong> {{ legal.controllerName }}</li>
          <li><strong>Identificación:</strong> {{ legal.controllerId }}</li>
          <li><strong>Dirección:</strong> {{ legal.address }}, {{ legal.city }}</li>
          <li><strong>Correo para asuntos de privacidad:</strong> {{ legal.privacyEmail }}</li>
          <li><strong>Teléfono / WhatsApp:</strong> {{ legal.phone }}</li>
        </ul>

        <h2>2. A quién aplica y en qué calidad actuamos</h2>
        <ul>
          <li>
            <strong>Clínicas, veterinarios y su personal</strong> que se registran en VetPro: VetPro es
            <em>responsable</em> de los datos de su cuenta (registro, acceso, facturación de la suscripción).
          </li>
          <li>
            <strong>Tutores de mascotas registrados por una clínica</strong>: la clínica es la <em>responsable</em> de esos
            datos y VetPro actúa como <em>encargado</em>, es decir, los trata por cuenta de la clínica y según sus
            instrucciones. Las solicitudes sobre esos datos pueden dirigirse a la clínica o a VetPro, que las trasladará.
          </li>
          <li>
            <strong>Tutores que usan el directorio de veterinarios</strong> para buscar, agendar o pagar una cita: VetPro es
            responsable de los datos de la reserva y los comparte con el veterinario o la clínica elegidos para prestar el
            servicio.
          </li>
        </ul>

        <h2>3. Datos que tratamos</h2>
        <ul>
          <li><strong>Identificación y contacto:</strong> nombre, documento, correo, teléfono, dirección, municipio.</li>
          <li><strong>Datos profesionales:</strong> tarjeta profesional COMVEZCOL, especialidades y documentos cargados para verificar la matrícula.</li>
          <li><strong>Mascotas e historia clínica veterinaria:</strong> datos del paciente, consultas, diagnósticos, vacunas, fórmulas, hospitalización, laboratorio y consentimientos firmados.</li>
          <li><strong>Dictados de voz</strong> que el veterinario graba en la Bitácora IA para redactar la historia clínica.</li>
          <li><strong>Facturación y pagos:</strong> facturas, abonos y estado de los pagos. Los datos de tarjetas y cuentas bancarias los recibe y procesa directamente la pasarela de pagos; VetPro no los guarda.</li>
          <li><strong>Datos técnicos:</strong> registros de acceso y errores, dirección IP y almacenamiento local del navegador necesario para mantener la sesión.</li>
        </ul>
        <p>
          VetPro no está dirigido a menores de edad y no recolecta datos sensibles de las personas (como datos de salud
          humana o biométricos). La información clínica corresponde a animales.
        </p>

        <h2>4. Finalidades</h2>
        <ul>
          <li>Prestar el servicio: agenda, historia clínica, facturación, inventario, hospitalización, portal del tutor y directorio.</li>
          <li>Redactar historias clínicas a partir del dictado mediante servicios de inteligencia artificial.</li>
          <li>Enviar recordatorios de citas y vacunas, y comunicaciones del servicio por correo o WhatsApp.</li>
          <li>Verificar la matrícula profesional de los veterinarios para proteger a los tutores.</li>
          <li>Procesar pagos de citas y suscripciones.</li>
          <li>Dar soporte, garantizar la seguridad, prevenir fraude y cumplir obligaciones legales y tributarias.</li>
        </ul>

        <h2>5. Proveedores y transferencias internacionales</h2>
        <p>
          Para prestar el servicio compartimos datos con los siguientes encargados, que solo pueden usarlos para las
          finalidades indicadas. Algunos están fuera de Colombia, por lo que al aceptar esta política usted autoriza la
          transmisión internacional de sus datos a esos países:
        </p>
        <ul>
          <li><strong>{{ legal.hostingProvider }}</strong>: servidor donde funciona VetPro y se guarda la base de datos.</li>
          <li><strong>OpenAI (Estados Unidos)</strong>: transcripción de los dictados de voz.</li>
          <li><strong>Anthropic (Estados Unidos)</strong>: organización del dictado en formato de historia clínica.</li>
          <li><strong>Wompi – Bancolombia (Colombia)</strong>: procesamiento de pagos.</li>
          <li><strong>Meta – WhatsApp (Estados Unidos)</strong>: envío de recordatorios, cuando la clínica lo activa.</li>
          <li><strong>Google (Estados Unidos)</strong>: envío de correos electrónicos.</li>
          <li><strong>Sentry (Estados Unidos)</strong>: registro de errores técnicos.</li>
        </ul>

        <h2>6. Derechos del titular</h2>
        <p>Como titular de los datos usted puede, de forma gratuita:</p>
        <ul>
          <li>Conocer, actualizar y rectificar sus datos.</li>
          <li>Solicitar prueba de la autorización que otorgó.</li>
          <li>Ser informado sobre el uso que se ha dado a sus datos.</li>
          <li>Revocar la autorización y solicitar la supresión de sus datos, cuando no exista un deber legal o contractual de conservarlos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite ante nosotros.</li>
        </ul>

        <h2>7. Cómo ejercer sus derechos</h2>
        <ul>
          <li>Escriba a <strong>{{ legal.privacyEmail }}</strong> indicando su nombre, documento, la solicitud y un medio de respuesta.</li>
          <li><strong>Consultas:</strong> respondemos en máximo 10 días hábiles, prorrogables 5 días hábiles más con aviso.</li>
          <li><strong>Reclamos</strong> (corrección, actualización, supresión o incumplimiento): respondemos en máximo 15 días hábiles, prorrogables 8 días hábiles más con aviso.</li>
        </ul>

        <h2>8. Eliminación de la cuenta</h2>
        <p>
          Puede eliminar su cuenta en cualquier momento desde la aplicación o solicitarlo en
          <a routerLink="/eliminar-cuenta">la página de eliminación de cuenta</a>. Al hacerlo:
        </p>
        <ul>
          <li><strong>Personal de clínica:</strong> se cierra el acceso y se borran correo, teléfono, documento, dirección y documentos cargados. El nombre se conserva solo como autor de las historias clínicas que firmó, que la clínica debe guardar.</li>
          <li><strong>Última persona con acceso a una clínica:</strong> toda la información de la clínica se borra de forma definitiva 30 días después, plazo en el que puede pedirnos una copia.</li>
          <li><strong>Tutores:</strong> se cierra el acceso al portal y se borran sus datos de contacto. Si existen facturas a su nombre, se conservan nombre y documento durante el tiempo que exige la ley tributaria.</li>
        </ul>

        <h2>9. Conservación</h2>
        <p>
          Conservamos los datos mientras la cuenta esté activa y durante el tiempo necesario para cumplir obligaciones
          legales, como la conservación de facturas. Las copias de seguridad se eliminan de forma automática en un plazo
          máximo de 30 días.
        </p>

        <h2>10. Seguridad</h2>
        <p>
          Usamos conexiones cifradas, contraseñas protegidas con algoritmos de un solo sentido, separación de la
          información entre clínicas, control de acceso por roles y registros de auditoría.
        </p>

        <h2>11. Cambios a esta política</h2>
        <p>
          Publicaremos cualquier cambio en esta página y, si es sustancial, lo informaremos por correo o dentro de la
          aplicación antes de aplicarlo.
        </p>
      </article>
    </main>
  `
})
export class PrivacyPolicyComponent {
  readonly legal = LEGAL_INFO;
}
