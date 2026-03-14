// Netlify serverless function: fetch-proof.js
// Fetches a newsletter proof URL server-side and returns the HTML.
// Bypasses browser CORS restrictions and bot-blocking on client-side fetches.
// Always returns the HTTP status so client can distinguish 403/404/etc.
// Usage: POST /.netlify/functions/fetch-proof  { "url": "https://..." }

exports.handler = async function(event, context) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let url;
    try {
        const body = JSON.parse(event.body || '{}');
        url = body.url;
    } catch(e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    if (!url || typeof url !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url parameter' }) };
    }

    if (!/^https?:\/\//i.test(url)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL must start with http:// or https://' }) };
    }

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow'
        });

        const fetchedStatus = res.status;
        const finalUrl = res.url;

        // Always return 200 from our function so the client receives the body.
        // Pass the actual upstream status in the JSON payload so client can act on it.
        let html = '';
        try { html = await res.text(); } catch(_) {}

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                html,
                fetchedStatus,
                finalUrl,
                contentLength: html.length
            })
        };

    } catch(err) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ error: 'Fetch failed: ' + err.message, fetchedStatus: 0 })
        };
    }
};
