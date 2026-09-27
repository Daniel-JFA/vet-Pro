import { prisma } from '../config/database.js';
import { AntifraudService } from '../services/antifraud.service.js';

async function main() {
  console.log('🚀 Iniciando certificación automática de matrículas COMVEZCOL para veterinarios registrados en VetPro...\n');
  const result = await AntifraudService.verifyAllRegisteredVets();

  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`📊 Total veterinarios analizados   : ${result.totalChecked}`);
  console.log(`✅ Certificados en esta ejecución  : ${result.verifiedCount}`);
  console.log(`ℹ️  Previamente certificados        : ${result.alreadyVerifiedCount}`);
  console.log(`⚠️  Omitidos (sin matrícula válida) : ${result.skippedCount}`);
  console.log(`✉️  Correos de confirmación env.    : ${result.emailsSentCount}`);
  console.log('───────────────────────────────────────────────────────────────────\n');

  console.log('Detalle de veterinarios:');
  result.results.forEach((r, idx) => {
    const icon = r.status === 'verified' ? '✅' : r.status === 'skipped' ? '⚠️' : '❌';
    console.log(
      `${idx + 1}. ${icon} [${r.status.toUpperCase()}] ${r.fullName || 'Veterinario'} (${r.email})` +
      ` | Matrícula: ${r.professionalCard}` +
      ` | Correo enviado: ${r.emailSent ? 'SÍ' : 'NO'}` +
      ` | Nota: ${r.message || ''}`
    );
  });
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando verificación automática:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
