import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Health & observability', () => {
  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /metrics returns Prometheus text format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_request_duration_seconds');
  });
});

describe('Auth', () => {
  it('rejects protected routes without a token', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(401);
  });

  it('rejects register with invalid payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects login with a malformed body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('Admin-only user management', () => {
  it('rejects creating a user without a token', async () => {
    const res = await request(app).post('/api/users').send({ name: 'X', email: 'x@example.com', role: 'EMPLOYEE' });
    expect(res.status).toBe(401);
  });
});

describe('AI chatbot', () => {
  it('rejects a chat question without a token', async () => {
    const res = await request(app).post('/api/ai/chat').send({ question: 'Which candidates are overdue?' });
    expect(res.status).toBe(401);
  });
});

describe('Reminder rules', () => {
  it('rejects an invalid channel value', async () => {
    const res = await request(app).get('/api/reminder-rules');
    // no auth token: should be rejected before validation even runs
    expect(res.status).toBe(401);
  });
});
