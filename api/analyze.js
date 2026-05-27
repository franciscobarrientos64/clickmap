export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en Vercel' });
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  const cleanUrl = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;

  const prompt = `Eres un auditor UX especializado en arquitectura de información.
Analiza el sitio web: ${cleanUrl}

TAREA: Mapear todos los destinos navegables y su profundidad de clicks desde la homepage.

PROCESO:
1. Visita ${cleanUrl} y extrae TODOS los enlaces internos
2. Depth 1 = accesible con 1 click desde homepage
3. Depth 2 = requiere pasar por una página intermedia
4. Depth 3+ = múltiples pasos
5. Visita 2-3 páginas secundarias para descubrir sus sub-páginas
6. Si el sitio no es accesible o no tiene contenido público, igual devuelve el JSON con lo que puedas encontrar

REGLA CRÍTICA: Tu respuesta debe ser EXCLUSIVAMENTE el objeto JSON. Sin texto antes, sin texto después, sin markdown, sin bloques de código, sin explicaciones. Solo el JSON crudo.

{"siteName":"nombre","rootUrl":"${cleanUrl}","totalDestinations":0,"maxDepth":0,"avgDepth":0,"summary":"resumen breve","uxVerdict":"diagnóstico UX concreto","topIssue":"problema principal en máx 15 palabras","destinations":[{"url":"url","label":"nombre","depth":1,"category":"Main Nav","description":"descripción breve"}]}

Rellena ese esquema con datos reales del sitio. Si no puedes acceder, pon totalDestinations:0, maxDepth:0 y explica en uxVerdict por qué no es auditable.`;

  const extractJSON = (text) => {
    if (!text) return null;
    // 1. Try direct parse
    try { return JSON.parse(text.trim()); } catch {}
    // 2. Strip markdown fences
    const stripped = text.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(stripped); } catch {}
    // 3. Greedy match first {...}
    const match = text.match(/\{[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    // 4. Find last complete JSON object
    const matches = [...text.matchAll(/\{[\s\S]*?\}/g)];
    for (const m of matches.reverse()) {
      try { const p = JSON.parse(m[0]); if (p.siteName || p.destinations) return p; } catch {}
    }
    return null;
  };

  try {
    const messages = [{ role: 'user', content: prompt }];
    let finalText = '';

    for (let round = 0; round < 8; round++) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages,
        }),
      });

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e?.error?.message || `Anthropic API error ${resp.status}`);
      }

      const data = await resp.json();
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      if (textBlocks.length) finalText = textBlocks.map(b => b.text).join('');

      if (data.stop_reason === 'end_turn') break;
      if (data.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: data.content });
        continue;
      }
      break;
    }

    const result = extractJSON(finalText);

    if (!result) {
      // Last resort: return a structured error response as valid JSON
      return res.status(200).json({
        siteName: new URL(cleanUrl).hostname,
        rootUrl: cleanUrl,
        totalDestinations: 0,
        maxDepth: 0,
        avgDepth: 0,
        summary: 'No se pudo completar el análisis.',
        uxVerdict: 'El sitio no pudo ser auditado. Puede estar inactivo, bloqueado por robots.txt, requerir login, o no tener presencia pública indexable.',
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
