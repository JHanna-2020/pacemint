const MAX_FIELD_LENGTH = 1600;
const MAX_PAYLOAD_BYTES = 10_000;
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

function cleanText(value, maxLength = MAX_FIELD_LENGTH) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function validateFeedbackPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, status: 400, message: 'Request body must be a JSON object.' };
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
    return { ok: false, status: 413, message: 'Feedback request is too large.' };
  }

  const title = cleanText(payload.title, 120);
  const details = cleanText(payload.details);

  if (!title || !details) {
    return { ok: false, status: 400, message: 'A title and details are required.' };
  }

  return { ok: true };
}

export function buildFeedbackSubmission(payload, env = process.env) {
  const title = cleanText(payload.title, 120);
  const details = cleanText(payload.details);
  const area = cleanText(payload.area, 80) || 'Other';
  const impact = cleanText(payload.impact) || 'Not provided';
  const userEmail = cleanText(payload.userEmail, 180) || 'Not provided';
  const submittedFrom = cleanText(payload.submittedFrom, 300) || 'Not provided';

  return {
    access_key: env.WEB3FORMS_ACCESS_KEY,
    subject: `PaceMint feedback: ${title}`,
    from_name: 'PaceMint Feedback',
    to_email: env.FEEDBACK_TO_EMAIL ?? 'hannagonjohn@gmail.com',
    area,
    title,
    details,
    impact,
    account_email: userEmail,
    submitted_from: submittedFrom,
    message: [
      `Feature area: ${area}`,
      `Account email: ${userEmail}`,
      `Submitted from: ${submittedFrom}`,
      '',
      'Suggestion',
      title,
      '',
      'Details',
      details,
      '',
      'Why this would help',
      impact
    ].join('\n')
  };
}

export async function submitFeedback(payload, env = process.env, fetchImpl = fetch) {
  const validation = validateFeedbackPayload(payload);
  if (!validation.ok) {
    return { ok: false, status: validation.status, error: validation.message };
  }

  if (!env.WEB3FORMS_ACCESS_KEY) {
    return { ok: false, status: 500, error: 'Feedback email service is not configured.' };
  }

  const response = await fetchImpl(WEB3FORMS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(buildFeedbackSubmission(payload, env))
  });

  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok || data?.success === false) {
    return {
      ok: false,
      status: response.ok ? 502 : response.status,
      error: data?.message ?? 'Feedback could not be sent right now.'
    };
  }

  return { ok: true, status: 200 };
}
