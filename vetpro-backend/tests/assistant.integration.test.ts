import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { TokenService } from '../src/services/token.service.js';
import { AiService } from '../src/services/ai.service.js';

const token = TokenService.signStaff({ id: 'assistant-test-user', email: 'a@test.co', role: 'admin', clinicId: 'assistant-test-clinic' } as any);

describe('Asistente guía (POST /api/v1/assistant/chat)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exige sesión', async () => {
    const res = await request(app).post('/api/v1/assistant/chat').send({ message: 'hola' });
    expect(res.status).toBe(401);
  });

  it('rechaza mensajes vacíos o demasiado largos', async () => {
    const empty = await request(app).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${token}`).send({ message: '  ' });
    expect(empty.status).toBe(400);
    const long = await request(app).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${token}`).send({ message: 'x'.repeat(501) });
    expect(long.status).toBe(400);
  });

  it('solo navega a rutas internas permitidas', async () => {
    const spy = vi.spyOn(AiService, 'processAssistantCommand');

    spy.mockResolvedValueOnce({ action: 'NAVIGATE', payload: '/patients?search=Luna' });
    const ok = await request(app).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${token}`).send({ message: 'busca a Luna' });
    expect(ok.body).toEqual({ action: 'NAVIGATE', payload: '/patients?search=Luna' });

    spy.mockResolvedValueOnce({ action: 'NAVIGATE', payload: 'https://sitio-malicioso.example' });
    const bad = await request(app).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${token}`).send({ message: 'abre esto' });
    expect(bad.body.action).toBe('REPLY');

    spy.mockResolvedValueOnce({ action: 'NAVIGATE', payload: '/platform/verifications' });
    const notListed = await request(app).post('/api/v1/assistant/chat').set('Authorization', `Bearer ${token}`).send({ message: 'verificaciones' });
    expect(notListed.body.action).toBe('REPLY');
  });
});
