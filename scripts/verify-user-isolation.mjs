import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY for the staging project.');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const password = `Isolation-${randomUUID()}-Aa1!`;
const emails = [`isolation-a-${randomUUID()}@example.invalid`, `isolation-b-${randomUUID()}@example.invalid`];
const users = [];

try {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push(data.user);
  }

  const clients = await Promise.all(
    emails.map(async (email) => {
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return client;
    })
  );

  const rowId = randomUUID();
  const { error: insertError } = await clients[0].from('one_time_income').insert({
    id: rowId,
    user_id: users[0].id,
    month_key: '2026-06',
    enc_payload: 'isolation-test',
    created_at: new Date().toISOString()
  });
  if (insertError) throw insertError;

  const { data: leakedRows, error: readError } = await clients[1].from('one_time_income').select('id').eq('id', rowId);
  if (readError) throw readError;
  if (leakedRows.length !== 0) throw new Error('RLS failure: User B read User A data.');

  const { data: changedRows, error: updateError } = await clients[1]
    .from('one_time_income')
    .update({ enc_payload: 'tampered' })
    .eq('id', rowId)
    .select('id');
  if (updateError) throw updateError;
  if (changedRows.length !== 0) throw new Error('RLS failure: User B updated User A data.');

  const { data: deletedRows, error: deleteError } = await clients[1]
    .from('one_time_income')
    .delete()
    .eq('id', rowId)
    .select('id');
  if (deleteError) throw deleteError;
  if (deletedRows.length !== 0) throw new Error('RLS failure: User B deleted User A data.');

  console.log('PASS: independent-account read, update, and delete isolation verified.');
} finally {
  await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)));
}
