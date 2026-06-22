const DEFAULT_MODEL = 'openrouter/free';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_RECENT_EXPENSES = 20;
const MAX_CATEGORIES = 20;
const MAX_PAYLOAD_BYTES = 50_000;

const SYSTEM_PROMPT = `You are PaceMint's budgeting chatbot. Give concise, practical spending guidance using only the provided budget context. Do not claim to be a financial advisor. Do not invent transactions. Do not make database changes. If context is insufficient, say what is missing.`;

export function validateChatPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, status: 400, message: 'Request body must be a JSON object.' };
  }

  if (typeof payload.message !== 'string' || payload.message.trim().length === 0) {
    return { ok: false, status: 400, message: 'Message is required.' };
  }

  if (payload.message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, status: 400, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
    return { ok: false, status: 413, message: 'Chat request is too large.' };
  }

  return { ok: true };
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? '').slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

function sanitizeContext(context) {
  const source = context && typeof context === 'object' ? context : {};
  const recentExpenses = Array.isArray(source.recentExpenses) ? source.recentExpenses : [];

  return {
    period: {
      mode: String(source.period?.mode ?? 'monthly'),
      start: String(source.period?.start ?? ''),
      end: String(source.period?.end ?? ''),
      label: String(source.period?.label ?? '')
    },
    summary: source.summary ?? {},
    categories: Array.isArray(source.categories) ? source.categories.slice(0, MAX_CATEGORIES) : [],
    recurringTotal: Number(source.recurringTotal ?? 0),
    recentExpenses: recentExpenses.slice(0, MAX_RECENT_EXPENSES)
  };
}

export function buildOpenRouterMessages(payload) {
  const context = sanitizeContext(payload.context);
  const history = sanitizeHistory(payload.history);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Budget context for the selected period:\n${JSON.stringify(context, null, 2)}`
    },
    ...history,
    { role: 'user', content: payload.message.trim() }
  ];
}

export async function requestOpenRouterChat(payload, env = process.env, fetchImpl = fetch) {
  const validation = validateChatPayload(payload);
  if (!validation.ok) {
    return { ok: false, status: validation.status, error: validation.message };
  }

  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, status: 500, error: 'OpenRouter API key is not configured.' };
  }

  const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
      'X-OpenRouter-Title': env.OPENROUTER_APP_NAME ?? 'PaceMint'
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      messages: buildOpenRouterMessages(payload),
      max_tokens: 600,
      temperature: 0.4
    })
  });

  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        error: 'The free OpenRouter model is rate-limited right now. Please come back later to use the chat feature.'
      };
    }

    return {
      ok: false,
      status: response.status,
      error: data?.error?.message ?? 'The AI service is unavailable.'
    };
  }

  return {
    ok: true,
    status: 200,
    answer: data?.choices?.[0]?.message?.content ?? 'No answer returned.',
    model: data?.model ?? env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    usage: data?.usage ?? null
  };
}
