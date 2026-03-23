// Netlify serverless function: ai-check.js
// Proxies AI requests to the Anthropic API server-side.
// Requires ANTHROPIC_API_KEY environment variable set in Netlify dashboard.
// Usage: POST /.netlify/functions/ai-check { "prompt": "...", "mcp_servers": [...], "model": "...", "max_tokens": N }

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
    }

    let prompt, mcpServers, model, maxTokens;
    try {
        const body = JSON.parse(event.body || '{}');
        prompt = body.prompt;
        mcpServers = body.mcp_servers || null;
        model = body.model || 'claude-haiku-4-5-20251001';
        maxTokens = body.max_tokens || 4000;
    } catch(e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    if (!prompt || typeof prompt !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing prompt parameter' }) };
    }

    try {
        const requestBody = {
            model,
            max_tokens: maxTokens,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages: [{ role: 'user', content: prompt }]
        };

        // Add MCP servers if provided (e.g. Gmail for Blurbinate)
        if (mcpServers && Array.isArray(mcpServers) && mcpServers.length > 0) {
            requestBody.mcp_servers = mcpServers;
        }

        const anthropicHeaders = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };

        // MCP requires beta header
        if (mcpServers && mcpServers.length > 0) {
            anthropicHeaders['anthropic-beta'] = 'mcp-client-1.0';
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: anthropicHeaders,
            body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (!res.ok) {
            return { statusCode: res.status, headers, body: JSON.stringify({ error: data.error || 'Anthropic API error ' + res.status }) };
        }

        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
        return { statusCode: 200, headers, body: JSON.stringify({ text }) };

    } catch(err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
