import { submitFeedback } from '../server/feedbackService.js';
import { verifyTurnstile } from '../server/turnstile.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const verification = await verifyTurnstile(request.body?.captchaToken, request.headers['x-forwarded-for']);
  if (!verification.ok) {
    response.status(verification.status).json({ error: verification.error });
    return;
  }

  const result = await submitFeedback(request.body ?? {});
  if (!result.ok) {
    response.status(result.status).json({ error: result.error });
    return;
  }

  response.status(200).json({ ok: true });
}
