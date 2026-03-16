const OWNER = 'Field-Team-6';
const REPO = 'newsletterhelper';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { filename, content } = JSON.parse(event.body || '{}');
  if (!filename || !content) return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename or content' }) };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'No token' }) };
  // Check if file exists to get its SHA
  let sha = undefined;
  const checkResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filename}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (checkResp.ok) {
    const existing = await checkResp.json();
    sha = existing.sha;
  }
  const body = { message: `Add PWA icon: ${filename}`, content };
  if (sha) body.sha = sha;
  const resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filename}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await resp.json();
  return { statusCode: resp.status, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: resp.ok, file: result.content?.name, message: result.message }) };
};
