// Netlify serverless function: postcard-states.js
// Logs into postcards.fieldteam6.org (Flask/PersonToPerson app) and returns campaign list.
// Credentials stored as Netlify environment variables, never in code.

exports.handler = async function(event, context) {
    const BASE = 'https://postcards.fieldteam6.org';
    const EMAIL = process.env.POSTCARD_EMAIL;
    const PASSWORD = process.env.POSTCARD_PASSWORD;

    if (!EMAIL || !PASSWORD) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Credentials not configured in environment variables.' })
        };
    }

    try {
        // ── Step 1: GET /login to obtain session cookie + CSRF token ──
        const loginPageRes = await fetch(`${BASE}/login`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
        });

        const loginPageHtml = await loginPageRes.text();
        const setCookieRaw = loginPageRes.headers.get('set-cookie') || '';
        const sessionCookie = setCookieRaw.split(';')[0]; // e.g. session=eyJ...

        if (!sessionCookie) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'No session cookie from login page. Status: ' + loginPageRes.status })
            };
        }

        // Extract csrf_token from the hidden input in the login form
        // Flask-WTF puts it as: <input id="csrf_token" name="csrf_token" type="hidden" value="...">
        const csrfMatch = loginPageHtml.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/) ||
                          loginPageHtml.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/);

        if (!csrfMatch) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Could not find csrf_token in login form.',
                    status: loginPageRes.status,
                    preview: loginPageHtml.substring(0, 400)
                })
            };
        }

        const csrfToken = csrfMatch[1];

        // ── Step 2: POST credentials to /login ──
        const loginBody = new URLSearchParams({
            'csrf_token': csrfToken,
            'email': EMAIL,
            'password': PASSWORD,
            'next': ''
        });

        const loginRes = await fetch(`${BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': sessionCookie,
                'User-Agent': 'Mozilla/5.0',
                'Referer': `${BASE}/login`
            },
            body: loginBody.toString(),
            redirect: 'manual' // Catch the redirect so we can grab the new session cookie
        });

        // Get the authenticated session cookie from the POST response
        const authCookieRaw = loginRes.headers.get('set-cookie') || '';
        const authCookie = authCookieRaw.split(';')[0];

        // If no new cookie, the login may have failed — try using original session anyway
        const cookieToUse = authCookie || sessionCookie;

        if (!authCookie) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    error: 'Login POST did not return a new session cookie — credentials may be wrong.',
                    loginStatus: loginRes.status
                })
            };
        }

        // ── Step 3: Fetch /select_campaign with authenticated session ──
        const campaignRes = await fetch(`${BASE}/select_campaign`, {
            headers: {
                'Cookie': cookieToUse,
                'User-Agent': 'Mozilla/5.0'
            },
            redirect: 'follow'
        });

        if (!campaignRes.ok) {
            return {
                statusCode: campaignRes.status,
                body: JSON.stringify({ error: 'Campaign page returned ' + campaignRes.status + '. Final URL: ' + campaignRes.url })
            };
        }

        const campaignHtml = await campaignRes.text();

        // Verify we actually got the campaign page (not redirected back to login)
        if (campaignRes.url.includes('/login') || campaignHtml.includes('Log In') && !campaignHtml.includes('select_campaign')) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Redirected to login — authentication failed. Final URL: ' + campaignRes.url })
            };
        }

        // ── Step 4: Parse campaign <option> elements ──
        // Options look like: <option value="1">AZ-01 - Voter Registration Outreach - ...</option>
        const optionMatches = [...campaignHtml.matchAll(/<option[^>]*>([^<]+)<\/option>/g)];
        const options = optionMatches
            .map(m => m[1].trim())
            .filter(t => t.length > 0 && !t.toLowerCase().includes('select'));

        // Extract unique 2-letter state abbreviations
        const stateSet = new Set();
        options.forEach(text => {
            const match = text.match(/^([A-Z]{2})[\s\-]/);
            if (match) stateSet.add(match[1]);
        });

        const states = Array.from(stateSet).sort();

        if (states.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ states: [], options, warning: 'No state abbreviations found. Check option format.', urlFetched: campaignRes.url })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ states, options })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
