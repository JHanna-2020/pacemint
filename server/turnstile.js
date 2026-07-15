const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteIp, env = process.env, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.VERCEL) {
      // Vercel sets `VERCEL=1` on every deployed invocation (preview and
      // production). A missing secret there is a misconfiguration, not local
      // dev -- fail closed instead of silently disabling the only
      // bot-protection gate on /api/feedback.
      return { ok: false, status: 503, error: 'Bot-protection is not configured. Try again later.' };
    }
    return { ok: true, configured: false };
  }
  if (!token) return { ok: false, status: 400, error: 'Complete the bot-protection check.' };

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: String(token) });
  if (remoteIp) body.set('remoteip', String(remoteIp).split(',')[0].trim());
  const response = await fetchImpl(VERIFY_ENDPOINT, { method: 'POST', body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) {
    return { ok: false, status: 403, error: 'Bot-protection verification failed. Refresh and try again.' };
  }
  return { ok: true, configured: true };
}
