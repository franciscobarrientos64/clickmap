export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  const cleanUrl = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const host = new URL(cleanUrl).hostname;

  // Prompt compact — keeps input tokens low
  const prompt = `Visit ${cleanUrl} and map all navigable pages by click depth from homepage.
Depth 1=direct from homepage, Depth 2=one intermediate page, Depth 3+=deeper.
Check main nav, footer, CTAs, dropdowns, sidebar links. Visit 2-3 secondary pages.

Respond ONLY with raw JSON (no markdown, no text):
{"siteName":"","rootUrl":"${cleanUrl}","totalDestinations":0,"maxDepth":0,"avgDepth":0,"summary":"","uxVerdict":"","topIssue":"","destinations":[{"url":"","label":"","depth":1,"category":"Main Nav","description":""}]}`;

  const extractJSON = (text) => {
    if (!text) return null;
    try { return JSON.parse(text.trim()); } catch {}
    const clean = text.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(clean); } catch {}
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
    return null;
  };

  try {
    const messages = [{ role: 'user', content: prompt }];
    let finalText = '';

    for (let round = 0; round < 5; round++) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', // faster + lower token cost
          max_tokens: 2000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages,
        }),
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e?.error?.message || `API error ${resp.status}`);
      }

      const data = await resp.json();
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      if (textBlocks.length) finalText = textBlocks.map(b => b.text).join('');

      if (data.stop_reason === 'end_turn') break;
      if (data.stop_reason === 'tool_use') {
        // Only keep last 2 turns to avoid token accumulation
        messages.push({ role: 'assistant', content: data.content });
        if (messages.length > 4) messages.splice(1, messages.length - 4);
        continue;
      }
      break;
    }

    const result = extractJSON(finalText);

    if (!result) {
      return res.status(200).json({
        siteName: host,
        rootUrl: cleanUrl,
        totalDestinations: 0,
        maxDepth: 0,
        avgDepth: 0,
        summary: 'Sitio no auditable.',
        uxVerdict: 'No fue posible acceder al contenido público del sitio. Puede estar inactivo, bloqueado por robots.txt o requerir autenticación.',
        topIssue: 'Sitio no accesible o no indexado públicamente',
        destinations: [],
      });
    }

    if (!result.avgDepth && result.destinations?.length) {
      result.avgDepth = +(result.destinations.reduce((s, d) => s + d.depth, 0) / result.destinations.length).toFixed(1);
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al analizar el sitio' });
  }
}
