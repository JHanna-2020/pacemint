import { createClient } from '@supabase/supabase-js';

function config(env) {
  return {
    url: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
  };
}

export function bearerToken(headers = {}) {
  const value = headers.authorization ?? headers.Authorization;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function tokenIssuedWithin(token, maxAgeSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.iat === 'number' && nowSeconds - payload.iat >= 0 && nowSeconds - payload.iat <= maxAgeSeconds;
  } catch {
    return false;
  }
}

export async function authenticateRequest(headers, env = process.env, createClientImpl = createClient) {
  const token = bearerToken(headers);
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const { url, anonKey } = config(env);
  if (!url || !anonKey) return { ok: false, status: 500, error: 'Server authentication is not configured.' };

  const client = createClientImpl(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: 'Your session is invalid or expired.' };
  return { ok: true, token, user: data.user, client };
}

export async function consumeAiQuota(client, env = process.env) {
  const configured = Number(env.AI_DAILY_REQUEST_LIMIT ?? 20);
  const requestLimit = Number.isFinite(configured) ? Math.max(1, Math.min(Math.floor(configured), 100)) : 20;
  const { data, error } = await client.rpc('consume_ai_daily_quota', { request_limit: requestLimit });
  if (error) return { ok: false, status: 503, error: 'AI usage controls are unavailable.' };
  if (!data) return { ok: false, status: 429, error: 'Your daily AI message limit has been reached.' };
  return { ok: true };
}

export function createAdminClient(env = process.env, createClientImpl = createClient) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClientImpl(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
