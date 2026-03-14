// Netlify serverless function: postcard-states.js - DEBUG VERSION
exports.handler = async function(event, context) {
    const BASE = 'https://postcards.fieldteam6.org';
    try {
        const res = await fetch(`${BASE}/login`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow'
        });
        const html = await res.text();
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                status: res.status,
                finalUrl: res.url,
                setCookie: res.headers.get('set-cookie'),
                htmlPreview: html.substring(0, 3000)
            })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
