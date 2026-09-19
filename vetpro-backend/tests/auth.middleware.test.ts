import { describe, it, expect, vi } from 'vitest';
import { authMiddleware } from '../src/middleware/auth.js';
import { roleMiddleware } from '../src/middleware/role.js';
import { PERMISSIONS as P } from '../src/config/permissions.js';
import { TokenService } from '../src/services/token.service.js';

function run(mw: any, req: any) {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  const next = vi.fn();
  mw(req, res, next);
  return { res, next };
}

const bearer = (t: string) => ({ headers: { authorization: `Bearer ${t}` } });

describe('authMiddleware', () => {
  it('sin token responde 401', () => {
    expect(run(authMiddleware, { headers: {} }).res.statusCode).toBe(401);
  });

  it('token inválido o expirado responde 401 (para que el front cierre sesión)', () => {
    expect(run(authMiddleware, bearer('basura')).res.statusCode).toBe(401);
  });

  it('token de tutor no entra a rutas de clínica', () => {
    const t = TokenService.signTutorSession({ id: 't', phone: '1', clinicId: 'c', role: 'tutor' });
    const { res, next } = run(authMiddleware, bearer(t));
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token de personal válido pasa y expone req.user', () => {
    const t = TokenService.signStaff({ id: 'u', email: 'a@b.co', role: 'vet', clinicId: 'c1' });
    const req: any = bearer(t);
    const { next } = run(authMiddleware, req);
    expect(next).toHaveBeenCalled();
    expect(req.user.clinicId).toBe('c1');
  });
});

describe('matriz de permisos', () => {
  const can = (group: readonly string[], role: string) =>
    run(roleMiddleware([...group]), { user: { role } }).next.mock.calls.length === 1;

  it('solo el admin puede anular facturas', () => {
    expect(can(P.ADMIN, 'admin')).toBe(true);
    for (const r of ['vet', 'assistant', 'receptionist', 'groomer', 'walker']) expect(can(P.ADMIN, r)).toBe(false);
  });

  it('facturación: admin, vet y recepción; no groomer, asistente ni paseador', () => {
    for (const r of ['admin', 'vet', 'receptionist']) expect(can(P.BILLING, r)).toBe(true);
    for (const r of ['assistant', 'groomer', 'walker']) expect(can(P.BILLING, r)).toBe(false);
  });

  it('borrar pacientes: solo admin y vet', () => {
    for (const r of ['admin', 'vet']) expect(can(P.PATIENT_DELETE, r)).toBe(true);
    for (const r of ['assistant', 'receptionist', 'groomer', 'walker']) expect(can(P.PATIENT_DELETE, r)).toBe(false);
  });

  it('los paseadores no leen pacientes, tutores ni citas', () => {
    expect(can(P.CLINIC_READ, 'walker')).toBe(false);
    expect(can(P.CLINIC_READ, 'receptionist')).toBe(true);
  });

  it('el groomer puede consultar pero no crear ni editar pacientes', () => {
    expect(can(P.CLINIC_READ, 'groomer')).toBe(true);
    expect(can(P.FRONT_DESK, 'groomer')).toBe(false);
  });

  it('un usuario sin sesión recibe 401', () => {
    expect(run(roleMiddleware(['admin']), {}).res.statusCode).toBe(401);
  });
});
