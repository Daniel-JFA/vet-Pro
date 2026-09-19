import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { TokenService } from '../src/services/token.service.js';

const staff = { id: 'u1', email: 'vet@clinica.co', role: 'vet', clinicId: 'c1', branchId: null };
const tutor = { id: 't1', phone: '3001234567', clinicId: 'c1', role: 'tutor' as const };
const admin = { id: 'p1', email: 'root@vetpro.co', role: 'platform_admin' as const };

describe('TokenService — aislamiento entre tipos de sesión', () => {
  it('un token de personal valida como personal', () => {
    expect(TokenService.verifyStaff(TokenService.signStaff(staff)).clinicId).toBe('c1');
  });

  it('un token de tutor NO valida como personal ni como plataforma', () => {
    const t = TokenService.signTutorSession(tutor);
    expect(() => TokenService.verifyStaff(t)).toThrow();
    expect(() => TokenService.verifyPlatform(t)).toThrow();
  });

  it('un token de plataforma NO valida como personal ni como tutor', () => {
    const t = TokenService.signPlatform(admin);
    expect(() => TokenService.verifyStaff(t)).toThrow();
    expect(() => TokenService.verifyTutorSession(t)).toThrow();
  });

  it('un token de personal NO valida en el portal del tutor', () => {
    const t = TokenService.signStaff(staff);
    expect(() => TokenService.verifyTutorSession(t)).toThrow();
    expect(() => TokenService.verifyTutorMagicLink(t)).toThrow();
  });

  it('el enlace mágico NO sirve como sesión del portal (ni al revés)', () => {
    expect(() => TokenService.verifyTutorSession(TokenService.signTutorMagicLink(tutor))).toThrow();
    expect(() => TokenService.verifyTutorMagicLink(TokenService.signTutorSession(tutor))).toThrow();
  });

  it('un token sin audience (formato anterior) es rechazado', () => {
    const legacy = jwt.sign({ ...staff }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    expect(() => TokenService.verifyStaff(legacy)).toThrow();
  });

  it('un token firmado con otra clave es rechazado', () => {
    const forged = jwt.sign({ ...staff }, 'otra-clave', { audience: 'vetpro:staff', issuer: 'vetpro' });
    expect(() => TokenService.verifyStaff(forged)).toThrow();
  });
});
