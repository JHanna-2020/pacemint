import { describe, expect, it } from 'vitest';
import { buildFeedbackSubmission, submitFeedback, validateFeedbackPayload } from './feedbackService.js';

describe('feedback service', () => {
  it('rejects feedback without a title or details', () => {
    expect(validateFeedbackPayload({ title: '', details: '' })).toEqual({
      ok: false,
      status: 400,
      message: 'A title and details are required.'
    });
  });

  it('rejects oversized feedback payloads', () => {
    expect(validateFeedbackPayload({ title: 'Hello', details: 'x'.repeat(11_000) })).toMatchObject({
      ok: false,
      status: 413
    });
  });

  it('keeps feedback email content structured', () => {
    const submission = buildFeedbackSubmission(
      {
        area: 'AI chatbot',
        title: 'Better category answers',
        details: 'Show the exact categories behind the answer.',
        impact: 'It would make the answer easier to trust.',
        userEmail: 'user@example.com',
        submittedFrom: 'https://pacemint.vercel.app'
      },
      { WEB3FORMS_ACCESS_KEY: 'test-key', FEEDBACK_TO_EMAIL: 'hannagonjohn@gmail.com' }
    );

    expect(submission.access_key).toBe('test-key');
    expect(submission.to_email).toBe('hannagonjohn@gmail.com');
    expect(submission.subject).toBe('PaceMint feedback: Better category answers');
    expect(submission.message).toContain('Feature area: AI chatbot');
  });

  it('handles missing Web3Forms configuration before calling the service', async () => {
    const result = await submitFeedback(
      { title: 'A feature', details: 'Some useful details.' },
      {},
      async () => {
        throw new Error('fetch should not run');
      }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain('not configured');
  });

  it('returns success from a mocked Web3Forms response', async () => {
    const result = await submitFeedback(
      { title: 'A feature', details: 'Some useful details.' },
      { WEB3FORMS_ACCESS_KEY: 'test-key', FEEDBACK_TO_EMAIL: 'hannagonjohn@gmail.com' },
      async () => new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});
