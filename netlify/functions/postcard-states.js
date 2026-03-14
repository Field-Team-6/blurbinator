// Netlify serverless function: postcard-states.js - DEBUG v2
exports.handler = async function(event, context) {
    const BASE = 'https://postcards.fieldteam6.org';
    const EMAIL = process.env.POSTCARD_EMAIL;
    const PASSWORD = process.env.POSTCARD_PASSWORD;

    try {
        // Step 1: GET /login to get session cookie + CSRF token
        const loginPageRes = await fetch(`${BASE}/login`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
        });
        const loginPageHtml = await loginPageRes.text();
        const setCookieRaw = loginPageRes.headers.get('set-cookie') || '';
        const sessionCookie = setCookieRaw.split(';')[0];

        // Decode CSRF from Flask session cookie (base64url JSON payload)
        let csrfFromCookie = null;
        try {
            const sessionVal = sessionCookie.split('=').slice(1).join('=');
            const payloadB64 = sessionVal.split('.')[0];
            const padded = payloadB64 + '=='.slice(0, (4 - payloadB64.length % 4) % 4);
            const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
            csrfFromCookie = decoded.csrf_token;
        } catch(e) { csrfFromCookie = 'decode-error: ' + e.message; }

        // Extract hidden inputs from login form HTML
        const hiddenMatches = [...loginPageHtml.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)];
        const hiddenInputs = hiddenMatches.map(m => {
            const nameM = m[0].match(/name=["']([^"']+)["']/);
            const valM = m[0].match(/value=["']([^"']*)/);
            return { name: nameM ? nameM[1] : null, value: valM ? valM[1].substring(0,40) : null };
        });

        // Also look for csrf_token meta tag
        const csrfMetaMatch = loginPageHtml.match(/name=["']csrf[_-]token["'][^>]*content=["']([^"']+)["']/i) ||
                              loginPageHtml.match(/content=["']([^"']+)["'][^>]*name=["']csrf[_-]token["']/i);

        // Find form action
        const formActionMatch = loginPageHtml.match(/<form[^>]+action=["']([^"']+)["']/i);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                loginStatus: loginPageRes.status,
                finalUrl: loginPageRes.url,
                sessionCookiePreview: sessionCookie.substring(0, 80),
                csrfFromCookie,
                hiddenInputs,
                csrfMeta: csrfMetaMatch ? csrfMetaMatch[1] : null,
                formAction: formActionMatch ? formActionMatch[1] : null,
                htmlSnippet: loginPageHtml.substring(2800, 4000)
            })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
