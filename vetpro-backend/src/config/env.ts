// Configuración de entorno validada al arrancar. Si falta algo obligatorio el proceso
// no inicia: nunca se usa una clave por defecto para firmar sesiones.
import 'dotenv/config';

const KNOWN_WEAK_JWT_SECRETS = [
  'vetpro_super_secret_signing_key_2026_dev',
  'change-me-in-production'
];

const isProduction = process.env.NODE_ENV === 'production';

function fatal(message: string): never {
  console.error(`FATAL: ${message}`);
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  fatal('JWT_SECRET no está definido. Genera uno con: openssl rand -hex 64');
}

if (isProduction && (jwtSecret.length < 32 || KNOWN_WEAK_JWT_SECRETS.includes(jwtSecret))) {
  fatal('JWT_SECRET de producción es débil o es un valor por defecto conocido. Genera uno con: openssl rand -hex 64');
}

// Pagos en línea (Wompi). Sin las 4 credenciales reales, el servicio caía en
// claves de prueba cuyos secretos están en el código: en producción eso permitía
// falsificar webhooks de "pago aprobado". Ahora los pagos quedan desactivados.
const wompiConfigured = !!(
  process.env.WOMPI_PUBLIC_KEY &&
  process.env.WOMPI_PRIVATE_KEY &&
  process.env.WOMPI_INTEGRITY_SECRET &&
  process.env.WOMPI_EVENTS_SECRET
);

export const env = {
  isProduction,
  JWT_SECRET: jwtSecret,
  /** Checkouts y webhooks de Wompi disponibles (siempre fuera de producción, para sandbox y pruebas) */
  onlinePaymentsEnabled: wompiConfigured || !isProduction,
  /** Endpoints que aprueban pagos sin pasar por Wompi: nunca en producción salvo que se pida explícitamente */
  paymentSimulationAllowed: !isProduction || process.env.ALLOW_PAYMENT_SIMULATION === 'true'
} as const;
