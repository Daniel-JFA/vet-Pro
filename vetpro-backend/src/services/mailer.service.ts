import nodemailer, { type Transporter } from 'nodemailer';

export interface NewUserEmailData {
  to: string;
  firstName: string;
  lastName: string;
  clinicName: string;
  role: string;
  branchName?: string | null;
  passwordPlain: string;
}

export interface ActivationEmailData {
  to: string;
  firstName: string;
  lastName: string;
  clinicName: string;
  role: string;
  branchName?: string | null;
  activationLink: string;
}

export interface BetaInviteEmailData {
  to: string;
}

export interface PasswordResetEmailData {
  to: string;
  firstName: string;
  lastName: string;
  clinicName: string;
  newPasswordPlain: string;
}

export interface PasswordRecoveryEmailData {
  to: string;
  firstName: string;
  clinicName: string;
  resetLink: string;
}

export interface MagicLinkEmailData {
  to: string;
  firstName: string;
  clinicName: string;
  magicLink: string;
}

function getRoleLabel(role: string): string {
  const roles: Record<string, string> = {
    admin: '🛡️ Administrador (Gestión Total & Finanzas)',
    vet: '🩺 Médico Veterinario (Consultas, Bitácora IA SOAP, Recetas)',
    assistant: '💉 Auxiliar / Enfermero Veterinario (Kardex, Dosis)',
    receptionist: '💼 Recepcionista / Caja POS (Agendamiento & Facturación)',
    groomer: '✂️ Estilista / Peluquero Canino (Spa & Baños)',
    walker: '🐕 Paseador Canino (Rutas)'
  };
  return roles[role] || role;
}

export class MailerService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });
    }

    return this.transporter;
  }

  private static getBcc(): string | undefined {
    return process.env.EMAIL_BCC || undefined;
  }

  /**
   * Verificar la conectividad y autenticación SMTP
   */
  public static async verifyConnection(): Promise<{ ok: boolean; message?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        ok: false,
        message: 'Credenciales SMTP_USER o SMTP_PASS no configuradas en el archivo .env.'
      };
    }

    try {
      await transporter.verify();
      return { ok: true, message: 'Conexión SMTP establecida y verificada con éxito.' };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || 'Error al autenticar con el servidor de correo SMTP.'
      };
    }
  }

  /**
   * Enviar correo con credenciales de acceso al crear un nuevo usuario
   */
  public static async sendNewUserCredentials(data: NewUserEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const appUrl = process.env.APP_URL || 'http://localhost:4201';
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió correo a', data.to, ': SMTP_USER o SMTP_PASS no configurados.');
      return false;
    }

    const roleText = getRoleLabel(data.role);
    const branchText = data.branchName || 'Operación Central / Global';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .logo-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
        .credentials-card { background: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 24px 0; }
        .cred-row { margin-bottom: 10px; font-size: 13.5px; }
        .cred-row:last-child { margin-bottom: 0; }
        .cred-label { color: #64748b; font-weight: 500; }
        .cred-val { color: #0f172a; font-weight: 700; font-family: monospace; background: #ffffff; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; margin-left: 6px; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; }
        .notice { font-size: 12px; color: #64748b; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 10px 14px; line-height: 1.5; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="logo-badge">VetPro SaaS Cloud</span>
          <h1>¡Bienvenido a ${data.clinicName}!</h1>
        </div>
        <div class="content">
          <p class="greeting">Hola, ${data.firstName} ${data.lastName}:</p>
          <p class="text">
            Tu cuenta de usuario ha sido creada en la plataforma de gestión clínica y hospitalaria <strong>VetPro</strong> por el equipo administrativo de <strong>${data.clinicName}</strong>.
          </p>
          
          <div class="credentials-card">
            <div class="cred-row"><span class="cred-label">Rol Asignado:</span> <strong>${roleText}</strong></div>
            <div class="cred-row"><span class="cred-label">Sede / Cobertura:</span> <strong>${branchText}</strong></div>
            <div class="cred-row"><span class="cred-label">Correo de Acceso:</span> <span class="cred-val">${data.to}</span></div>
            <div class="cred-row"><span class="cred-label">Contraseña Inicial:</span> <span class="cred-val">${data.passwordPlain}</span></div>
          </div>

          <div class="btn-container">
            <a href="${appUrl}/auth/login" class="btn" target="_blank">Acceder al Sistema</a>
          </div>

          <div class="notice">
            🔒 <strong>Recomendación de Seguridad:</strong> Por favor inicia sesión lo antes posible y actualiza tu contraseña desde tu perfil de usuario. Nunca compartas tus credenciales de acceso clínico.
          </div>
        </div>
        <div class="footer">
          Este mensaje fue generado automáticamente por VetPro Cloud para ${data.to}.<br>
          Si no reconoces este registro, puedes contactar al administrador de tu clínica.
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `
¡Bienvenido a ${data.clinicName}!

Hola, ${data.firstName} ${data.lastName}:
Tu cuenta de acceso para VetPro Cloud ha sido creada exitosamente.

Tus credenciales de ingreso son:
- Rol: ${roleText}
- Sede: ${branchText}
- Correo: ${data.to}
- Contraseña: ${data.passwordPlain}

Puedes ingresar desde el siguiente enlace:
${appUrl}/auth/login

Por seguridad, te recomendamos cambiar tu contraseña temporal tras tu primer inicio de sesión.
    `.trim();

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        ...(this.getBcc() ? { bcc: this.getBcc() } : {}),
        subject: `Bienvenido a VetPro — Credenciales de acceso (${data.clinicName})`,
        text: textContent,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Correo con credenciales enviado exitosamente a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar correo de credenciales a ${data.to}:`, error.message);
      return false;
    }
  }

  /**
   * Enviar correo de activación de cuenta — reemplaza el envío de contraseñas
   * en texto plano. El usuario define su propia contraseña al hacer clic en
   * el enlace, así que no hay nada que pueda copiarse mal.
   */
  public static async sendActivationLink(data: ActivationEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió correo de activación a', data.to, ': SMTP_USER o SMTP_PASS no configurados.');
      return false;
    }

    const roleText = getRoleLabel(data.role);
    const branchText = data.branchName || 'Operación Central / Global';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Activa tu cuenta en VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .logo-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
        .info-card { background: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 24px 0; }
        .cred-row { margin-bottom: 10px; font-size: 13.5px; }
        .cred-row:last-child { margin-bottom: 0; }
        .cred-label { color: #64748b; font-weight: 500; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.2px; }
        .notice { font-size: 12px; color: #64748b; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 10px 14px; line-height: 1.5; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="logo-badge">VetPro SaaS Cloud</span>
          <h1>¡Bienvenido a ${data.clinicName}!</h1>
        </div>
        <div class="content">
          <p class="greeting">Hola, ${data.firstName} ${data.lastName}:</p>
          <p class="text">
            Tu cuenta de usuario fue creada en <strong>VetPro</strong> por el equipo administrativo de <strong>${data.clinicName}</strong>. Activa tu cuenta y define tu propia contraseña haciendo clic en el botón de abajo.
          </p>

          <div class="info-card">
            <div class="cred-row"><span class="cred-label">Rol Asignado:</span> <strong>${roleText}</strong></div>
            <div class="cred-row"><span class="cred-label">Sede / Cobertura:</span> <strong>${branchText}</strong></div>
            <div class="cred-row"><span class="cred-label">Correo de Acceso:</span> <strong>${data.to}</strong></div>
          </div>

          <div class="btn-container">
            <a href="${data.activationLink}" class="btn" target="_blank">Activar mi Cuenta</a>
          </div>

          <div class="notice">
            🔒 Este enlace es personal y expira en 7 días. Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
            <span style="word-break: break-all;">${data.activationLink}</span>
          </div>
        </div>
        <div class="footer">
          Este mensaje fue generado automáticamente por VetPro Cloud para ${data.to}.<br>
          Si no reconoces este registro, puedes contactar al administrador de tu clínica.
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `
¡Bienvenido a ${data.clinicName}!

Hola, ${data.firstName} ${data.lastName}:
Tu cuenta en VetPro fue creada. Activa tu cuenta y define tu contraseña en:
${data.activationLink}

Rol: ${roleText}
Sede: ${branchText}
Correo: ${data.to}

Este enlace es personal y expira en 7 días.
    `.trim();

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        ...(this.getBcc() ? { bcc: this.getBcc() } : {}),
        subject: `Activa tu cuenta en VetPro — ${data.clinicName}`,
        text: textContent,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Correo de activación enviado exitosamente a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar correo de activación a ${data.to}:`, error.message);
      return false;
    }
  }

  /**
   * Enviar correo con nueva contraseña cuando el administrador la restablece
   */
  public static async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const appUrl = process.env.APP_URL || 'http://localhost:4201';
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió correo de restablecimiento: SMTP no configurado.');
      return false;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Contraseña Restablecida - VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
        .box { background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .pwd { font-family: monospace; font-size: 16px; font-weight: 700; color: #2563eb; }
        .btn { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="title">Contraseña Restablecida</h2>
        <p>Hola, ${data.firstName} ${data.lastName}:</p>
        <p>El administrador de <strong>${data.clinicName}</strong> ha restablecido tu contraseña de acceso a VetPro.</p>
        <div class="box">
          <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;">Tu nueva contraseña de acceso es:</p>
          <span class="pwd">${data.newPasswordPlain}</span>
        </div>
        <p><a href="${appUrl}/auth/login" class="btn">Iniciar Sesión</a></p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Si no solicitaste este cambio, contacta inmediatamente a tu administrador clínico.</p>
      </div>
    </body>
    </html>
    `;

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        ...(this.getBcc() ? { bcc: this.getBcc() } : {}),
        subject: `Tu contraseña de VetPro ha sido restablecida (${data.clinicName})`,
        text: `Hola ${data.firstName}, tu nueva contraseña para ${data.clinicName} es: ${data.newPasswordPlain}. Accede en ${appUrl}/auth/login`,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Correo de contraseña restablecida enviado a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar restablecimiento a ${data.to}:`, error.message);
      return false;
    }
  }

  /**
   * Enlace de recuperación cuando el usuario olvidó su contraseña.
   * No incluye contraseñas: el usuario define la nueva desde el enlace.
   */
  public static async sendPasswordRecoveryLink(data: PasswordRecoveryEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió correo de recuperación a', data.to, ': SMTP no configurado.');
      return false;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Restablece tu contraseña - VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; }
        .notice { font-size: 12px; color: #64748b; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 10px 14px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="title">Restablece tu contraseña</h2>
        <p>Hola, ${data.firstName}:</p>
        <p>Recibimos una solicitud para restablecer tu contraseña de <strong>VetPro</strong> (${data.clinicName}). Haz clic en el botón para definir una nueva.</p>
        <div class="btn-container">
          <a href="${data.resetLink}" class="btn" target="_blank">Definir nueva contraseña</a>
        </div>
        <div class="notice">
          🔒 Este enlace es personal, sirve una sola vez y expira en 1 hora. Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
          <span style="word-break: break-all;">${data.resetLink}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue funcionando.</p>
      </div>
    </body>
    </html>
    `;

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        subject: 'Restablece tu contraseña de VetPro',
        text: `Hola ${data.firstName}, define tu nueva contraseña de VetPro en: ${data.resetLink}\nEl enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.`,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Correo de recuperación de contraseña enviado a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar recuperación a ${data.to}:`, error.message);
      return false;
    }
  }

  public static async sendMagicLinkEmail(data: MagicLinkEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió enlace de acceso al portal: SMTP no configurado.');
      return false;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Tu acceso al Portal de Tutores - VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }
        .btn { display: inline-block; background: #10b981; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="title">Tu acceso al Portal de Tutores</h2>
        <p>Hola, ${data.firstName}:</p>
        <p><strong>${data.clinicName}</strong> te invita a ingresar a tu portal personal para ver el historial y las citas de tus mascotas.</p>
        <p><a href="${data.magicLink}" class="btn">Ingresar al Portal</a></p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Este enlace es personal, expira en 1 hora y solo puede usarse una vez. Si no solicitaste este acceso, ignora este correo.</p>
      </div>
    </body>
    </html>
    `;

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        ...(this.getBcc() ? { bcc: this.getBcc() } : {}),
        subject: `Tu acceso al Portal de Tutores — ${data.clinicName}`,
        text: `Hola ${data.firstName}, ingresa a tu portal en: ${data.magicLink} (válido por 1 hora, un solo uso).`,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Enlace de acceso al portal enviado a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar enlace de acceso a ${data.to}:`, error.message);
      return false;
    }
  }

  /**
   * Enviar invitación a la fase beta privada — para prospectos que aún no tienen
   * cuenta, invitándolos a registrarse por su cuenta y explorar el sistema.
   */
  public static async sendBetaInviteEmail(data: BetaInviteEmailData): Promise<boolean> {
    const transporter = this.getTransporter();
    const appUrl = process.env.APP_URL || 'https://vetpro.danielflorez.dev';
    const from = process.env.SMTP_FROM || `VetPro SaaS <${process.env.SMTP_USER || 'no-reply@vetpro.co'}>`;

    if (!transporter) {
      console.warn('⚠️ [Mailer] No se envió invitación beta a', data.to, ': SMTP_USER o SMTP_PASS no configurados.');
      return false;
    }

    const registerUrl = `${appUrl}/auth/register`;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tienes acceso anticipado a VetPro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .logo-badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
        .list-card { background: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 24px 0; }
        .list-card p { margin: 0 0 8px; font-size: 13.5px; color: #334155; }
        .list-card p:last-child { margin-bottom: 0; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.2px; }
        .notice { font-size: 13px; color: #0d9488; background: #e6fffa; border: 1px solid rgba(20, 184, 166, 0.2); border-radius: 6px; padding: 12px 14px; line-height: 1.5; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11.5px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="logo-badge">Acceso Anticipado · Beta Privada</span>
          <h1>¡Bienvenido a VetPro!</h1>
        </div>
        <div class="content">
          <p class="greeting">Hola:</p>
          <p class="text">
            Te escribimos porque hoy estás entre el grupo reducido que tiene <strong>acceso anticipado</strong> a VetPro, el nuevo software de gestión veterinaria, antes de su lanzamiento oficial.
          </p>

          <div class="list-card">
            <p>🔍 <strong>Revisa el sistema con calma</strong> — regístrate, entra y cacharrea con lo que quieras: agenda una cita, crea una historia clínica, genera una factura de prueba, explora el portal de tutores.</p>
            <p>💬 <strong>Cuéntanos qué mejorarías</strong> — cualquier cosa que se vea rara, que falte, o que se te ocurra que serviría, compártela en el grupo de WhatsApp donde ya estás. Tu opinión define cómo queda la versión final.</p>
          </div>

          <div class="btn-container">
            <a href="${registerUrl}" class="btn" target="_blank">Registrarme y Explorar VetPro</a>
          </div>

          <div class="notice">
            ✅ El registro es gratuito y toma menos de 2 minutos. No hay problema si algo falla o se ve incompleto — para eso estamos en esta fase de pruebas.
          </div>
        </div>
        <div class="footer">
          Este mensaje fue enviado a ${data.to} como parte del programa de acceso anticipado de VetPro.
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `
¡Bienvenido a VetPro! (Acceso anticipado — Beta privada)

Hola:
Estás entre el grupo reducido que tiene acceso anticipado a VetPro antes del lanzamiento oficial.

Regístrate y explora todo el sistema con calma: agenda una cita, crea una historia clínica, genera una factura de prueba, revisa el portal de tutores.
${registerUrl}

Cualquier cosa que veas que se podría mejorar, cuéntanosla en el grupo de WhatsApp donde ya estás — tu opinión es clave para la versión final.
    `.trim();

    try {
      await transporter.sendMail({
        from,
        to: data.to,
        ...(this.getBcc() ? { bcc: this.getBcc() } : {}),
        subject: `Tienes acceso anticipado a VetPro — cuéntanos qué mejorarías`,
        text: textContent,
        html: htmlContent
      });

      console.log(`✉️ [Mailer] Invitación beta enviada a: ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Mailer] Error al enviar invitación beta a ${data.to}:`, error.message);
      return false;
    }
  }
}
