import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { splitFullName, phoneKey, OKVET_NOTE_MARK } from '../src/services/okvet-import.service.js';

const HEADERS = [
  'Nombre', 'Especie', 'Raza', 'Peso', 'Género', 'E.Reproductivo', 'Nacimiento', 'Color', 'Fallecido',
  'Nombres', 'TIdent', 'Ident.', 'Correo', 'Celular', 'Teléfono', 'Dirección', 'Contacto', 'TContacto',
  'Vinculado', 'Actualizado', 'Autorización'
];

// Filas con la misma forma que el reporte de OkVet (datos inventados)
const ROWS: unknown[][] = [
  // Tutor con dos mascotas (mismo celular)
  ['Luna Perez', 'Canino', 'Criollo(a)', '12.5 Kilogramos', 'Hembra', 'Esterilizado', '2020-03-10', 'Negro', null,
    'Ana Maria Perez Gomez', 'Ninguno / Teléfono móvil', '+573001110001', 'ana@test.co', '+573001110001', 3001110009,
    'Calle 1 # 2-3', 'Ana Maria Perez Gomez', 3001110009, '2026-08-01 08:00:00', '2026-08-01 08:00:00', '2026-08-01 08:00:00'],
  ['Michi Perez', 'Felino', 'Criollo(a)', '4 Kilogramos', 'Macho', 'No esterilizado', '2022-05-01', 'Gris', null,
    'Ana Maria Perez Gomez', 'Ninguno / Teléfono móvil', '+573001110001', 'ana@test.co', '+573001110001', 3001110009,
    'Calle 1 # 2-3', 'Ana Maria Perez Gomez', 3001110009, '2026-08-02 08:00:00', '2026-08-02 08:00:00', '2026-08-02 08:00:00'],
  // Fallecida, tutor de 3 palabras
  ['Neko Ruiz', 'Canino', 'Pug', '9 Kilogramos', 'Hembra', 'Esterilizado', '2015-01-15', 'Café', '2026-08-03',
    'Pedro Ruiz Diaz', 'Ninguno / Teléfono móvil', '+573001110002', 'pedro@test.co', '+573001110002', 3001110002,
    'Carrera 4', 'Pedro Ruiz Diaz', 3001110002, '2026-08-03 08:00:00', '2026-08-03 09:00:00', '2026-08-03 08:00:00'],
  // Tutor que ya existe en VetPro (mismo celular con otro formato)
  ['Toby Lopez', 'Canino', 'Beagle', '15 Kilogramos', 'Macho', 'Esterilizado', '2019-07-07', 'Tricolor', null,
    'Carlos Lopez', 'Ninguno / Teléfono móvil', '+573001110003', 'carlos@test.co', '+573001110003', 3001110003,
    'Calle 9', 'Carlos Lopez', 3001110003, '2026-08-04 08:00:00', '2026-08-04 08:00:00', '2026-08-04 08:00:00'],
  // Sexo no reconocido → error visible, no se crea
  ['Rocky Mal', 'Canino', 'Criollo(a)', '10 Kilogramos', 'Desconocido', 'Esterilizado', '2021-01-01', 'Blanco', null,
    'Sofia Mal', 'Ninguno / Teléfono móvil', '+573001110004', '', '+573001110004', 3001110004,
    'Calle 10', 'Sofia Mal', 3001110004, '2026-08-05 08:00:00', '2026-08-05 08:00:00', '2026-08-05 08:00:00']
];

async function okvetXlsx(rows = ROWS): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['OkVet            - Mascotas\n            ']);
  ws.mergeCells(1, 1, 1, HEADERS.length);
  ws.addRow(HEADERS);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('Importación desde OkVet', () => {
  let clinicId: string;
  let token: string;
  let walkerToken: string;
  let existingTutorId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const clinic = await prisma.clinic.create({
      data: { name: `Clínica OkVet ${ts}`, phone: '3000000000', email: `okvet_${ts}@test.com`, address: 'Calle 1', city: 'Medellín', plan: 'pro' }
    });
    clinicId = clinic.id;
    const admin = await prisma.user.create({
      data: { clinicId, firstName: 'Admin', lastName: 'OkVet', email: `admin_okvet_${ts}@test.com`, passwordHash: 'x', role: 'admin' }
    });
    token = TokenService.signStaff({ id: admin.id, email: admin.email, role: 'admin', clinicId, branchId: null });
    const walker = await prisma.user.create({
      data: { clinicId, firstName: 'Walker', lastName: 'OkVet', email: `walker_okvet_${ts}@test.com`, passwordHash: 'x', role: 'walker' }
    });
    walkerToken = TokenService.signStaff({ id: walker.id, email: walker.email, role: 'walker', clinicId, branchId: null });

    const tutor = await prisma.tutor.create({
      data: { clinicId, firstName: 'Carlos', lastName: 'Lopez', phone: '300 111 0003', notes: 'Cliente antiguo' }
    });
    existingTutorId = tutor.id;
  });

  afterAll(async () => {
    await prisma.clinic.delete({ where: { id: clinicId } }).catch(() => undefined);
  });

  it('separa nombres según la cantidad de palabras', () => {
    expect(splitFullName('Carlos Lopez')).toEqual({ firstName: 'Carlos', lastName: 'Lopez' });
    expect(splitFullName('Pedro Ruiz Diaz')).toEqual({ firstName: 'Pedro', lastName: 'Ruiz Diaz' });
    expect(splitFullName('Ana Maria Perez Gomez')).toEqual({ firstName: 'Ana Maria', lastName: 'Perez Gomez' });
    expect(splitFullName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
    expect(phoneKey('+57 300 111 0003')).toBe('3001110003');
  });

  it('rechaza roles sin permiso', async () => {
    const res = await request(app)
      .post('/api/v1/patients/import/okvet?mode=preview')
      .set('Authorization', `Bearer ${walkerToken}`)
      .attach('file', await okvetXlsx(), 'agosto.xlsx');
    expect(res.status).toBe(403);
  });

  it('rechaza un Excel que no tiene el formato de OkVet', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('x').addRow(['Mascota', 'Dueño']);
    const res = await request(app)
      .post('/api/v1/patients/import/okvet?mode=preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(await wb.xlsx.writeBuffer()), 'otro.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/formato del reporte de Mascotas de OkVet/);
  });

  it('la vista previa dice qué va a crear sin guardar nada', async () => {
    const res = await request(app)
      .post('/api/v1/patients/import/okvet?mode=preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await okvetXlsx(), 'agosto.xlsx');
    expect(res.status).toBe(200);
    const { summary, rows } = res.body.data.plan;
    expect(summary).toEqual({ rows: 5, tutorsToCreate: 2, tutorsExisting: 1, patientsToCreate: 4, patientsSkipped: 0, errors: 1 });
    expect(rows[1].tutorAction).toBe('same_file');
    expect(rows[3].tutorAction).toBe('existing');
    expect(rows[4].patientAction).toBe('error');
    expect(rows[4].reason).toMatch(/Sexo/);
    expect(await prisma.patient.count({ where: { clinicId } })).toBe(0);
  });

  it('importa conservando todo y la segunda vez no duplica', async () => {
    const file = await okvetXlsx();
    const res = await request(app)
      .post('/api/v1/patients/import/okvet?mode=apply')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', file, 'agosto.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.data.result).toEqual({ tutorsCreated: 2, patientsCreated: 4, failures: [] });

    // Tutor con dos mascotas
    const ana = await prisma.tutor.findFirstOrThrow({ where: { clinicId, phone: '+573001110001' }, include: { patients: true } });
    expect(ana.firstName).toBe('Ana Maria');
    expect(ana.lastName).toBe('Perez Gomez');
    expect(ana.documentId).toBeNull();
    expect(ana.notes).toContain('Sin documento de identidad');
    expect(ana.notes).toContain('Teléfono secundario: 3001110009');
    expect(ana.notes).toContain('Autorización de tratamiento de datos en OkVet: 2026-08-01 08:00:00');
    expect(ana.patients.map((p) => p.name).sort()).toEqual(['Luna Perez', 'Michi Perez']);
    const luna = ana.patients.find((p) => p.name === 'Luna Perez')!;
    expect(luna).toMatchObject({ species: 'dog', sex: 'female', sterilized: true, weight: 12.5, breed: 'Criollo(a)' });
    expect(luna.birthDate?.toISOString().slice(0, 10)).toBe('2020-03-10');
    expect(luna.notes).toContain('Color: Negro');

    // Fallecida
    const neko = await prisma.patient.findFirstOrThrow({ where: { clinicId, name: 'Neko Ruiz' } });
    expect(neko.status).toBe('deceased');
    expect(neko.notes).toContain('Fallecido el: 2026-08-03');

    // Tutor existente: se le agrega la mascota y conserva sus notas
    const carlos = await prisma.tutor.findUniqueOrThrow({ where: { id: existingTutorId }, include: { patients: true } });
    expect(carlos.patients.map((p) => p.name)).toEqual(['Toby Lopez']);
    expect(carlos.notes).toMatch(/^Cliente antiguo\n\n/);
    expect(carlos.notes).toContain(OKVET_NOTE_MARK);
    expect(carlos.email).toBe('carlos@test.co');
    expect(await prisma.tutor.count({ where: { clinicId } })).toBe(3);

    // Segunda vez: todo se omite
    const again = await request(app)
      .post('/api/v1/patients/import/okvet?mode=apply')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', file, 'agosto.xlsx');
    expect(again.status).toBe(200);
    expect(again.body.data.plan.summary).toMatchObject({ tutorsToCreate: 0, patientsToCreate: 0, patientsSkipped: 4, errors: 1 });
    expect(again.body.data.result).toEqual({ tutorsCreated: 0, patientsCreated: 0, failures: [] });
    expect(await prisma.patient.count({ where: { clinicId } })).toBe(4);
    const carlosAfter = await prisma.tutor.findUniqueOrThrow({ where: { id: existingTutorId } });
    expect(carlosAfter.notes!.split(OKVET_NOTE_MARK).length).toBe(2); // notas no repetidas
  });
});
