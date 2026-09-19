// Matriz de permisos por rol (una sola fuente de verdad para las rutas de clínica).
// Roles: admin, vet, assistant, receptionist, groomer, walker.
// Los paseadores (walker) solo usan el módulo de paseos, que valida sus permisos por sí mismo.

const ADMIN = ['admin'];

// Lectura de pacientes, tutores y citas: todo el personal de la clínica salvo paseadores
const CLINIC_READ = ['admin', 'vet', 'assistant', 'receptionist', 'groomer'];

// Crear / editar pacientes, tutores y citas
const FRONT_DESK = ['admin', 'vet', 'assistant', 'receptionist'];

// Borrar pacientes y cancelar citas
const CLINIC_DELETE = ['admin', 'vet', 'receptionist'];
const PATIENT_DELETE = ['admin', 'vet'];

// Facturación, cobros y caja
const BILLING = ['admin', 'vet', 'receptionist'];

// Consentimientos informados (gestión interna; la firma pública usa token)
const CONSENTS = ['admin', 'vet'];

export const PERMISSIONS = {
  ADMIN,
  CLINIC_READ,
  FRONT_DESK,
  CLINIC_DELETE,
  PATIENT_DELETE,
  BILLING,
  CONSENTS
} as const;
