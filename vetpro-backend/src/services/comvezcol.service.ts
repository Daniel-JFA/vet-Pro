/**
 * Consulta real del registro público de profesionales de COMVEZCOL
 * (Consejo Profesional de Medicina Veterinaria y de Zootecnia de Colombia):
 * https://administrador.consejoapp.com.co/index.php/consultas/profesionales
 *
 * El buscador es un formulario POST (profesionalesS) que devuelve una tabla de
 * resultados con enlace a la ficha (profesionalesD/{id}/). La ficha trae
 * Nombre, Apellidos, Título, Universidad y "Matricula No.".
 *
 * Solo se considera verificado un profesional cuya ficha tenga exactamente la
 * matrícula declarada Y cuyos apellidos coincidan con los del usuario.
 */

const BASE_URL = process.env.COMVEZCOL_BASE_URL || 'https://administrador.consejoapp.com.co/index.php/consultas/';
const TIMEOUT_MS = Number(process.env.COMVEZCOL_TIMEOUT_MS || 15000);
const MAX_FICHAS = 10;

export type ComvezcolStatus = 'match' | 'not_found' | 'mismatch' | 'error';

export interface ComvezcolFicha {
  url: string;
  nombre: string;
  apellidos: string;
  titulo: string;
  universidad: string;
  matricula: string;
}

export interface ComvezcolResult {
  status: ComvezcolStatus;
  checkedAt: string;
  ficha?: ComvezcolFicha;
  message: string;
}

/** Minúsculas, sin tildes ni signos, espacios simples. */
export function normalizeText(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deja solo los dígitos de una matrícula ("COMVEZCOL-00123" -> "123"). */
export function normalizeCard(card: string | null | undefined): string {
  return (card || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/** Los apellidos coinciden si todos los apellidos del usuario aparecen en la ficha. */
export function lastNamesMatch(userLastName: string, fichaApellidos: string): boolean {
  const user = normalizeText(userLastName).split(' ').filter((w) => w.length > 1);
  const ficha = new Set(normalizeText(fichaApellidos).split(' '));
  return user.length > 0 && user.every((w) => ficha.has(w));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&([aeiouAEIOU])acute;/g, '$1')
    .replace(/&([nN])tilde;/g, (_m, n) => (n === 'n' ? 'ñ' : 'Ñ'))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)));
}

function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Extrae los enlaces a fichas de la página de resultados. */
export function parseResultLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"']*profesionalesD\/\d+\/?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) links.add(m[1].replace(/^http:/, 'https:'));
  return [...links];
}

/** Extrae los pares th/td de la ficha de un profesional. */
export function parseFicha(html: string, url: string): ComvezcolFicha {
  const fields: Record<string, string> = {};
  const re = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) fields[normalizeText(cellText(m[1]))] = cellText(m[2]);
  const get = (prefix: string) => Object.entries(fields).find(([k]) => k.startsWith(prefix))?.[1] || '';
  return {
    url,
    nombre: get('nombre'),
    apellidos: get('apellido'),
    titulo: get('titulo'),
    universidad: get('universidad'),
    matricula: get('matricula')
  };
}

async function fetchText(url: string, init: RequestInit = {}): Promise<{ text: string; cookie?: string }> {
  const res = await fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`COMVEZCOL respondió HTTP ${res.status}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { text: await res.text(), cookie };
}

export class ComvezcolService {
  /**
   * Busca la matrícula en el registro oficial y la compara con los apellidos del usuario.
   * Nunca lanza: los fallos de red se devuelven como status 'error'.
   */
  static async verifyCard(card: string, lastName: string): Promise<ComvezcolResult> {
    const checkedAt = new Date().toISOString();
    const wanted = normalizeCard(card);
    if (!wanted) {
      return { status: 'not_found', checkedAt, message: 'La matrícula no contiene un número.' };
    }

    try {
      const { cookie } = await fetchText(`${BASE_URL}profesionales`);
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (cookie) headers.Cookie = cookie;

      const body = new URLSearchParams({ nombre: '', apellido: '', apellido2: '', cedula: '', matricula: wanted });
      const { text: resultsHtml } = await fetchText(`${BASE_URL}profesionalesS`, { method: 'POST', headers, body });

      const links = parseResultLinks(resultsHtml).slice(0, MAX_FICHAS);
      if (links.length === 0) {
        return { status: 'not_found', checkedAt, message: `La matrícula ${wanted} no aparece en el registro de COMVEZCOL.` };
      }

      let sameCard: ComvezcolFicha | undefined;
      for (const url of links) {
        const { text } = await fetchText(url, { headers: cookie ? { Cookie: cookie } : {} });
        const ficha = parseFicha(text, url);
        if (normalizeCard(ficha.matricula) !== wanted) continue;
        if (lastNamesMatch(lastName, ficha.apellidos)) {
          return {
            status: 'match',
            checkedAt,
            ficha,
            message: `Matrícula ${wanted} confirmada en COMVEZCOL: ${ficha.nombre} ${ficha.apellidos}.`
          };
        }
        sameCard = ficha;
      }

      if (sameCard) {
        return {
          status: 'mismatch',
          checkedAt,
          ficha: sameCard,
          message: `La matrícula ${wanted} existe en COMVEZCOL pero a nombre de otra persona.`
        };
      }
      return { status: 'not_found', checkedAt, message: `La matrícula ${wanted} no aparece en el registro de COMVEZCOL.` };
    } catch (err: any) {
      return {
        status: 'error',
        checkedAt,
        message: `No se pudo consultar COMVEZCOL (${err?.name === 'TimeoutError' ? 'tiempo de espera agotado' : err?.message || 'error de red'}).`
      };
    }
  }
}
