import { useState, useCallback, useEffect, useRef } from "react";

const VERSION = "v1.1.1";

// ── Depth config ───────────────────────────────────────────────────────────
const DEPTH_CONFIG = {
  1: { bg: "#00ff41", dim: "rgba(0,255,65,0.10)", text: "#000", border: "rgba(0,255,65,0.45)" },
  2: { bg: "#00d2ff", dim: "rgba(0,210,255,0.10)", text: "#000", border: "rgba(0,210,255,0.45)" },
  3: { bg: "#f97316", dim: "rgba(249,115,22,0.10)", text: "#fff", border: "rgba(249,115,22,0.45)" },
};
const depthCfg = (d) =>
  DEPTH_CONFIG[d] ?? { bg: "#ef4444", dim: "rgba(239,68,68,0.10)", text: "#fff", border: "rgba(239,68,68,0.45)" };

// ── Matrix Rain Canvas ─────────────────────────────────────────────────────
function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01ハヒフヘホマミムメモ10ヤユヨラリルレロワヲン";
    const fontSize = 13;
    let cols = Math.floor(canvas.width / fontSize);
    let drops = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px 'Space Mono', monospace`;
      for (let i = 0; i < drops.length; i++) {
        const bright = Math.random() > 0.95;
        ctx.fillStyle = bright ? "#afffbf" : "rgba(0,255,65,0.55)";
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      // re-sync cols on resize
      cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);
    };

    const id = setInterval(draw, 45);
    return () => { clearInterval(id); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={ref} style={{
      position: "fixed", top: 0, left: 0,
      width: "100%", height: "100%",
      opacity: 0.18, zIndex: 0, pointerEvents: "none",
    }} />
  );
}

// ── Scanlines overlay ──────────────────────────────────────────────────────
function Scanlines() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
      zIndex: 1, pointerEvents: "none",
    }} />
  );
}

// ── Glitch text ────────────────────────────────────────────────────────────
function GlitchLogo() {
  return (
    <span style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: 24, fontWeight: 700, color: "#00ff41",
      textShadow: "0 0 8px #00ff41, 0 0 20px rgba(0,255,65,0.4)",
      letterSpacing: 1,
      position: "relative",
    }}>
      ClickMap
    </span>
  );
}

// ── Terminal spinner ───────────────────────────────────────────────────────
function TermSpinner({ label }) {
  const [frame, setFrame] = useState(0);
  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f+1) % frames.length), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#00ff41",
      textShadow: "0 0 6px #00ff41" }}>
      {frames[frame]} {label}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, accent }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.6)",
      border: `1px solid ${accent ? "rgba(0,255,65,0.4)" : "rgba(0,255,65,0.12)"}`,
      borderRadius: 4, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 5,
      backdropFilter: "blur(4px)",
      boxShadow: accent ? "0 0 16px rgba(0,255,65,0.1), inset 0 0 16px rgba(0,255,65,0.03)" : "none",
    }}>
      <span style={{ fontSize: 14, color: "#00ff41", textShadow: "0 0 6px #00ff41" }}>{icon}</span>
      <span style={{
        fontSize: 26, fontWeight: 700, letterSpacing: "-1px",
        color: accent ? "#00ff41" : "#c8ffc8",
        textShadow: accent ? "0 0 10px rgba(0,255,65,0.6)" : "none",
        fontFamily: "'Space Mono', monospace",
      }}>{value}</span>
      <span style={{ fontSize: 9, color: "rgba(0,255,65,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

// ── Depth bar ──────────────────────────────────────────────────────────────
function DepthBar({ depth, count, total }) {
  const cfg = depthCfg(depth);
  const pct = Math.round((count / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 3, flexShrink: 0,
        background: cfg.dim, border: `1px solid ${cfg.border}`,
        color: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, fontFamily: "'Space Mono', monospace",
        textShadow: `0 0 6px ${cfg.bg}`,
      }}>{depth}</div>
      <div style={{ fontSize: 10, color: "rgba(0,255,65,0.5)", width: 68, flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>
        {count} nodo{count !== 1 ? "s" : ""}
      </div>
      <div style={{ flex: 1, height: 4, background: "rgba(0,255,65,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: `linear-gradient(90deg, ${cfg.bg}, ${cfg.bg}88)`,
          borderRadius: 2, transition: "width 1s cubic-bezier(.4,0,.2,1)",
          boxShadow: `0 0 6px ${cfg.bg}`,
        }} />
      </div>
      <span style={{ fontSize: 9, color: "rgba(0,255,65,0.4)", width: 28, textAlign: "right",
        flexShrink: 0, fontFamily: "'Space Mono', monospace" }}>{pct}%</span>
    </div>
  );
}

// ── Decode text animation ──────────────────────────────────────────────────
function DecodeText({ text, delay = 0 }) {
  const [display, setDisplay] = useState("");
  const chars = "アイウエオ01カキクケコ10サシスセソ";
  useEffect(() => {
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (i >= text.length) { clearInterval(interval); setDisplay(text); return; }
        setDisplay(text.slice(0, i) + chars[Math.floor(Math.random()*chars.length)]);
        i++;
      }, 28);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text]);
  return <span>{display}</span>;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function ClickMap() {
  const [url, setUrl]         = useState("");
  const [busy, setBusy]       = useState(false);
  const [status, setStatus]   = useState("");
  const [results, setResults] = useState(null);
  const [err, setErr]         = useState(null);
  const [filter, setFilter]   = useState("all");
  const [sortBy, setSortBy]   = useState("depth");

  const statusMessages = [
    "INICIANDO RASTREO...",
    "MAPEANDO NODOS...",
    "ANALIZANDO RUTAS...",
    "DECODIFICANDO ESTRUCTURA...",
    "COMPILANDO RESULTADOS...",
  ];
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setStatusIdx(i => (i+1) % statusMessages.length), 2200);
    return () => clearInterval(id);
  }, [busy]);

  const analyze = useCallback(async () => {
    if (!url.trim() || busy) return;
    const cleanUrl = url.startsWith("http") ? url.trim() : `https://${url.trim()}`;
    setBusy(true); setResults(null); setErr(null); setFilter("all"); setStatusIdx(0);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || `ERROR_${res.status}`);
      }
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setResults(parsed);
    } catch (e) {
      setErr(e.message || "CONNECTION_FAILED");
    } finally {
      setBusy(false);
    }
  }, [url, busy]);

  const destinations = results?.destinations || [];
  const filtered = destinations.filter(d => filter === "all" ? true : d.depth === parseInt(filter));
  const sorted = [...filtered].sort((a,b) => sortBy === "depth" ? a.depth - b.depth : a.label.localeCompare(b.label));
  const depthGroups = destinations.reduce((acc,d) => { acc[d.depth]=(acc[d.depth]||0)+1; return acc; }, {});
  const maxDepthVal = results?.maxDepth || 0;
  const filterBtns = ["all", ...Array.from({length:maxDepthVal},(_,i)=>String(i+1))];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@400;500;600;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #000900; min-height: 100vh; }
        input::placeholder { color: rgba(0,255,65,0.2); font-family: 'Space Mono', monospace; }
        input:focus { outline: none; }
        @keyframes cmFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes glitch {
          0%,100% { text-shadow: 0 0 8px #00ff41, 0 0 20px rgba(0,255,65,.4); transform: none; }
          92% { text-shadow: -2px 0 #00d2ff, 2px 0 #ff0066, 0 0 8px #00ff41; transform: skewX(-1deg); }
          94% { text-shadow: 2px 0 #00d2ff, -2px 0 #ff0066, 0 0 8px #00ff41; transform: skewX(1deg); }
          96% { text-shadow: 0 0 8px #00ff41, 0 0 20px rgba(0,255,65,.4); transform: none; }
        }
        .logo-text { animation: glitch 4s infinite; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #000900; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,65,0.2); border-radius: 2px; }
        .cm-row:hover { background: rgba(0,255,65,0.04) !important; }
        .cm-btn-filter:hover { border-color: rgba(0,255,65,0.4) !important; color: #00ff41 !important; }
        ::selection { background: rgba(0,255,65,0.3); color: #00ff41; }
      `}</style>

      <MatrixRain />
      <Scanlines />

      <div style={{
        fontFamily: "'Outfit', sans-serif",
        minHeight: "100vh", color: "#c8ffc8",
        padding: "32px 20px 80px",
        maxWidth: 860, margin: "0 auto",
        position: "relative", zIndex: 2,
      }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            {/* Logo icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 4, flexShrink: 0,
              background: "rgba(0,255,65,0.08)",
              border: "1px solid rgba(0,255,65,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#00ff41",
              textShadow: "0 0 10px #00ff41",
              boxShadow: "0 0 12px rgba(0,255,65,0.15), inset 0 0 12px rgba(0,255,65,0.05)",
            }}>◈</div>

            <span className="logo-text" style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 24, fontWeight: 700, color: "#00ff41",
              textShadow: "0 0 8px #00ff41, 0 0 20px rgba(0,255,65,0.4)",
              letterSpacing: 1,
            }}>ClickMap</span>

            {/* Version badge */}
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 10, color: "rgba(0,255,65,0.6)",
              border: "1px solid rgba(0,255,65,0.2)",
              padding: "2px 7px", borderRadius: 3,
              letterSpacing: "0.05em",
            }}>{VERSION}</span>

            {/* BETA badge */}
            <span style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 9, color: "#00d2ff",
              border: "1px solid rgba(0,210,255,0.3)",
              padding: "2px 7px", borderRadius: 3,
              letterSpacing: "0.1em",
              textShadow: "0 0 6px #00d2ff",
            }}>BETA</span>
          </div>
          <p style={{
            fontSize: 10, color: "rgba(0,255,65,0.35)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            fontFamily: "'Space Mono', monospace",
          }}>
            &gt; AUDITORIA DE PROFUNDIDAD DE CLICKS // UX NAV AUDIT
          </p>
        </div>

        {/* ── Input ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "flex", alignItems: "stretch",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(0,255,65,0.25)",
            borderRadius: 4, overflow: "hidden",
            backdropFilter: "blur(8px)",
            boxShadow: "0 0 20px rgba(0,255,65,0.05)",
          }}>
            <span style={{
              padding: "0 14px", display: "flex", alignItems: "center",
              fontFamily: "'Space Mono', monospace", fontSize: 11,
              color: "rgba(0,255,65,0.3)",
              borderRight: "1px solid rgba(0,255,65,0.12)", flexShrink: 0,
            }}>https://</span>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyze()}
              placeholder="target.com"
              style={{
                flex: 1, padding: "15px 14px",
                background: "transparent", border: "none",
                color: "#00ff41", fontSize: 14,
                fontFamily: "'Space Mono', monospace",
                textShadow: "0 0 6px rgba(0,255,65,0.4)",
              }}
            />
            <button
              onClick={analyze} disabled={busy}
              style={{
                padding: "0 24px",
                background: busy ? "rgba(0,255,65,0.04)" : "rgba(0,255,65,0.12)",
                border: "none",
                borderLeft: "1px solid rgba(0,255,65,0.15)",
                cursor: busy ? "not-allowed" : "pointer",
                color: busy ? "rgba(0,255,65,0.3)" : "#00ff41",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                transition: "all .2s", flexShrink: 0, whiteSpace: "nowrap",
                textShadow: busy ? "none" : "0 0 8px #00ff41",
              }}
            >
              {busy ? "SCANNING" : "SCAN →"}
            </button>
          </div>

          {busy && (
            <div style={{ marginTop: 12 }}>
              <TermSpinner label={statusMessages[statusIdx]} />
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {err && (
          <div style={{
            padding: "12px 16px", borderRadius: 4, marginBottom: 24,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#ff6b6b", fontSize: 12,
            fontFamily: "'Space Mono', monospace",
          }}>
            [ERROR] {err}
          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <div style={{ animation: "cmFadeIn .5s ease" }}>

            {/* Site header */}
            <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid rgba(0,255,65,0.1)" }}>
              <h2 style={{
                fontSize: 20, fontWeight: 800, color: "#00ff41",
                textShadow: "0 0 10px rgba(0,255,65,0.4)",
                marginBottom: 4, fontFamily: "'Space Mono', monospace",
              }}>
                <DecodeText text={results.siteName} />
              </h2>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "rgba(0,255,65,0.3)" }}>
                {results.rootUrl}
              </p>
            </div>

            {/* Verdict */}
            <div style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "14px 16px", borderRadius: 4, marginBottom: 10,
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(0,210,255,0.15)",
              backdropFilter: "blur(4px)",
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2, color: "#00d2ff",
                textShadow: "0 0 6px #00d2ff" }}>◎</span>
              <div>
                <p style={{ fontSize: 12, color: "rgba(200,255,200,0.7)", lineHeight: 1.7,
                  marginBottom: results.topIssue ? 10 : 0, fontFamily: "'Space Mono', monospace" }}>
                  {results.uxVerdict || results.summary}
                </p>
                {results.topIssue && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "3px 10px", borderRadius: 3,
                    background: "rgba(249,115,22,0.08)",
                    border: "1px solid rgba(249,115,22,0.3)",
                    fontSize: 10, color: "#f97316", fontWeight: 600,
                    fontFamily: "'Space Mono', monospace",
                  }}>[!] {results.topIssue}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 24 }}>
              <StatCard icon="+" value={results.totalDestinations} label="Nodos totales" />
              <StatCard icon="▼" value={`${results.maxDepth}`} label="Profundidad máx." accent />
              <StatCard icon="~" value={`${results.avgDepth}`} label="Promedio clicks" />
            </div>

            {/* Distribution */}
            <div style={{
              marginBottom: 24, padding: "16px",
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,255,65,0.1)",
              borderRadius: 4, backdropFilter: "blur(4px)",
            }}>
              <p style={{ fontSize: 9, color: "rgba(0,255,65,0.4)", textTransform: "uppercase",
                letterSpacing: "0.12em", marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>
                &gt; DISTRIBUCIÓN POR PROFUNDIDAD
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(depthGroups).sort(([a],[b])=>+a-+b).map(([d,c]) => (
                  <DepthBar key={d} depth={+d} count={c} total={destinations.length} />
                ))}
              </div>
            </div>

            {/* Table */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <p style={{ fontSize: 9, color: "rgba(0,255,65,0.4)", textTransform: "uppercase",
                  letterSpacing: "0.12em", fontFamily: "'Space Mono', monospace" }}>
                  &gt; NODOS DETECTADOS [{sorted.length}]
                </p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  {filterBtns.map(f => {
                    const active = filter === f;
                    const cfg = f !== "all" ? depthCfg(+f) : null;
                    return (
                      <button key={f} className="cm-btn-filter" onClick={() => setFilter(f)} style={{
                        padding: "3px 9px", borderRadius: 3,
                        background: active ? (cfg ? `${cfg.bg}18` : "rgba(0,255,65,0.1)") : "transparent",
                        border: `1px solid ${active ? (cfg ? cfg.border : "rgba(0,255,65,0.4)") : "rgba(0,255,65,0.1)"}`,
                        color: active ? (cfg ? cfg.bg : "#00ff41") : "rgba(0,255,65,0.3)",
                        fontSize: 9, cursor: "pointer",
                        fontFamily: "'Space Mono', monospace", fontWeight: 700,
                        transition: "all .15s", letterSpacing: "0.05em",
                        textShadow: active ? `0 0 6px ${cfg ? cfg.bg : "#00ff41"}` : "none",
                      }}>
                        {f === "all" ? "ALL" : `D${f}`}
                      </button>
                    );
                  })}
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                    padding: "3px 7px", background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(0,255,65,0.1)",
                    borderRadius: 3, color: "rgba(0,255,65,0.4)",
                    fontSize: 9, cursor: "pointer",
                    fontFamily: "'Space Mono', monospace",
                  }}>
                    <option value="depth">↕ depth</option>
                    <option value="label">↕ name</option>
                  </select>
                </div>
              </div>

              <div style={{
                border: "1px solid rgba(0,255,65,0.12)", borderRadius: 4, overflow: "hidden",
                background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
              }}>
                {/* Head */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 56px",
                  padding: "8px 14px", background: "rgba(0,255,65,0.04)",
                  borderBottom: "1px solid rgba(0,255,65,0.1)",
                  fontSize: 8, color: "rgba(0,255,65,0.35)", textTransform: "uppercase",
                  letterSpacing: "0.1em", fontFamily: "'Space Mono', monospace", gap: 8,
                }}>
                  <span>RUTA</span><span>TIPO</span><span style={{textAlign:"center"}}>DEPTH</span>
                </div>

                {sorted.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", fontSize: 11,
                    color: "rgba(0,255,65,0.2)", fontFamily: "'Space Mono', monospace" }}>
                    [NULL] — sin nodos en este nivel
                  </div>
                )}

                {sorted.map((dest, i) => {
                  const cfg = depthCfg(dest.depth);
                  return (
                    <div key={i} className="cm-row" style={{
                      display: "grid", gridTemplateColumns: "1fr 90px 56px",
                      padding: "10px 14px", gap: 8, alignItems: "center",
                      borderBottom: i < sorted.length-1 ? "1px solid rgba(0,255,65,0.06)" : "none",
                      transition: "background .15s",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#c8ffc8", marginBottom: 2 }}>
                          {dest.label}
                        </p>
                        <p style={{
                          fontFamily: "'Space Mono', monospace", fontSize: 9,
                          color: "rgba(0,255,65,0.2)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginBottom: dest.description ? 2 : 0,
                        }}>{dest.url}</p>
                        {dest.description && (
                          <p style={{ fontSize: 10, color: "rgba(0,255,65,0.35)" }}>{dest.description}</p>
                        )}
                      </div>
                      <div>
                        <span style={{
                          padding: "2px 6px", borderRadius: 3,
                          background: "rgba(0,255,65,0.06)",
                          border: "1px solid rgba(0,255,65,0.1)",
                          fontSize: 8, color: "rgba(0,255,65,0.4)",
                          fontFamily: "'Space Mono', monospace",
                        }}>{dest.category}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 4,
                          background: cfg.dim, border: `1px solid ${cfg.border}`,
                          color: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700,
                          fontFamily: "'Space Mono', monospace",
                          textShadow: `0 0 8px ${cfg.bg}`,
                          boxShadow: `0 0 8px ${cfg.dim}`,
                        }}>{dest.depth}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p style={{ marginTop: 20, fontSize: 9, color: "rgba(0,255,65,0.2)",
              textAlign: "center", fontFamily: "'Space Mono', monospace" }}>
              [AI_GENERATED] RESULTADOS SEGÚN ACCESIBILIDAD PÚBLICA DEL SITIO // {VERSION}
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!results && !busy && !err && (
          <div style={{ textAlign: "center", padding: "70px 0" }}>
            <div style={{
              fontSize: 52, marginBottom: 16, opacity: .15, color: "#00ff41",
              textShadow: "0 0 20px #00ff41",
            }}>◈</div>
            <p style={{ fontSize: 12, marginBottom: 6, color: "rgba(0,255,65,0.4)",
              fontFamily: "'Space Mono', monospace" }}>
              &gt; INGRESA UNA URL PARA INICIAR EL RASTREO
            </p>
            <p style={{ fontSize: 10, color: "rgba(0,255,65,0.2)",
              fontFamily: "'Space Mono', monospace" }}>
              MAPEA CUÁNTOS CLICKS NECESITA UN USUARIO PARA LLEGAR A CADA NODO
            </p>
          </div>
        )}

      </div>
    </>
  );
}
