import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Cada tipo de sesión lleva su propia "audience": un token emitido para el personal de
// la clínica no valida como token de tutor ni de plataforma, aunque compartan la firma.
const ISSUER = 'vetpro';

const AUDIENCE = {
  staff: 'vetpro:staff',
  refresh: 'vetpro:refresh',
  tutor: 'vetpro:tutor',
  tutorMagicLink: 'vetpro:tutor-magic-link',
  platform: 'vetpro:platform'
} as const;

type Audience = (typeof AUDIENCE)[keyof typeof AUDIENCE];

function sign(payload: object, audience: Audience, expiresIn: jwt.SignOptions['expiresIn']): string {
  return jwt.sign(payload, env.JWT_SECRET, { audience, issuer: ISSUER, expiresIn });
}

function verify<T>(token: string, audience: Audience): T {
  return jwt.verify(token, env.JWT_SECRET, { audience, issuer: ISSUER }) as T;
}

export interface StaffTokenPayload {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  branchId?: string | null;
}

export interface RefreshTokenPayload {
  id: string;
  clinicId: string;
}

export interface TutorTokenPayload {
  id: string;
  phone: string;
  clinicId: string;
  role: 'tutor';
}

export interface PlatformTokenPayload {
  id: string;
  email: string;
  role: 'platform_admin';
}

export const TokenService = {
  signStaff: (payload: StaffTokenPayload) => sign(payload, AUDIENCE.staff, '15m'),
  verifyStaff: (token: string) => verify<StaffTokenPayload>(token, AUDIENCE.staff),

  signRefreshToken: (payload: RefreshTokenPayload) => sign(payload, AUDIENCE.refresh, '7d'),
  verifyRefreshToken: (token: string) => verify<RefreshTokenPayload>(token, AUDIENCE.refresh),

  signTutorMagicLink: (payload: TutorTokenPayload) => sign(payload, AUDIENCE.tutorMagicLink, '1h'),
  verifyTutorMagicLink: (token: string) => verify<TutorTokenPayload>(token, AUDIENCE.tutorMagicLink),

  signTutorSession: (payload: TutorTokenPayload) => sign(payload, AUDIENCE.tutor, '7d'),
  verifyTutorSession: (token: string) => verify<TutorTokenPayload>(token, AUDIENCE.tutor),

  signPlatform: (payload: PlatformTokenPayload) => sign(payload, AUDIENCE.platform, '7d'),
  verifyPlatform: (token: string) => verify<PlatformTokenPayload>(token, AUDIENCE.platform)
};
