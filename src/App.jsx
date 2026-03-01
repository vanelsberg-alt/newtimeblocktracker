import { useState, useRef, useCallback, memo } from "react";

const TOTAL_HOURS = 24;
const VISIBLE_HOURS = 12;

function mod(n, m) { return ((n % m) + m) % m; }

function parseTimeInput(str) {
  const parts = str.trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return null;
  return mod(h + m / 60, TOTAL_HOURS);
}

function decimalToDisplay(dec) {
  const h = mod(Math.floor(dec), TOTAL_HOURS);
  const m = Math.round((dec - Math.floor(dec)) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function pctToTime(pct, vs) { return mod(vs + (pct / 100) * VISIBLE_HOURS, TOTAL_HOURS); }
function timeToPct(t, vs) { return (mod(t - vs, TOTAL_HOURS) / VISIBLE_HOURS) * 100; }
function calcTotalH(w) { return ((w / 100) * VISIBLE_HOURS).toFixed(1); }

const PALETTE = [
  { bg: "#e0f2fe", border: "#38bdf8", text: "#0c4a6e", handle: "#0ea5e9", dark: "#075985" },
  { bg: "#fce7f3", border: "#f472b6", text: "#831843", handle: "#ec4899", dark: "#9d174d" },
  { bg: "#dcfce7", border: "#4ade80", text: "#14532d", handle: "#22c55e", dark: "#15803d" },
  { bg: "#fef3c7", border: "#fbbf24", text: "#78350f", handle: "#f59e0b", dark: "#92400e" },
  { bg: "#ede9fe", border: "#a78bfa", text: "#4c1d95", handle: "#8b5cf6", dark: "#5b21b6" },
];

const Ruler = memo(function Ruler({
  color, name, left, width,
  containerRef, viewStartRef,
  onCommit, onNameChange,
  onDelete,
  startH, endH, totalH
}) {
  const elRef = useRef(null);
  const livePos = useRef({ left, width });
  const isDragging = useRef(false);

  const prev = useRef({ left, width });
  if (prev.current.left !== left || prev.current.width !== width) {
    prev.current = { left, width };
    if (!isDragging.current) {
      livePos.current = { left, width };
      if (elRef.current) {
        elRef.current.style.left = `${left}%`;
        elRef.current.style.width = `${width}%`;
      }
    }
  }

  const [editingName, setEditingName] = useState(false);
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [editingDur, setEditingDur] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
  const [durVal, setDurVal] = useState("");

  const anyEditing = editingName || editingStart || editingEnd || editingDur;

  function commitName() { onNameChange(nameVal); setEditingName(false); }
  function commitStart() {
    const t = parseTimeInput(startVal);
    if (t !== null) {
      const vs = viewStartRef.current;
      const nl = timeToPct(t, vs);
      let ep = timeToPct(pctToTime(left + width, vs), vs);
      if (ep <= nl) ep += 100;
      const l = Math.max(0, Math.min(98, nl));
      onCommit(l, Math.max(2, Math.min(100 - l, ep - nl)));
    }
    setEditingStart(false);
  }
  function commitEnd() {
    const t = parseTimeInput(endVal);
    if (t !== null) {
      const vs = viewStartRef.current;
      let ep = timeToPct(t, vs);
      if (ep <= left) ep += 100;
      onCommit(left, Math.max(2, Math.min(100 - left, ep - left)));
    }
    setEditingEnd(false);
  }
  function commitDur() {
    const h = parseFloat(durVal);
    if (!isNaN(h) && h > 0) onCommit(left, Math.max(2, Math.min(100 - left, (h / VISIBLE_HOURS) * 100)));
    setEditingDur(false);
  }

  function makeDragHandler(type) {
    return function onPointerDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);

      isDragging.current = true;
      const startX = e.clientX;
      const startLeft = livePos.current.left;
      const startWidth = livePos.current.width;
      const container = containerRef.current;
      const el = elRef.current;
      if (!container || !el) return;

      document.body.style.cursor = type === "drag" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";

      const target = e.currentTarget;

      function onPointerMove(ev) {
        const rect = container.getBoundingClientRect();
        const dp = ((ev.clientX - startX) / rect.width) * 100;
        let l = startLeft, w = startWidth;
        if (type === "drag") {
          l = Math.max(0, Math.min(100 - startWidth, startLeft + dp));
        } else if (type === "resL") {
          const nl = Math.max(0, Math.min(startLeft + startWidth - 2, startLeft + dp));
          l = nl; w = startWidth - (nl - startLeft);
        } else {
          w = Math.max(2, Math.min(100 - startLeft, startWidth + dp));
        }
        el.style.left = `${l}%`;
        el.style.width = `${w}%`;
        livePos.current = { left: l, width: w };
      }

      function onPointerUp() {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        target.removeEventListener("pointermove", onPointerMove);
        target.removeEventListener("pointerup", onPointerUp);
        target.removeEventListener("pointercancel", onPointerUp);
        onCommit(livePos.current.left, livePos.current.width);
      }

      target.addEventListener("pointermove", onPointerMove);
      target.addEventListener("pointerup", onPointerUp);
      target.addEventListener("pointercancel", onPointerUp);
    };
  }

  const inputStyle = { borderColor: color.border, color: color.dark, backgroundColor: "white" };

  return (
    <div ref={elRef}
      className="absolute border-2 rounded-lg z-10"
      style={{
        left: `${left}%`, width: `${width}%`, height: "100%",
        backgroundColor: color.bg, borderColor: color.border,
        userSelect: "none", boxShadow: `0 2px 8px ${color.border}33`
      }}
    >
      {/* Left resize handle */}
      <div className="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg z-30"
        style={{ backgroundColor: color.handle, cursor: "ew-resize", touchAction: "none", opacity: 0.8 }}
        onPointerDown={makeDragHandler("resL")} />

      {/* Right resize handle */}
      <div className="absolute right-0 top-0 bottom-0 w-3 rounded-r-lg z-30"
        style={{ backgroundColor: color.handle, cursor: "ew-resize", touchAction: "none", opacity: 0.8 }}
        onPointerDown={makeDragHandler("resR")} />

      {/* Delete button */}
      <div className="absolute top-0 right-3 z-40 pointer-events-auto"
        style={{ transform: "translateY(-50%)" }}>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold leading-none"
          style={{ backgroundColor: color.handle, border: `1px solid ${color.dark}`, cursor: "pointer" }}
        >×</button>
      </div>

      {/* Drag layer */}
      {!anyEditing && (
        <div className="absolute z-20"
          style={{ left: "12px", right: "12px", top: 0, bottom: 0, cursor: "grab", touchAction: "none" }}
          onPointerDown={makeDragHandler("drag")} />
      )}

      {/* Content */}
      <div className="flex flex-col justify-around h-full py-1.5 px-4 relative z-30 pointer-events-none">
        <div className="flex items-center justify-center gap-1 leading-none">
          {editingStart
            ? <input autoFocus value={startVal} onChange={e => setStartVal(e.target.value)}
              onBlur={commitStart} onKeyDown={e => e.key === "Enter" && commitStart()}
              className="w-14 text-center text-[11px] rounded border focus:outline-none px-1 py-0.5 pointer-events-auto"
              style={inputStyle} onMouseDown={e => e.stopPropagation()} />
            : <span className="text-[11px] tabular-nums cursor-pointer hover:underline pointer-events-auto"
              style={{ color: color.text }}
              onClick={e => { e.stopPropagation(); setStartVal(startH); setEditingStart(true); }}>
              {startH}
            </span>
          }
          <span className="text-[10px] opacity-40" style={{ color: color.text }}>–</span>
          {editingEnd
            ? <input autoFocus value={endVal} onChange={e => setEndVal(e.target.value)}
              onBlur={commitEnd} onKeyDown={e => e.key === "Enter" && commitEnd()}
              className="w-14 text-center text-[11px] rounded border focus:outline-none px-1 py-0.5 pointer-events-auto"
              style={inputStyle} onMouseDown={e => e.stopPropagation()} />
            : <span className="text-[11px] tabular-nums cursor-pointer hover:underline pointer-events-auto"
              style={{ color: color.text }}
              onClick={e => { e.stopPropagation(); setEndVal(endH); setEditingEnd(true); }}>
              {endH}
            </span>
          }
        </div>

        <div className="flex justify-center">
          {editingName
            ? <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
              onBlur={commitName} onKeyDown={e => e.key === "Enter" && commitName()}
              className="w-full text-center text-[12px] font-semibold rounded border focus:outline-none px-1 py-0.5 pointer-events-auto"
              style={inputStyle} onMouseDown={e => e.stopPropagation()} />
            : <span className="text-[12px] font-semibold cursor-pointer hover:underline pointer-events-auto truncate max-w-full"
              style={{ color: color.dark }}
              onClick={e => { e.stopPropagation(); setNameVal(name); setEditingName(true); }}>
              {name}
            </span>
          }
        </div>

        <div className="flex justify-center">
          {editingDur
            ? <input autoFocus value={durVal} onChange={e => setDurVal(e.target.value)}
              onBlur={commitDur} onKeyDown={e => e.key === "Enter" && commitDur()}
              className="w-14 text-center text-[11px] font-medium rounded border focus:outline-none px-1 py-0.5 pointer-events-auto"
              style={inputStyle} onMouseDown={e => e.stopPropagation()} />
            : <span className="text-[11px] font-medium tabular-nums cursor-pointer hover:underline pointer-events-auto"
              style={{ color: color.text }}
              onClick={e => { e.stopPropagation(); setDurVal(totalH); setEditingDur(true); }}>
              {totalH}h
            </span>
          }
        </div>
      </div>
    </div>
  );
});

export default function App() {
  const [viewStart, setViewStart] = useState(19);
  const viewStartRef = useRef(19);
  viewStartRef.current = viewStart;

  const containerRef = useRef(null);
  const timelineRef = useRef(null);

  const [rulers, setRulers] = useState([
    { left: 20, width: 30, name: "Sleep" },
    { left: 5, width: 12, name: "Read" },
    { left: 70, width: 15, name: "Exercise" },
  ]);

  const [nextColorIdx, setNextColorIdx] = useState(rulers.length % PALETTE.length);

  const commit = useCallback((idx, left, width) => {
    setRulers(p => { const n = [...p]; n[idx] = { ...n[idx], left, width }; return n; });
  }, []);

  const rename = useCallback((idx, name) => {
    setRulers(p => { const n = [...p]; n[idx] = { ...n[idx], name }; return n; });
  }, []);

  const deleteRuler = useCallback((idx) => {
    setRulers(p => p.filter((_, i) => i !== idx));
  }, []);

  const addBlock = () => {
    setRulers(p => [...p, { left: 40, width: 15, name: "Block" }]);
    setNextColorIdx(i => (i + 1) % PALETTE.length);
  };

  const onTimelineDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startView = viewStartRef.current;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    let ended = false;
    function move(ev) {
      if (!(ev.buttons & 1)) { up(); return; }
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      setViewStart(mod(startView - ((ev.clientX - startX) / rect.width) * VISIBLE_HOURS, TOTAL_HOURS));
    }
    function up() {
      if (ended) return;
      ended = true;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setViewStart(v => mod(Math.round(v * 2) / 2, TOTAL_HOURS));
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, []);

  const rulerDisplays = rulers.map(r => ({
    startH: decimalToDisplay(pctToTime(r.left, viewStart)),
    endH: decimalToDisplay(pctToTime(r.left + r.width, viewStart)),
    totalH: calcTotalH(r.width),
  }));

  const fractOffset = viewStart - Math.floor(viewStart);
  const baseHour = Math.floor(viewStart);
  const ticks = [];
  const halfTicks = [];
  for (let i = -1; i <= VISIBLE_HOURS + 1; i++) {
    const pos = ((i - fractOffset) / VISIBLE_HOURS) * 100;
    if (pos >= -3 && pos <= 103) ticks.push({ hour: mod(baseHour + i, TOTAL_HOURS), pos });
    const hp = ((i + 0.5 - fractOffset) / VISIBLE_HOURS) * 100;
    if (hp >= -3 && hp <= 103) halfTicks.push({ pos: hp });
  }

  const total = rulers.reduce((a, r) => a + parseFloat(calcTotalH(r.width)), 0).toFixed(1);
  const snapS = mod(Math.round(viewStart * 2) / 2, TOTAL_HOURS);
  const snapE = mod(snapS + VISIBLE_HOURS, TOTAL_HOURS);

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", backgroundColor: "#f8fafc", padding: "16px",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input { font-family: inherit; }
        button:hover { filter: brightness(1.1); }
      `}</style>
      <div style={{ width: "100%", maxWidth: "860px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: "-0.5px",
              color: "#0f172a"
            }}>Screen-Free Time</h1>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
              {total}h planned · drag blocks to adjust
            </p>
          </div>
          <button
            onClick={addBlock}
            style={{
              padding: "7px 16px", borderRadius: "8px", border: "none",
              backgroundColor: "#0f172a", color: "white", fontSize: "12px",
              fontWeight: 600, cursor: "pointer", letterSpacing: "0.2px",
              fontFamily: "inherit"
            }}
          >+ Add Block</button>
        </div>

        {/* Main card */}
        <div style={{
          border: "1px solid #e2e8f0", borderRadius: "14px", backgroundColor: "white",
          overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)"
        }}>
          <div style={{ position: "relative", backgroundColor: "white", padding: "16px 12px 4px" }}>
            <div ref={containerRef} style={{ position: "relative" }}>
              {/* Ruler area */}
              <div style={{ position: "relative", height: rulers.length > 0 ? "88px" : "40px", marginBottom: "4px" }}>
                {rulers.length === 0 && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: "100%", color: "#cbd5e1", fontSize: "13px", fontWeight: 500
                  }}>Add a block to get started</div>
                )}
                {rulers.map((r, i) => (
                  <Ruler key={i}
                    color={PALETTE[i % PALETTE.length]}
                    name={r.name}
                    left={r.left}
                    width={r.width}
                    containerRef={containerRef}
                    viewStartRef={viewStartRef}
                    onCommit={(l, w) => commit(i, l, w)}
                    onNameChange={(n) => rename(i, n)}
                    onDelete={() => deleteRuler(i)}
                    startH={rulerDisplays[i].startH}
                    endH={rulerDisplays[i].endH}
                    totalH={rulerDisplays[i].totalH}
                  />
                ))}
              </div>

              {/* Timeline */}
              <div ref={timelineRef}
                style={{
                  position: "relative", overflow: "hidden", userSelect: "none",
                  height: "44px", backgroundColor: "#f8fafc",
                  borderTop: "1px solid #f1f5f9", margin: "0 -12px", cursor: "grab"
                }}
                onMouseDown={onTimelineDown}
              >
                <div style={{
                  position: "absolute", top: "4px", right: "12px",
                  fontSize: "8px", color: "#cbd5e1", pointerEvents: "none",
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", zIndex: 10
                }}>drag</div>

                {halfTicks.map(({ pos }, i) => (
                  <div key={i} style={{
                    position: "absolute", left: `${pos}%`, top: 6,
                    transform: "translateX(-50%)", pointerEvents: "none"
                  }}>
                    <div style={{ width: 1, height: 4, backgroundColor: "#f1f5f9" }} />
                  </div>
                ))}

                {ticks.map(({ hour, pos }, i) => {
                  const mid = hour === 0, noon = hour === 12;
                  return (
                    <div key={i} style={{
                      position: "absolute", display: "flex", flexDirection: "column",
                      alignItems: "center", left: `${pos}%`, top: 0,
                      transform: "translateX(-50%)", pointerEvents: "none"
                    }}>
                      <div style={{
                        width: 1, marginTop: 4,
                        height: mid || noon ? 13 : 7,
                        backgroundColor: mid ? "#1e293b" : noon ? "#475569" : "#e2e8f0"
                      }} />
                      <div style={{
                        fontSize: 10, marginTop: 2,
                        fontFamily: "'DM Mono', monospace",
                        color: mid ? "#1e293b" : noon ? "#475569" : "#94a3b8",
                        fontWeight: mid ? 700 : noon ? 500 : 400
                      }}>
                        {hour.toString().padStart(2, "0")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: "1px solid #f1f5f9", padding: "10px 16px",
            display: "flex", alignItems: "center", gap: "12px",
            backgroundColor: "#fafbfc"
          }}>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: "9px",
              color: "#94a3b8", letterSpacing: "0.12em", fontWeight: 500
            }}>WINDOW</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#64748b" }}>
              {Math.floor(snapS).toString().padStart(2, "0")}:00 – {Math.floor(snapE).toString().padStart(2, "0")}:00
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "3px" }}>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  backgroundColor: mod(h - Math.round(viewStart), 24) < VISIBLE_HOURS ? "#38bdf8" : "#e2e8f0",
                  transition: "background-color 0.1s"
                }} />
              ))}
            </div>
          </div>
        </div>

        <p style={{
          textAlign: "center", fontSize: "10px", color: "#cbd5e1",
          marginTop: "12px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em"
        }}>
          DRAG TIMELINE · CLICK TIMES OR NAME TO EDIT · × TO DELETE
        </p>
      </div>
    </div>
  );
}
