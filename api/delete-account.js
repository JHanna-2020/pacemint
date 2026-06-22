import { authenticateRequest, createAdminClient, tokenIssuedWithin } from '../server/supabaseAuth.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'DELETE') {
    response.setHeader('Allow', 'DELETE');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const auth = await authenticateRequest(request.headers);
  if (!auth.ok) {
    response.status(auth.status).json({ error: auth.error });
    return;
  }
  if (request.body?.confirmation !== 'DELETE') {
    response.status(400).json({ error: 'Type DELETE to confirm account deletion.' });
    return;
  }
  if (!tokenIssuedWithin(auth.token, 600)) {
    response.status(403).json({ error: 'Sign in again before deleting your account.' });
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    response.status(500).json({ error: 'Account deletion is not configured.' });
    return;
  }

  const { error: dataError } = await auth.client.rpc('delete_current_user_data');
  if (dataError) {
    response.status(500).json({ error: 'Account data could not be deleted.' });
    return;
  }

  const { error: userError } = await admin.auth.admin.deleteUser(auth.user.id);
  if (userError) {
    response.status(500).json({ error: 'Data was removed, but the account identity could not be deleted. Contact support.' });
    return;
  }
  response.status(200).json({ ok: true });
}
