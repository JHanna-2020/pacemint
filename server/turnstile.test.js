import { describe, expect, it } from 'vitest';
import { verifyTurnstile } from './turnstile.js';

describe('Turnstile verification', () => {
  it('is optional in local environments without a secret', async () => {
    await expect(verifyTurnstile(null, null, {}, async () => { throw new Error('not called'); })).resolves.toEqual({
      ok: true,
      configured: false
    });
  });

  it('rejects missing tokens when configured', async () => {
    await expect(verifyTurnstile(null, null, { TURNSTILE_SECRET_KEY: 'secret' })).resolves.toMatchObject({
      ok: false,
      status: 400
    });
  });

  it('accepts successful Cloudflare verification', async () => {
    const result = await verifyTurnstile(
      'token',
      '203.0.113.1',
      { TURNSTILE_SECRET_KEY: 'secret' },
      async () => new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    expect(result).toEqual({ ok: true, configured: true });
  });
});
