import { useState, useCallback } from "react";

// ── Depth color system ─────────────────────────────────────────────────────
const DEPTH_CONFIG = {
  1: { bg: "#22c55e", dim: "rgba(34,197,94,0.12)", text: "#fff", border: "rgba(34,197,94,0.4)" },
  2: { bg: "#eab308", dim: "rgba(234,179,8,0.12)",  text: "#000", border: "rgba(234,179,8,0.4)" },
  3: { bg: "#f97316", dim: "rgba(249,115,22,0.12)", text: "#fff", border: "rgba(249,115,22,0.4)" },
};
const depthCfg = (d) =>
  DEPTH_CONFIG[d] ?? { bg: "#ef4444", dim: "rgba(239,68,68,0.12)", text: "#fff", border: "rgba(239,68,68,0.4)" };

function StatCard({ icon, value, label, accent }) {
  return (
    <div style={{
      background: accent ? "rgba(0,210,255,0.05)" : "#111621",
      border: `1px solid ${accent ? "rgba(0,210,255,0.25)" : "#1c2235"}`,
      borderRadius: 12, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: accent ? "#00d2ff" : "#f0f4ff", letterSpacing: "-1px" }}>{value}</span>
      <span style={{ fontSize: 11, color: "#495570", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
    </div>
  );
}

function DepthBar({ depth, count, total }) {
  const cfg = depthCfg(depth);
  const pct = Math.round((count / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: cfg.bg, color: cfg.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800,
      }}>{depth}</div>
      <div style={{ fontSize: 12, color: "#495570", width: 80, flexShrink: 0 }}>
        {count} página{count !== 1 ? "s" : ""}
      </div>
      <div style={{ flex: 1, height: 6, background: "#1c2235", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: cfg.bg, borderRadius: 3, transition: "width .9s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <span style={{ fontSize: 11, color: "#495570", width: 36, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: "#00d2ff",
          display: "inline-block",
          animation: `cmPulse 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  );
}

export default function ClickMap() {
  const [url, setUrl]         = useState("");
  const [busy, setBusy]       = useState(false);
  const [status, setStatus]   = useState("");
  const [results, setResults] = useState(null);
  const [err, setErr]         = useState(null);
  const [filter, setFilter]   = useState("all");
  const [sortBy, setSortBy]   = useState("depth");

  const analyze = useCallback(async () => {
    if (!url.trim() || busy) return;
    const cleanUrl = url.startsWith("http") ? url.trim() : `https://${url.trim()}`;

    setBusy(true); setResults(null); setErr(null); setFilter("all");

    const prompt = `Eres un auditor UX experto en arquitectura de información y navegación web.
Analiza el sitio: ${cleanUrl}

MISIÓN: Mapear TODOS los destinos navegables y su profundidad de clicks desde la homepage.

PROCESO:
1. Visita la homepage en ${cleanUrl}
2. Extrae TODOS los enlaces: nav principal, sub-menús, dropdowns, footer, CTAs, sidebars, breadcrumbs
3. Profundidad 1 = accesible directamente desde homepage (un click)
4. Profundidad 2 = requiere navegar a una página intermedia primero
5. Profundidad 3+ = requiere múltiples pasos intermedios
6. Visita 2-3 páginas clave secundarias para descubrir sus sub-páginas
7. Sé exhaustivo — incluye todo lo que puedas descubrir

Responde ÚNICAMENTE con JSON válido, sin markdown ni texto adicional:
{
  "siteName": "nombre del sitio",
  "rootUrl": "${cleanUrl}",
  "totalDestinations": número,
  "maxDepth": número,
  "avgDepth": número_decimal,
  "summary": "Una frase sobre la complejidad de navegación",
  "uxVerdict": "Diagnóstico UX concreto: ¿eficiente o no? ¿qué problema específico?",
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

Ordena destinations por depth ascendente. Busca mínimo 15-30 páginas.`;

    try {
      const messages = [{ role: "user", content: prompt }];
      let finalText = "";
      let round = 0;

      setStatus("Conectando con el sitio...");

      while (round < 6) {
        round++;
        if (round > 1) setStatus(`Explorando rutas... (ronda ${round})`);

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages,
          }),
        });

        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e?.error?.message || `Error ${res.status}`);
        }

        const data = await res.json();
        const textBlocks = (data.content || []).filter(b => b.type === "text");
        finalText = textBlocks.map(b => b.text).join("");

        if (data.stop_reason === "end_turn") break;
        if (data.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: data.content });
          setStatus("Analizando estructura de navegación...");
          continue;
        }
        break;
      }

      setStatus("Procesando resultados...");
      const match = finalText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No se recibieron datos estructurados. Intenta con otra URL.");

      const parsed = JSON.parse(match[0]);
      if (!parsed.avgDepth && parsed.destinations?.length) {
        parsed.avgDepth = +(parsed.destinations.reduce((s, d) => s + (d.depth || 1), 0) / parsed.destinations.length).toFixed(1);
      }
      setResults(parsed);
    } catch (e) {
      setErr(e.message || "Error al analizar el sitio.");
    } finally {
      setBusy(false); setStatus("");
    }
  }, [url, busy]);

  const destinations = results?.destinations || [];
  const filtered = destinations.filter(d => filter === "all" ? true : d.depth === parseInt(filter));
  const sorted = [...filtered].sort((a, b) => sortBy === "depth" ? a.depth - b.depth : a.label.localeCompare(b.label));
  const depthGroups = destinations.reduce((acc, d) => { acc[d.depth] = (acc[d.depth] || 0) + 1; return acc; }, {});
  const maxDepthVal = results?.maxDepth || 0;
  const filterButtons = ["all", ...Array.from({ length: maxDepthVal }, (_, i) => String(i + 1))];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@400;500;600;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #080b14; min-height: 100vh; }
        input::placeholder { color: #2a3352; }
        input:focus { outline: none; }
        @keyframes cmPulse { 0%,100%{opacity:.25;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes cmFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes cmSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1120; }
        ::-webkit-scrollbar-thumb { background: #1c2235; border-radius: 2px; }
        .cm-btn:hover { opacity: .8; }
        .cm-row:hover { background: rgba(255,255,255,0.025) !important; }
        .cm-filter:hover { border-color: #2a3352 !important; color: #a0aec0 !important; }
      `}</style>

      <div style={{
        fontFamily: "'Outfit', sans-serif",
        background: "#080b14",
        minHeight: "100vh",
        color: "#dde3f5",
        padding: "40px 24px 80px",
        maxWidth: 880,
        margin: "0 auto",
      }}>
        {/* ── Header ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #00d2ff 0%, #0061ff 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0, boxShadow: "0 0 20px rgba(0,210,255,0.25)",
            }}>◈</div>
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: -1,
            }}>ClickMap</span>
            <span style={{
              padding: "3px 9px", borderRadius: 5,
              background: "rgba(0,210,255,0.1)", border: "1px solid rgba(0,210,255,0.2)",
              fontSize: 10, color: "#00d2ff", fontWeight: 700, letterSpacing: "0.06em",
            }}>BETA</span>
          </div>
          <p style={{ fontSize: 13, color: "#3a4560", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Auditoría de profundidad de clicks · UX Navigation Audit
          </p>
        </div>

        {/* ── Input ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: "flex", alignItems: "stretch",
            background: "#111621", border: "1px solid #1c2235",
            borderRadius: 12, overflow: "hidden",
          }}>
            <span style={{
              padding: "0 16px", display: "flex", alignItems: "center",
              fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#2a3352",
              borderRight: "1px solid #1c2235", flexShrink: 0, userSelect: "none",
            }}>https://</span>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyze()}
              placeholder="ejemplo.com"
              style={{
                flex: 1, padding: "16px 16px",
                background: "transparent", border: "none",
                color: "#dde3f5", fontSize: 15,
                fontFamily: "'Space Mono', monospace",
              }}
            />
            <button
              className="cm-btn"
              onClick={analyze}
              disabled={busy}
              style={{
                padding: "0 32px",
                background: busy ? "#1c2235" : "linear-gradient(135deg, #00d2ff, #0061ff)",
                border: "none", cursor: busy ? "not-allowed" : "pointer",
                color: busy ? "#3a4560" : "#fff",
                fontFamily: "'Outfit', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                transition: "all .2s", flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              {busy ? <LoadingDots /> : "ANALIZAR →"}
            </button>
          </div>

          {status && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#00d2ff", opacity: .7, display: "flex", alignItems: "center", gap: 8 }}>
              <LoadingDots /> {status}
            </p>
          )}
        </div>

        {/* ── Error ── */}
        {err && (
          <div style={{
            padding: "14px 18px", borderRadius: 10, marginBottom: 28,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", fontSize: 13,
          }}>⚠ {err}</div>
        )}

        {/* ── Results ── */}
        {results && (
          <div style={{ animation: "cmFadeIn .4s ease" }}>
            <div style={{ marginBottom: 22, paddingBottom: 22, borderBottom: "1px solid #1c2235" }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 5 }}>{results.siteName}</h2>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a4560" }}>{results.rootUrl}</p>
            </div>

            {/* Verdict */}
            <div style={{
              display: "flex", gap: 14, alignItems: "flex-start",
              padding: "16px 20px", borderRadius: 12, marginBottom: 12,
              background: "rgba(0,210,255,0.04)", border: "1px solid rgba(0,210,255,0.12)",
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>◎</span>
              <div>
                <p style={{ fontSize: 13, color: "#a8b4cc", lineHeight: 1.65, marginBottom: results.topIssue ? 10 : 0 }}>
                  {results.uxVerdict || results.summary}
                </p>
                {results.topIssue && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 12px", borderRadius: 6,
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
                    fontSize: 11, color: "#f97316", fontWeight: 600,
                  }}>⚡ {results.topIssue}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 32 }}>
              <StatCard icon="⊕" value={results.totalDestinations} label="Destinos totales" />
              <StatCard icon="▼" value={`${results.maxDepth} clicks`} label="Profundidad máxima" accent />
              <StatCard icon="∅" value={`${results.avgDepth}`} label="Clicks promedio" />
            </div>

            {/* Distribution */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 11, color: "#3a4560", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, fontWeight: 700 }}>
                Distribución por profundidad
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(depthGroups).sort(([a],[b]) => +a - +b).map(([d,c]) => (
                  <DepthBar key={d} depth={+d} count={c} total={destinations.length} />
                ))}
              </div>
            </div>

            {/* Table */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <p style={{ fontSize: 11, color: "#3a4560", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  Páginas detectadas
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {filterButtons.map(f => {
                    const active = filter === f;
                    const cfg = f !== "all" ? depthCfg(+f) : null;
                    return (
                      <button key={f} className="cm-filter" onClick={() => setFilter(f)} style={{
                        padding: "4px 11px", borderRadius: 6,
                        background: active ? (cfg ? cfg.bg : "#1c2235") : "transparent",
                        border: `1px solid ${active ? (cfg ? cfg.bg : "#2a3352") : "#1c2235"}`,
                        color: active ? (cfg ? cfg.text : "#dde3f5") : "#3a4560",
                        fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                        transition: "all .15s",
                      }}>
                        {f === "all" ? "Todas" : `${f} click${f === "1" ? "" : "s"}`}
                      </button>
                    );
                  })}
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                    padding: "4px 8px", background: "#111621", border: "1px solid #1c2235",
                    borderRadius: 6, color: "#3a4560", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <option value="depth">Ordenar: profundidad</option>
                    <option value="label">Ordenar: nombre</option>
                  </select>
                </div>
              </div>

              <div style={{ border: "1px solid #1c2235", borderRadius: 12, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 110px 72px",
                  padding: "10px 18px", background: "#0d1120",
                  borderBottom: "1px solid #1c2235",
                  fontSize: 10, color: "#3a4560", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700,
                  gap: 12,
                }}>
                  <span>Página</span><span>Categoría</span><span style={{textAlign:"center"}}>Clicks</span>
                </div>

                {sorted.length === 0 && (
                  <div style={{ padding: 28, textAlign: "center", fontSize: 13, color: "#3a4560" }}>
                    No hay páginas en este nivel.
                  </div>
                )}

                {sorted.map((dest, i) => {
                  const cfg = depthCfg(dest.depth);
                  return (
                    <div key={i} className="cm-row" style={{
                      display: "grid", gridTemplateColumns: "1fr 110px 72px",
                      padding: "13px 18px", gap: 12, alignItems: "center",
                      borderBottom: i < sorted.length - 1 ? "1px solid #1c2235" : "none",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      transition: "background .15s",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#dde3f5", marginBottom: 2 }}>{dest.label}</p>
                        <p style={{
                          fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#2a3352",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginBottom: dest.description ? 3 : 0,
                        }}>{dest.url}</p>
                        {dest.description && <p style={{ fontSize: 11, color: "#495570" }}>{dest.description}</p>}
                      </div>
                      <div>
                        <span style={{
                          padding: "3px 8px", borderRadius: 4,
                          background: "#1c2235", fontSize: 10, color: "#495570", fontWeight: 500,
                        }}>{dest.category}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <span style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: cfg.dim, border: `1px solid ${cfg.border}`,
                          color: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 800,
                        }}>{dest.depth}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p style={{ marginTop: 24, fontSize: 11, color: "#2a3352", textAlign: "center" }}>
              Análisis generado por IA · Los resultados dependen de la accesibilidad pública del sitio
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!results && !busy && !err && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#2a3352" }}>
            <div style={{ fontSize: 56, marginBottom: 18, opacity: .3 }}>◈</div>
            <p style={{ fontSize: 15, marginBottom: 8, color: "#3a4560" }}>Ingresa una URL para comenzar</p>
            <p style={{ fontSize: 13 }}>Detecta cuántos clicks necesita un usuario para llegar a cada página</p>
          </div>
        )}
      </div>
    </>
  );
}
