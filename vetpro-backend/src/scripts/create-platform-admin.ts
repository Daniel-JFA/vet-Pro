import bcrypt from 'bcryptjs';
import { createInterface } from 'readline';
import { prisma } from '../config/database.js';

/**
 * Crea (o con --reset cambia la contraseña de) un admin de plataforma: el
 * equipo de VetPro que entra a /platform (verificaciones COMVEZCOL,
 * suscripciones, analíticas). No hay otra forma de crearlos desde la app.
 *
 *   npm run platform:create-admin -- --email ana@vetpro.co --name "Ana Pérez"
 *   npm run platform:create-admin -- --email ana@vetpro.co --reset
 *
 * La contraseña se pide sin mostrarla. Para uso no interactivo se puede pasar
 * en la variable PLATFORM_ADMIN_PASSWORD.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    let prompted = false;
    out._writeToOutput = (s: string) => {
      // Muestra la pregunta y oculta lo que se escribe
      if (!prompted) {
        process.stdout.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const reset = process.argv.includes('--reset');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Indica un correo válido con --email');
  }

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing && !reset) throw new Error(`Ya existe un admin de plataforma con ${email}. Usa --reset para cambiar su contraseña.`);
  if (!existing && reset) throw new Error(`No existe un admin de plataforma con ${email}.`);

  let password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden('Contraseña (mínimo 12 caracteres): ');
    const confirm = await askHidden('Repite la contraseña: ');
    if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
  }
  if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    await prisma.platformAdmin.update({ where: { email }, data: { passwordHash, active: true } });
    console.log(`Contraseña actualizada para ${email}.`);
    return;
  }

  const [firstName, ...rest] = (arg('name') || 'Admin VetPro').trim().split(/\s+/);
  await prisma.platformAdmin.create({
    data: { email, passwordHash, firstName, lastName: rest.join(' ') || 'VetPro' }
  });
  console.log(`Admin de plataforma creado: ${email}. Entra en /platform/login.`);
}

main()
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
