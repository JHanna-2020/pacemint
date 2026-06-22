import { describe, expect, it } from 'vitest';
import { authenticateRequest, bearerToken, consumeAiQuota, tokenIssuedWithin } from './supabaseAuth.js';

describe('server Supabase authentication', () => {
  it('parses only bearer authorization headers', () => {
    expect(bearerToken({ authorization: 'Bearer token-123' })).toBe('token-123');
    expect(bearerToken({ authorization: 'Basic abc' })).toBeNull();
  });

  it('rejects requests without a token before creating a client', async () => {
    const result = await authenticateRequest({}, {}, () => {
      throw new Error('must not create client');
    });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('validates a token with Supabase Auth', async () => {
    const result = await authenticateRequest(
      { authorization: 'Bearer valid-token' },
      { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' },
      () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) } })
    );
    expect(result).toMatchObject({ ok: true, token: 'valid-token', user: { id: 'user-1' } });
  });

  it('enforces the database-backed daily quota result', async () => {
    const accepted = await consumeAiQuota({ rpc: async () => ({ data: true, error: null }) }, {});
    const denied = await consumeAiQuota({ rpc: async () => ({ data: false, error: null }) }, {});
    expect(accepted.ok).toBe(true);
    expect(denied).toMatchObject({ ok: false, status: 429 });
  });

  it('recognizes a recently issued token for destructive account actions', () => {
    const payload = Buffer.from(JSON.stringify({ iat: 1000 })).toString('base64url');
    const token = `header.${payload}.signature`;
    expect(tokenIssuedWithin(token, 600, 1500)).toBe(true);
    expect(tokenIssuedWithin(token, 600, 1700)).toBe(false);
  });
});
