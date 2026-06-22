import { requestOpenRouterChat } from '../server/chatService.js';
import { authenticateRequest, consumeAiQuota } from '../server/supabaseAuth.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const auth = await authenticateRequest(request.headers);
  if (!auth.ok) {
    response.status(auth.status).json({ error: auth.error });
    return;
  }
  const quota = await consumeAiQuota(auth.client);
  if (!quota.ok) {
    response.status(quota.status).json({ error: quota.error });
    return;
  }

  const result = await requestOpenRouterChat(request.body ?? {});
  if (!result.ok) {
    response.status(result.status).json({ error: result.error });
    return;
  }

  response.status(200).json(result);
}
