import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, RefreshCw, X } from 'lucide-react';

interface GraphNode {
  id: string; type: 'article' | 'thread'; label: string;
  source?: string; bias_label?: string; bias_score?: number;
  sentiment?: string; date?: string; category?: string;
  article_count?: number; keywords?: string[]; last_seen?: string;
  x?: number; y?: number; vx?: number; vy?: number;
}
interface GraphEdge { source: string; target: string; type: 'belongs_to' | 'contradicts'; }
interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; }
interface NarrativeGraphPageProps { onBack: () => void; }

const API = (() => { let u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'; if (!u.startsWith('http')) u = `https://${u}`; return u; })();

// ─── Legend colors — MUST match drawing code exactly ──────────────────
const LEGEND = [
  { label: 'Thread node',        color: '#7c3aed', dot: true  },
  { label: 'Low Bias article',   color: '#22d3ee', dot: true  },
  { label: 'Medium Bias article',color: '#f59e0b', dot: true  },
  { label: 'High Bias article',  color: '#ef4444', dot: true  },
  { label: 'Contradiction link', color: '#ef4444', dot: false, dashed: true },
  { label: 'Belongs to thread',  color: '#94a3b8', dot: false },
];

// These must match the legend above exactly
function nodeColor(node: GraphNode): string {
  if (node.type === 'thread') return '#7c3aed';
  if (node.bias_label === 'High')   return '#ef4444';
  if (node.bias_label === 'Medium') return '#f59e0b';
  return '#22d3ee'; // Low / default
}

function nodeRadius(node: GraphNode): number {
  if (node.type === 'thread') return 22;
  return 9;
}

export default function NarrativeGraphPage({ onBack }: NarrativeGraphPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graphData, setGraphData]   = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [stats, setStats]           = useState({ articles: 0, threads: 0, contradictions: 0 });
  const [scale, setScale]           = useState(1);
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const isDragging   = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const offsetRef    = useRef({ x: 0, y: 0 });
  const scaleRef     = useRef(1);
  const nodesRef     = useRef<GraphNode[]>([]);
  const edgesRef     = useRef<GraphEdge[]>([]);
  const hoveredId    = useRef<string | null>(null);
  const animRef      = useRef<number>(0);
  const simRunning   = useRef(true);

  // ── Fetch + layout ────────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/narrative-graph`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: GraphData = await res.json();

      if (!data.nodes?.length) { setLoading(false); return; }

      const W = 900, H = 680;
      const threads = data.nodes.filter(n => n.type === 'thread');
      const threadIdx = new Map(threads.map((t, i) => [t.id, i]));

      // Place thread nodes in a circle, articles near their thread
      const initialized = data.nodes.map((n) => {
        if (n.type === 'thread') {
          const i = threadIdx.get(n.id) ?? 0;
          const angle = (i / Math.max(threads.length, 1)) * Math.PI * 2;
          const r = Math.min(W, H) * 0.28;
          return { ...n, x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r, vx: 0, vy: 0 };
        }
        // Find parent thread via edges
        const edge = data.edges.find(e => e.source === n.id && e.type === 'belongs_to');
        const parentId = edge?.target;
        const parent = parentId ? data.nodes.find(p => p.id === parentId) : null;
        const ti = parent ? (threadIdx.get(parent.id) ?? 0) : 0;
        const angle = (ti / Math.max(threads.length, 1)) * Math.PI * 2 + (Math.random() - 0.5) * 1.2;
        const r = Math.min(W, H) * 0.28 + 40 + Math.random() * 60;
        return { ...n, x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r, vx: 0, vy: 0 };
      });

      nodesRef.current = initialized;
      edgesRef.current = data.edges;
      setGraphData({ nodes: initialized, edges: data.edges });
      setStats({
        articles: data.nodes.filter(n => n.type === 'article').length,
        threads:  data.nodes.filter(n => n.type === 'thread').length,
        contradictions: data.edges.filter(e => e.type === 'contradicts').length,
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // ── Force simulation ───────────────────────────────────────────────
  useEffect(() => {
    if (!graphData.nodes.length) return;
    simRunning.current = true;
    let frame = 0;

    const edgeMap = new Map<string, string[]>();
    edgesRef.current.forEach(e => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source)!.push(e.target);
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
      edgeMap.get(e.target)!.push(e.source);
    });

    const tick = () => {
      if (!simRunning.current) return;
      frame++;
      const nodes = nodesRef.current;
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const alpha = Math.max(0.01, 1 - frame / 250); // cool down

      nodes.forEach(n => {
        n.vx = (n.vx ?? 0) * 0.8;
        n.vy = (n.vy ?? 0) * 0.8;

        // Repulsion
        nodes.forEach(m => {
          if (m.id === n.id) return;
          const dx = (n.x ?? 0) - (m.x ?? 0);
          const dy = (n.y ?? 0) - (m.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (n.type === 'thread' || m.type === 'thread' ? 3500 : 1200) / (dist * dist);
          n.vx! += (dx / dist) * force * alpha;
          n.vy! += (dy / dist) * force * alpha;
        });

        // Attraction along edges
        (edgeMap.get(n.id) || []).forEach(tid => {
          const t = nodeMap.get(tid);
          if (!t) return;
          const dx = (t.x ?? 0) - (n.x ?? 0);
          const dy = (t.y ?? 0) - (n.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ideal = n.type === 'thread' && t.type === 'thread' ? 200 : 90;
          const force = (dist - ideal) * 0.06 * alpha;
          n.vx! += (dx / dist) * force;
          n.vy! += (dy / dist) * force;
        });

        // Center gravity
        n.vx! += (450 - (n.x ?? 450)) * 0.005 * alpha;
        n.vy! += (340 - (n.y ?? 340)) * 0.005 * alpha;

        n.x = (n.x ?? 450) + n.vx!;
        n.y = (n.y ?? 340) + n.vy!;
        n.x = Math.max(24, Math.min(876, n.x!));
        n.y = Math.max(24, Math.min(656, n.y!));
      });

      drawGraph();
      if (frame < 300 && simRunning.current) animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { simRunning.current = false; cancelAnimationFrame(animRef.current); };
  }, [graphData]);

  // ── Drawing ────────────────────────────────────────────────────────
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const hov = hoveredId.current;

    // Connected node IDs to hovered
    const connectedIds = new Set<string>();
    if (hov) {
      edges.forEach(e => {
        if (e.source === hov) connectedIds.add(e.target);
        if (e.target === hov) connectedIds.add(e.source);
      });
    }

    // Draw edges first
    edges.forEach(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return;

      const isHighlighted = hov && (e.source === hov || e.target === hov);
      const isContradiction = e.type === 'contradicts';

      ctx.beginPath();
      ctx.moveTo(src.x!, src.y!);
      ctx.lineTo(tgt.x!, tgt.y!);

      if (isContradiction) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = isHighlighted ? '#ef4444' : 'rgba(239,68,68,0.3)';
        ctx.lineWidth = isHighlighted ? 2 : 1;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isHighlighted ? 'rgba(148,163,184,0.8)' : 'rgba(148,163,184,0.18)';
        ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw nodes
    nodes.forEach(n => {
      const r = nodeRadius(n);
      const color = nodeColor(n);
      const isHovered = n.id === hov;
      const isDim = hov && n.id !== hov && !connectedIds.has(n.id);

      ctx.globalAlpha = isDim ? 0.25 : 1;

      // Glow on hover
      if (isHovered) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
      }

      ctx.beginPath();
      ctx.arc(n.x!, n.y!, r + (isHovered ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (n.type === 'thread') {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Label — full text for thread nodes, truncated for articles
      if (n.type === 'thread' || isHovered) {
        ctx.globalAlpha = isDim ? 0.25 : 1;
        ctx.font = n.type === 'thread' ? 'bold 12px Inter, sans-serif' : '10px Inter, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';

        // Thread: show full label across multiple lines if needed
        const maxW = 140;
        if (n.type === 'thread') {
          const words = n.label.split(/[\s-]+/);
          let line = '', lines: string[] = [];
          words.forEach(w => {
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
            else line = test;
          });
          if (line) lines.push(line);
          lines.forEach((l, i) => ctx.fillText(l, n.x!, n.y! + r + 14 + i * 13));
        } else {
          // Article hover — show truncated title
          const label = n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label;
          ctx.fillText(label, n.x!, n.y! + r + 13);
        }
      }

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }, []);

  // ── Mouse interaction ──────────────────────────────────────────────
  const getNodeAt = (cx: number, cy: number): GraphNode | null => {
    const mx = (cx - offsetRef.current.x) / scaleRef.current;
    const my = (cy - offsetRef.current.y) / scaleRef.current;
    for (const n of nodesRef.current) {
      const dx = (n.x ?? 0) - mx, dy = (n.y ?? 0) - my;
      if (Math.sqrt(dx * dx + dy * dy) <= nodeRadius(n) + 4) return n;
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    const newId = node ? node.id : null;
    if (newId !== hoveredId.current) {
      hoveredId.current = newId;
      canvasRef.current!.style.cursor = newId ? 'pointer' : 'grab';
      drawGraph();
    }
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy };
      dragStart.current = { x: e.clientX, y: e.clientY };
      setOffset({ ...offsetRef.current });
      drawGraph();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) setSelectedNode(node);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    scaleRef.current = Math.min(3, Math.max(0.3, scaleRef.current * factor));
    setScale(scaleRef.current);
    drawGraph();
  };

  const zoom = (f: number) => {
    scaleRef.current = Math.min(3, Math.max(0.3, scaleRef.current * f));
    setScale(scaleRef.current);
    drawGraph();
  };

  const resetView = () => {
    scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 };
    setScale(1); setOffset({ x: 0, y: 0 }); drawGraph();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Narrative Map</h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {stats.articles} articles · {stats.threads} threads · {stats.contradictions} contradictions
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => zoom(1.2)} title="Zoom in" style={btnStyle}><ZoomIn size={15} /></button>
          <button onClick={() => zoom(0.85)} title="Zoom out" style={btnStyle}><ZoomOut size={15} /></button>
          <button onClick={resetView} title="Reset view" style={btnStyle}><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* Legend — colors match drawing exactly */}
      <div style={{ padding: '10px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {LEGEND.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            {item.dot ? (
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 20, height: 2, background: item.color, flexShrink: 0, borderStyle: item.dashed ? 'dashed' : 'solid', borderWidth: item.dashed ? '1px' : 0, borderColor: item.color }} />
            )}
            {item.label}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            Building graph...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '100px 0', color: '#ef4444' }}>⚠ {error}</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={900} height={680}
            style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { isDragging.current = false; hoveredId.current = null; drawGraph(); }}
            onWheel={handleWheel}
          />
        )}

        {/* Node detail panel */}
        {selectedNode && (
          <div style={{ position: 'absolute', top: 16, right: 16, width: 260, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: selectedNode.type === 'thread' ? '#7c3aed' : nodeColor(selectedNode), letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                {selectedNode.type === 'thread' ? '🧵 Thread' : '📄 Article'}
              </span>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>{selectedNode.label}</p>
            {selectedNode.source && <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>Source: {selectedNode.source}</p>}
            {selectedNode.bias_label && (
              <p style={{ margin: '4px 0', fontSize: 12 }}>
                Bias: <span style={{ color: nodeColor(selectedNode), fontWeight: 700 }}>{selectedNode.bias_label}</span>
              </p>
            )}
            {selectedNode.article_count !== undefined && (
              <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>{selectedNode.article_count} articles</p>
            )}
            {selectedNode.category && <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>Category: {selectedNode.category}</p>}
            {selectedNode.keywords?.length ? (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selectedNode.keywords.slice(0, 4).map(k => (
                  <span key={k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{k}</span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer',
};
