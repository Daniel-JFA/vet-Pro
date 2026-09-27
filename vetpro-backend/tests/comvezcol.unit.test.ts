import { describe, it, expect } from 'vitest';
import {
  normalizeCard,
  lastNamesMatch,
  parseResultLinks,
  parseFicha
} from '../src/services/comvezcol.service.js';

const FICHA_HTML = `
<table class="table table-bordered table-success"><tbody>
  <tr><th scope="row">Nombre</th><td>MAR&Iacute;A JOS&Eacute;</td></tr>
  <tr><th scope="row">Apellidos</th><td>G&Oacute;MEZ PE&Ntilde;A</td></tr>
  <tr><th scope="row">Titulo Obtenido</th><td>M</td></tr>
  <tr><th scope="row">Universidad</th><td>Universidad de la Salle</td></tr>
  <tr><th scope="row">Matricula No.</th><td>01234</td></tr>
</tbody></table>`;

describe('ComvezcolService helpers', () => {
  it('normaliza la matrícula a solo dígitos sin ceros a la izquierda', () => {
    expect(normalizeCard('COMVEZCOL-01234')).toBe('1234');
    expect(normalizeCard(' 1234 ')).toBe('1234');
    expect(normalizeCard('abc')).toBe('');
  });

  it('extrae los enlaces a fichas de la página de resultados', () => {
    const html = `<a href="http://administrador.consejoapp.com.co/index.php/consultas/profesionalesD/53/">Ver</a>
                  <a href="http://administrador.consejoapp.com.co/index.php/consultas/profesionalesD/53/">Ver</a>
                  <a href="https://administrador.consejoapp.com.co/index.php/consultas/profesionalesD/7/">Ver</a>`;
    expect(parseResultLinks(html)).toEqual([
      'https://administrador.consejoapp.com.co/index.php/consultas/profesionalesD/53/',
      'https://administrador.consejoapp.com.co/index.php/consultas/profesionalesD/7/'
    ]);
    expect(parseResultLinks('<p>Resultados de búsqueda</p>')).toEqual([]);
  });

  it('lee los campos de la ficha, con entidades HTML', () => {
    const f = parseFicha(FICHA_HTML, 'u');
    expect(f.nombre).toBe('MARIA JOSE');
    expect(f.matricula).toBe('01234');
    expect(normalizeCard(f.matricula)).toBe('1234');
    expect(f.universidad).toBe('Universidad de la Salle');
  });

  it('compara apellidos sin importar tildes ni mayúsculas', () => {
    expect(lastNamesMatch('Gómez Peña', 'GOMEZ PEÑA')).toBe(true);
    expect(lastNamesMatch('gomez', 'GOMEZ PEÑA')).toBe(true);
    expect(lastNamesMatch('Gómez Ruiz', 'GOMEZ PEÑA')).toBe(false);
    expect(lastNamesMatch('', 'GOMEZ')).toBe(false);
  });
});
