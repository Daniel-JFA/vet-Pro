import ExcelJS from 'exceljs';
import { PatientSex, PatientSpecies, PatientStatus } from '@prisma/client';
import { prisma } from '../config/database.js';

/**
 * Importación del reporte "Mascotas" que exporta OkVet (.xlsx).
 *
 * El reporte trae una fila por mascota con los datos de su tutor. Solo hay
 * fichas: OkVet no incluye historias clínicas, vacunas, citas, facturas ni
 * inventario en este archivo. Lo que no tiene campo propio en VetPro (color,
 * fecha de fallecimiento, teléfono secundario, autorización de datos…) se
 * guarda en las notas para no perder nada.
 *
 * Se puede correr varias veces: el tutor se reconoce por su celular y la
 * mascota por tutor + nombre + especie, así que lo ya importado se omite.
 */

export const OKVET_NOTE_MARK = '[Importado de OkVet]';

// Encabezados del reporte de OkVet. Los obligatorios son el mínimo para
// crear tutor y mascota; el resto se aprovecha si viene.
const COLUMNS = {
  petName: 'Nombre',
  species: 'Especie',
  breed: 'Raza',
  weight: 'Peso',
  sex: 'Género',
  reproductive: 'E.Reproductivo',
  birthDate: 'Nacimiento',
  color: 'Color',
  deceased: 'Fallecido',
  tutorName: 'Nombres',
  idType: 'TIdent',
  idNumber: 'Ident.',
  email: 'Correo',
  mobile: 'Celular',
  phone: 'Teléfono',
  address: 'Dirección',
  contactName: 'Contacto',
  contactPhone: 'TContacto',
  linkedAt: 'Vinculado',
  updatedAt: 'Actualizado',
  consentAt: 'Autorización'
} as const;

type ColumnKey = keyof typeof COLUMNS;
const REQUIRED: ColumnKey[] = ['petName', 'species', 'sex', 'tutorName', 'mobile'];

export class OkVetFormatError extends Error {}

export type OkVetRow = { row: number } & Record<ColumnKey, string>;

export type TutorAction = 'create' | 'existing' | 'same_file';
export type PatientAction = 'create' | 'skip_existing' | 'skip_duplicate_in_file' | 'error';

export interface PlannedRow {
  row: number;
  petName: string;
  species: string;
  tutorName: string;
  tutorPhone: string;
  tutorAction: TutorAction;
  patientAction: PatientAction;
  reason?: string;
  patientNotes: string | null;
  tutorNotes: string | null;
  warnings: string[];
}

export interface OkVetPlan {
  summary: {
    rows: number;
    tutorsToCreate: number;
    tutorsExisting: number;
    patientsToCreate: number;
    patientsSkipped: number;
    errors: number;
  };
  rows: PlannedRow[];
}

// ─── Lectura del archivo ────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/ 00:00:00$/, '');
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text.trim(); // hipervínculo (correos)
    if ('richText' in v) return v.richText.map((t) => t.text).join('').trim();
    if ('result' in v) return String(v.result ?? '').trim(); // fórmula
  }
  return String(v).trim();
}

export async function parseOkVetWorkbook(buffer: Buffer): Promise<OkVetRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    throw new OkVetFormatError('No se pudo leer el archivo. Debe ser el Excel (.xlsx) que exporta OkVet, sin convertirlo a otro formato.');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new OkVetFormatError('El archivo no tiene hojas.');

  // OkVet pone un título en la primera fila; los encabezados van debajo.
  let headerRow = 0;
  let colIndex: Partial<Record<ColumnKey, number>> = {};
  for (let r = 1; r <= Math.min(ws.rowCount, 6) && !headerRow; r++) {
    const found: Partial<Record<ColumnKey, number>> = {};
    ws.getRow(r).eachCell((cell, col) => {
      const h = norm(cellText(cell));
      for (const [key, label] of Object.entries(COLUMNS) as [ColumnKey, string][]) {
        if (h === norm(label) && found[key] === undefined) found[key] = col;
      }
    });
    if (REQUIRED.every((k) => found[k] !== undefined)) {
      headerRow = r;
      colIndex = found;
    }
  }
  if (!headerRow) {
    const expected = REQUIRED.map((k) => `"${COLUMNS[k]}"`).join(', ');
    throw new OkVetFormatError(
      `Este archivo no tiene el formato del reporte de Mascotas de OkVet. Deben venir al menos las columnas ${expected}.`
    );
  }

  const rows: OkVetRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    const item = { row: r } as OkVetRow;
    for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
      const col = colIndex[key];
      item[key] = col ? cellText(excelRow.getCell(col)) : '';
    }
    if ((Object.keys(COLUMNS) as ColumnKey[]).every((k) => !item[k])) continue;
    rows.push(item);
  }
  if (rows.length === 0) throw new OkVetFormatError('El archivo tiene los encabezados de OkVet pero ninguna mascota.');
  return rows;
}

// ─── Conversión de campos ───────────────────────────────────────────────

/** Llave para reconocer un teléfono colombiano: últimos 10 dígitos. */
export function phoneKey(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Nombre completo → nombre y apellidos.
 * 2 palabras: 1 nombre + 1 apellido. 3: 1 nombre + 2 apellidos.
 * 4 o más: los dos últimos son apellidos y el resto nombres.
 */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length === 3) return { firstName: parts[0], lastName: `${parts[1]} ${parts[2]}` };
  return { firstName: parts.slice(0, -2).join(' '), lastName: parts.slice(-2).join(' ') };
}

const SPECIES: Record<string, PatientSpecies> = {
  canino: PatientSpecies.dog,
  perro: PatientSpecies.dog,
  felino: PatientSpecies.cat,
  gato: PatientSpecies.cat,
  conejo: PatientSpecies.rabbit,
  lagomorfo: PatientSpecies.rabbit,
  ave: PatientSpecies.bird,
  aves: PatientSpecies.bird,
  reptil: PatientSpecies.reptile,
  equino: PatientSpecies.horse,
  caballo: PatientSpecies.horse,
  bovino: PatientSpecies.cow,
  porcino: PatientSpecies.pig,
  cerdo: PatientSpecies.pig
};

function parseWeightKg(raw: string): number | null {
  const m = raw.replace(',', '.').match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = norm(m[2] || 'kilogramos');
  let kg: number | null = null;
  if (!unit || unit.startsWith('kilo') || unit === 'kg' || unit === 'kgs') kg = value;
  else if (unit.startsWith('gramo') || unit === 'g' || unit === 'gr') kg = value / 1000;
  else if (unit.startsWith('libra') || unit === 'lb' || unit === 'lbs') kg = value * 0.45359237;
  if (kg === null || !(kg > 0)) return null;
  return Math.round(kg * 1000) / 1000;
}

function parseDate(raw: string): Date | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ConvertedRow {
  source: OkVetRow;
  errors: string[];
  warnings: string[];
  phoneKey: string;
  tutor: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    documentId: string | null;
    address: string | null;
    notes: string;
  };
  patient: {
    name: string;
    species: PatientSpecies;
    breed: string | null;
    birthDate: Date | null;
    sex: PatientSex;
    sterilized: boolean;
    weight: number | null;
    status: PatientStatus;
    notes: string;
  };
}

function convertRow(r: OkVetRow): ConvertedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pNotes: string[] = [OKVET_NOTE_MARK];
  const tNotes: string[] = [OKVET_NOTE_MARK];

  if (!r.petName) errors.push('La mascota no tiene nombre.');
  if (!r.tutorName) errors.push('El tutor no tiene nombre.');
  const key = phoneKey(r.mobile);
  if (key.length < 7) errors.push('El tutor no tiene un celular válido; sin él no se puede reconocer.');

  // Especie
  let species: PatientSpecies = SPECIES[norm(r.species)] ?? PatientSpecies.other;
  if (!SPECIES[norm(r.species)]) {
    if (r.species) pNotes.push(`Especie en OkVet: ${r.species}`);
    warnings.push(`La especie "${r.species || 'vacía'}" no existe en VetPro; queda como "Otra" y la original va en notas.`);
  }

  // Sexo
  const sexNorm = norm(r.sex);
  let sex: PatientSex = PatientSex.male;
  if (sexNorm === 'hembra') sex = PatientSex.female;
  else if (sexNorm !== 'macho') errors.push(`Sexo "${r.sex || 'vacío'}" no reconocido (OkVet usa Macho/Hembra).`);

  // Estado reproductivo
  const repro = norm(r.reproductive);
  const sterilized = repro === 'esterilizado' || repro === 'castrado';
  if (r.reproductive && !['esterilizado', 'castrado', 'no esterilizado', 'entero'].includes(repro)) {
    pNotes.push(`Estado reproductivo en OkVet: ${r.reproductive}`);
  }

  // Peso
  const weight = r.weight ? parseWeightKg(r.weight) : null;
  if (r.weight && weight === null) {
    pNotes.push(`Peso en OkVet: ${r.weight}`);
    warnings.push(`No se pudo interpretar el peso "${r.weight}"; va en notas.`);
  }

  // Fechas
  const birthDate = r.birthDate ? parseDate(r.birthDate) : null;
  if (r.birthDate && !birthDate) pNotes.push(`Nacimiento en OkVet: ${r.birthDate}`);

  let status: PatientStatus = PatientStatus.active;
  if (r.deceased) {
    status = PatientStatus.deceased;
    pNotes.push(`Fallecido el: ${r.deceased}`);
  }
  if (r.color) pNotes.push(`Color: ${r.color}`);
  if (r.linkedAt) pNotes.push(`Registrado en OkVet: ${r.linkedAt}`);
  if (r.updatedAt && r.updatedAt !== r.linkedAt) pNotes.push(`Última actualización en OkVet: ${r.updatedAt}`);

  // Tutor
  const { firstName, lastName } = splitFullName(r.tutorName);

  // OkVet permite registrar el celular como identificación ("Ninguno / Teléfono móvil").
  // En ese caso no hay documento real y se deja vacío.
  let documentId: string | null = null;
  const idIsPhone = !r.idNumber || phoneKey(r.idNumber) === key || norm(r.idType).startsWith('ninguno');
  if (idIsPhone) {
    tNotes.push(
      `Sin documento de identidad: en OkVet la identificación registrada era el celular${r.idType ? ` (${r.idType})` : ''}. Pídele el documento al tutor en su próxima visita.`
    );
  } else {
    documentId = r.idNumber;
    if (r.idType) tNotes.push(`Tipo de documento en OkVet: ${r.idType}`);
  }

  let email: string | null = null;
  if (r.email) {
    if (EMAIL_RE.test(r.email)) email = r.email.toLowerCase();
    else {
      tNotes.push(`Correo en OkVet (no válido): ${r.email}`);
      warnings.push(`El correo "${r.email}" no es válido; va en notas.`);
    }
  }

  const secondary = phoneKey(r.phone);
  if (secondary && secondary !== key) tNotes.push(`Teléfono secundario: ${r.phone}`);

  const contactKey = phoneKey(r.contactPhone);
  const contactIsTutor = (!r.contactName || norm(r.contactName) === norm(r.tutorName)) && (!contactKey || contactKey === key || contactKey === secondary);
  if (!contactIsTutor) {
    tNotes.push(`Contacto alterno: ${[r.contactName, r.contactPhone].filter(Boolean).join(' · ')}`);
  }
  if (r.consentAt) tNotes.push(`Autorización de tratamiento de datos en OkVet: ${r.consentAt}`);

  return {
    source: r,
    errors,
    warnings,
    phoneKey: key,
    tutor: {
      firstName,
      lastName,
      phone: r.mobile,
      email,
      documentId,
      address: r.address || null,
      notes: tNotes.join('\n')
    },
    patient: {
      name: r.petName.replace(/\s+/g, ' ').trim(),
      species,
      breed: r.breed || null,
      birthDate,
      sex,
      sterilized,
      weight,
      status,
      notes: pNotes.join('\n')
    }
  };
}

// ─── Plan (vista previa) ────────────────────────────────────────────────

interface InternalPlan {
  plan: OkVetPlan;
  // Grupos por tutor con las mascotas a crear, para ejecutar
  groups: Map<string, { existingTutorId: string | null; tutor: ConvertedRow['tutor']; patients: ConvertedRow['patient'][] }>;
}

const patientKey = (name: string, species: PatientSpecies) => `${norm(name)}|${species}`;

async function buildPlan(clinicId: string, rows: OkVetRow[]): Promise<InternalPlan> {
  const converted = rows.map(convertRow);

  const existingTutors = await prisma.tutor.findMany({
    where: { clinicId, deletedAt: null },
    select: { id: true, phone: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' }
  });
  const tutorByPhone = new Map<string, (typeof existingTutors)[number]>();
  for (const t of existingTutors) {
    const k = phoneKey(t.phone);
    if (k && !tutorByPhone.has(k)) tutorByPhone.set(k, t);
  }

  const matchedTutorIds = [...new Set(converted.map((c) => tutorByPhone.get(c.phoneKey)?.id).filter(Boolean) as string[])];
  const existingPatients = matchedTutorIds.length
    ? await prisma.patient.findMany({
        where: { clinicId, tutorId: { in: matchedTutorIds }, deletedAt: null },
        select: { tutorId: true, name: true, species: true }
      })
    : [];
  const existingPatientKeys = new Set(existingPatients.map((p) => `${p.tutorId}|${patientKey(p.name, p.species)}`));

  const groups: InternalPlan['groups'] = new Map();
  const seenInFile = new Set<string>();
  const out: PlannedRow[] = [];

  for (const c of converted) {
    const base = {
      row: c.source.row,
      petName: c.source.petName,
      species: c.source.species,
      tutorName: c.source.tutorName,
      tutorPhone: c.source.mobile,
      patientNotes: c.patient.notes,
      tutorNotes: c.tutor.notes,
      warnings: c.warnings
    };

    if (c.errors.length) {
      out.push({ ...base, tutorAction: 'create', patientAction: 'error', reason: c.errors.join(' ') });
      continue;
    }

    const existing = tutorByPhone.get(c.phoneKey) ?? null;
    let group = groups.get(c.phoneKey);
    let tutorAction: TutorAction;
    if (existing) tutorAction = 'existing';
    else if (group) tutorAction = 'same_file';
    else tutorAction = 'create';

    if (group && norm(`${group.tutor.firstName} ${group.tutor.lastName}`) !== norm(c.source.tutorName)) {
      c.warnings.push(`El celular ya aparece en otra fila con el tutor "${group.tutor.firstName} ${group.tutor.lastName}"; la mascota se asocia a ese tutor.`);
    }
    if (existing && norm(`${existing.firstName} ${existing.lastName}`) !== norm(c.source.tutorName)) {
      c.warnings.push(`En VetPro este celular ya es de "${existing.firstName} ${existing.lastName}"; la mascota se asocia a ese tutor.`);
    }

    const pk = patientKey(c.patient.name, c.patient.species);
    if (existing && existingPatientKeys.has(`${existing.id}|${pk}`)) {
      out.push({ ...base, tutorAction, patientAction: 'skip_existing', reason: 'Esta mascota ya existe en VetPro con este tutor.' });
      continue;
    }
    if (seenInFile.has(`${c.phoneKey}|${pk}`)) {
      out.push({ ...base, tutorAction, patientAction: 'skip_duplicate_in_file', reason: 'La mascota está repetida en el archivo.' });
      continue;
    }
    seenInFile.add(`${c.phoneKey}|${pk}`);

    if (!group) {
      group = { existingTutorId: existing?.id ?? null, tutor: c.tutor, patients: [] };
      groups.set(c.phoneKey, group);
    }
    group.patients.push(c.patient);
    out.push({ ...base, tutorAction, patientAction: 'create' });
  }

  const tutorsToCreate = [...groups.values()].filter((g) => !g.existingTutorId).length;
  const tutorsExisting = [...groups.values()].filter((g) => g.existingTutorId).length;

  return {
    groups,
    plan: {
      summary: {
        rows: out.length,
        tutorsToCreate,
        tutorsExisting,
        patientsToCreate: out.filter((r) => r.patientAction === 'create').length,
        patientsSkipped: out.filter((r) => r.patientAction === 'skip_existing' || r.patientAction === 'skip_duplicate_in_file').length,
        errors: out.filter((r) => r.patientAction === 'error').length
      },
      rows: out
    }
  };
}

export async function previewOkVetImport(clinicId: string, buffer: Buffer): Promise<OkVetPlan> {
  const rows = await parseOkVetWorkbook(buffer);
  return (await buildPlan(clinicId, rows)).plan;
}

export async function applyOkVetImport(clinicId: string, buffer: Buffer) {
  const rows = await parseOkVetWorkbook(buffer);
  const { plan, groups } = await buildPlan(clinicId, rows);

  let tutorsCreated = 0;
  let patientsCreated = 0;
  const failures: { tutorPhone: string; error: string }[] = [];

  // Un tutor con sus mascotas por transacción: si algo falla no queda un
  // tutor a medias, y el resto del archivo sigue.
  for (const [key, g] of groups) {
    try {
      const createdTutor = await prisma.$transaction(async (tx) => {
        let tutorId = g.existingTutorId;
        if (tutorId) {
          // Tutor existente: no se sobrescribe nada; solo se completan campos vacíos
          // y se agregan las notas de OkVet una sola vez.
          const t = await tx.tutor.findUniqueOrThrow({ where: { id: tutorId } });
          const data: Record<string, string> = {};
          if (!t.email && g.tutor.email) data.email = g.tutor.email;
          if (!t.address && g.tutor.address) data.address = g.tutor.address;
          if (!t.documentId && g.tutor.documentId) data.documentId = g.tutor.documentId;
          if (!(t.notes || '').includes(OKVET_NOTE_MARK)) data.notes = [t.notes, g.tutor.notes].filter(Boolean).join('\n\n');
          if (Object.keys(data).length) await tx.tutor.update({ where: { id: tutorId }, data });
        } else {
          const created = await tx.tutor.create({ data: { clinicId, ...g.tutor } });
          tutorId = created.id;
        }
        for (const p of g.patients) {
          await tx.patient.create({ data: { clinicId, tutorId, ...p } });
        }
        return !g.existingTutorId;
      });
      // Se cuenta solo después de confirmar la transacción
      if (createdTutor) tutorsCreated++;
      patientsCreated += g.patients.length;
    } catch (err: any) {
      failures.push({ tutorPhone: g.tutor.phone || key, error: err?.message || 'Error al guardar' });
    }
  }

  return { plan, result: { tutorsCreated, patientsCreated, failures } };
}
