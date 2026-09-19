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

export const env = {
  isProduction,
  JWT_SECRET: jwtSecret
} as const;
