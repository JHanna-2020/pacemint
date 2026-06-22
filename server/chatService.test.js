import { describe, expect, it } from 'vitest';
import { buildOpenRouterMessages, requestOpenRouterChat, validateChatPayload } from './chatService.js';

describe('chat service', () => {
  it('rejects empty messages', () => {
    expect(validateChatPayload({ message: '' })).toEqual({
      ok: false,
      status: 400,
      message: 'Message is required.'
    });
  });

  it('keeps the budget context summary-first', () => {
    const messages = buildOpenRouterMessages({
      message: 'Can I spend more?',
      context: {
        period: { mode: 'statement', start: '2026-05-16', end: '2026-06-15', label: 'May 16–Jun 15, 2026' },
        summary: { remaining: 100 },
        categories: [{ category: 'Gas', spent: 20 }],
        recurringTotal: 42,
        recentExpenses: Array.from({ length: 25 }, (_, index) => ({ id: index, amount: index }))
      },
      history: []
    });

    const context = JSON.parse(messages[1].content.split('\n').slice(1).join('\n'));

    expect(context.summary.remaining).toBe(100);
    expect(context.period.mode).toBe('statement');
    expect(context.recentExpenses).toHaveLength(20);
  });

  it('handles missing API key before calling OpenRouter', async () => {
    const result = await requestOpenRouterChat(
      { message: 'Hello', context: {}, history: [] },
      {},
      async () => {
        throw new Error('fetch should not run');
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('rejects oversized chat payloads before calling OpenRouter', async () => {
    const result = await requestOpenRouterChat(
      { message: 'Hello', context: { categories: [{ value: 'x'.repeat(51_000) }] }, history: [] },
      { OPENROUTER_API_KEY: 'test-key' },
      async () => {
        throw new Error('fetch should not run');
      }
    );

    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it('returns assistant text from a mocked OpenRouter response', async () => {
    const result = await requestOpenRouterChat(
      { message: 'Hello', context: {}, history: [] },
      { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'openrouter/free' },
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Stay under your daily safe spend.' } }],
            model: 'openrouter/free'
          }),
          { status: 200 }
        )
    );

    expect(result.ok).toBe(true);
    expect(result.answer).toBe('Stay under your daily safe spend.');
  });

  it('returns a clear come-back-later message when rate limited', async () => {
    const result = await requestOpenRouterChat(
      { message: 'Hello', context: {}, history: [] },
      { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'openrouter/free' },
      async () => new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 })
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.error).toContain('come back later');
  });

});
