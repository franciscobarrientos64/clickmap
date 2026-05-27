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

  const prompt = `Eres un auditor UX experto en arquitectura de información y navegación web.
Analiza el sitio: ${cleanUrl}

MISIÓN: Mapear TODOS los destinos navegables y su profundidad de clicks desde la homepage.

PROCESO:
1. Visita la homepage en ${cleanUrl}
2. Extrae TODOS los enlaces: nav principal, sub-menús, dropdowns, footer, CTAs, sidebars
3. Profundidad 1 = accesible directamente desde homepage (un click)
4. Profundidad 2 = requiere navegar a una página intermedia primero
5. Profundidad 3+ = requiere múltiples pasos intermedios
6. Visita 2-3 páginas secundarias clave para descubrir sus sub-páginas
7. Sé exhaustivo — busca mínimo 15-30 páginas

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional:
{
  "siteName": "nombre del sitio",
  "rootUrl": "${cleanUrl}",
  "totalDestinations": número,
  "maxDepth": número,
  "avgDepth": número_decimal,
  "summary": "Una frase sobre la complejidad de navegación",
  "uxVerdict": "Diagnóstico UX concreto: ¿eficiente o no? ¿qué problema específico tiene?",
  "topIssue": "El problema de navegación más crítico (máx 15 palabras)",
  "destinations": [
    {
      "url": "url_completa",
      "label": "Nombre de la página",
      "depth": 1,
      "category": "Main Nav|Sub-menu|Footer|CTA|Sidebar|Otro",
      "description": "qué contiene (máx 10 palabras)"
    }
  ]
}

Ordena destinations por depth ascendente.`;

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
        // server-side tool — continue without explicit tool_result
        continue;
      }
      break;
    }

    const match = finalText.match(/\{[\s\S]*\}/);
    if (!match) return res.status(422).json({ error: 'No se pudo estructurar el análisis. Intenta con otra URL.' });

    const result = JSON.parse(match[0]);
    if (!result.avgDepth && result.destinations?.length) {
      result.avgDepth = +(result.destinations.reduce((s, d) => s + d.depth, 0) / result.destinations.length).toFixed(1);
    }
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al analizar el sitio' });
  }
}
