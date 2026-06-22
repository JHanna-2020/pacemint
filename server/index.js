import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requestOpenRouterChat } from './chatService.js';
import { submitFeedback } from './feedbackService.js';
import { authenticateRequest, consumeAiQuota } from './supabaseAuth.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1';

function loadEnvFile(filename) {
  const envPath = resolve(process.cwd(), filename);
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(response, status, payload) {
  const allowedOrigins = (process.env.CHAT_CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim());
  const requestOrigin = response.req.headers.origin;
  const isLocalDevOrigin = Boolean(requestOrigin?.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/));
  const accessControlOrigin =
    requestOrigin && (allowedOrigins.includes(requestOrigin) || isLocalDevOrigin) ? requestOrigin : allowedOrigins[0];

  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': accessControlOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 50_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST' || (request.url !== '/api/chat' && request.url !== '/api/feedback')) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  try {
    const payload = await readJson(request);
    if (request.url === '/api/chat') {
      const auth = await authenticateRequest(request.headers);
      if (!auth.ok) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const quota = await consumeAiQuota(auth.client);
      if (!quota.ok) {
        sendJson(response, quota.status, { error: quota.error });
        return;
      }
    }
    const result = request.url === '/api/feedback' ? await submitFeedback(payload) : await requestOpenRouterChat(payload);
    if (!result.ok) {
      sendJson(response, result.status, { error: result.error });
      return;
    }
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid request.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PaceMint API listening on http://${HOST}:${PORT}`);
});
