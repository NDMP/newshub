import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Zap, AlertTriangle, Clock, ChevronRight, X, BookOpen, GitBranch, RefreshCw, TrendingUp, Eye } from 'lucide-react';

interface NarrativeThread {
  id: number; title: string; topic_keywords: string[];
  first_seen: string; last_seen: string; summary: string;
  alert: { type: string; message: string; severity: string; triggered_at: string } | null;
  article_count: number;
}
interface Article {
  id: number; title: string; source: string; date: string; summary: string;
  bias_label: string; bias_score: number; sentiment_label: string; url: string; language: string;
  propaganda_techniques: Array<{ name: string; confidence: number; example: string }> | null;
}
interface Contradiction { id: number; claim: string; article_id_1: number; article_id_2: number; explanation: string; }
interface ThreadDetail { thread: NarrativeThread; articles: Article[]; contradictions: Contradiction[]; }
interface NarrativesPageProps { onBack: () => void; }

const API = (() => { let u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'; if (!u.startsWith('http')) u = `https://${u}`; return u; })();

function parseSummary(raw: string): string {
  if (!raw?.trim()) return '';
  const t = raw.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return t;
  try {
    const obj = JSON.parse(t);
    if (Array.isArray(obj.key_developments)) {
      return obj.key_developments.map((d: any) => [d.event, d.source && `(${d.source})`].filter(Boolean).join(' ')).filter(Boolean).join('. ');
    }
    if (Array.isArray(obj.headlines)) return obj.headlines.map((h: any) => h.summary || h.article || '').filter(Boolean).join('. ');
    const firstKey = Object.keys(obj)[0];
    if (firstKey && Array.isArray(obj[firstKey])) {
      return (obj[firstKey] as any[]).map((item: any) =>
        typeof item === 'string' ? item : [item.event, item.summary, item.description].filter(Boolean).join(' ')
      ).filter(Boolean).join('. ');
    }
    return Object.values(obj).filter(v => typeof v === 'string').join('. ');
  } catch { return raw; }
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const BIAS_COLORS: Record<string, string> = { Low: '#22d3ee', Medium: '#f59e0b', High: '#ef4444', Neutral: '#94a3b8' };
const ALERT_COLORS: Record<string, string> = { low: '#22d3ee', medium: '#f59e0b', high: '#ef4444' };

// ── Thread Card ─────────────────────────────────────────────────────────────
function ThreadCard({ thread, onOpen, index }: { thread: NarrativeThread; onOpen: (id: number) => void; index: number }) {
  const alertColor = thread.alert ? (ALERT_COLORS[thread.alert.severity] || '#f59e0b') : null;
  const cleanSummary = parseSummary(thread.summary || '');
  const isEmerging = thread.alert !== null || (thread.article_count >= 3 && Date.now() - new Date(thread.last_seen).getTime() < 24 * 3600000);
  const isHot = thread.article_count >= 5;

  return (
    <div
      onClick={() => onOpen(thread.id)}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        padding: '20px 22px',
        border: `1px solid ${alertColor ? alertColor + '50' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        animationDelay: `${index * 0.05}s`,
        animation: 'fadeUp 0.4s ease both',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-blue)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = alertColor ? alertColor + '50' : 'var(--border)';
      }}
    >
      {/* Top accent line */}
      {alertColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${alertColor}, transparent)` }} />}
      {!alertColor && isHot && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent-blue), transparent)' }} />}

      {/* Status badges row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {isEmerging && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            <AlertTriangle size={8} strokeWidth={3} /> EMERGING
          </span>
        )}
        {isHot && !isEmerging && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(79,124,255,0.1)', border: '1px solid rgba(79,124,255,0.25)', color: 'var(--accent-blue)', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            <TrendingUp size={8} /> TRENDING
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <Clock size={10} /> {timeAgo(thread.last_seen)}
        </span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.45, flex: 1, color: 'var(--text-primary)' }}>
          {thread.title}
        </h3>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      </div>

      {/* Summary */}
      {cleanSummary && (
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
          {cleanSummary}
        </p>
      )}

      {/* Alert box */}
      {thread.alert && (
        <div style={{ background: `${alertColor}12`, border: `1px solid ${alertColor}35`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.75rem', color: alertColor!, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Zap size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ lineHeight: 1.5 }}><strong>{thread.alert.type.replace(/_/g, ' ')}:</strong> {thread.alert.message}</span>
        </div>
      )}

      {/* Keywords */}
      {(thread.topic_keywords || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {(thread.topic_keywords || []).slice(0, 5).map(kw => (
            <span key={kw} style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>{kw}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <BookOpen size={11} /> {thread.article_count} article{thread.article_count !== 1 ? 's' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
          <Eye size={11} /> View thread
        </span>
      </div>
    </div>
  );
}

// ── Article row in modal ────────────────────────────────────────────────────
function ArticleRow({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false);
  const biasColor = BIAS_COLORS[article.bias_label] || '#6b7280';
  const cleanSummary = parseSummary(article.summary || '');
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 99, background: biasColor, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{article.title}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{article.source}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {timeAgo(article.date)}</span>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 8, background: `${biasColor}18`, color: biasColor, border: `1px solid ${biasColor}30`, fontWeight: 600 }}>
              {article.bias_label || 'Low'} Bias
            </span>
            {article.sentiment_label && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{article.sentiment_label}</span>}
          </div>
        </div>
        <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 14px 29px', borderTop: '1px solid var(--border)' }}>
          {cleanSummary && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '10px 0 8px' }}>{cleanSummary}</p>}
          {article.propaganda_techniques?.length ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.7rem', color: '#ef4444', letterSpacing: 1, marginBottom: 6, fontWeight: 800 }}>⚠ PROPAGANDA TECHNIQUES DETECTED</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {article.propaganda_techniques.map((t, i) => (
                  <span key={i} title={t.example} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 8, background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', cursor: 'help' }}>
                    {t.name} ({Math.round(t.confidence * 100)}%)
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Read full article →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Thread detail modal ─────────────────────────────────────────────────────
function ThreadDetailModal({ detail, onClose }: { detail: ThreadDetail; onClose: () => void }) {
  const { thread, articles, contradictions } = detail;
  const [tab, setTab] = useState<'articles' | 'contradictions'>('articles');
  const cleanSummary = parseSummary(thread.summary || '');

  return (
    <>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: 6 }}>NARRATIVE THREAD</div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>{thread.title}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
            {(thread.topic_keywords || []).slice(0, 6).map(kw => (
              <span key={kw} style={{ fontSize: '0.7rem', padding: '2px 9px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{kw}</span>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>

      {cleanSummary && (
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', fontSize: '0.84rem', lineHeight: 1.65, color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
          <span style={{ color: 'var(--accent-blue)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>AI SUMMARY · </span>
          {cleanSummary}
        </div>
      )}

      {thread.alert && (
        <div style={{ padding: '10px 24px', background: `${ALERT_COLORS[thread.alert.severity]}12`, borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, fontSize: '0.8rem', color: ALERT_COLORS[thread.alert.severity] }}>
          <Zap size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><strong>{thread.alert.type.replace(/_/g, ' ')}:</strong> {thread.alert.message}</span>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, background: 'var(--bg-primary)' }}>
        {[
          { label: 'Articles', value: articles.length },
          { label: 'Contradictions', value: contradictions.length },
          { label: 'First seen', value: timeAgo(thread.first_seen) },
          { label: 'Last updated', value: timeAgo(thread.last_seen) },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', background: 'var(--bg-secondary)' }}>
        {(['articles', 'contradictions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent', marginBottom: -1, transition: 'color 0.2s' }}>
            {t === 'articles' ? `📰 Articles (${articles.length})` : `⚡ Contradictions (${contradictions.length})`}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
        {tab === 'articles' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {articles.length === 0
              ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No articles found for this thread.</p>
              : articles.map(a => <ArticleRow key={a.id} article={a} />)
            }
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contradictions.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  <p style={{ fontWeight: 600 }}>No contradictions detected</p>
                  <p style={{ fontSize: 13 }}>Sources appear to be broadly consistent on this topic.</p>
                </div>
              )
              : contradictions.map(c => (
                <div key={c.id} style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <div style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>CONFLICT</span>
                    {c.claim}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.explanation}</p>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
export default function NarrativesPage({ onBack }: NarrativesPageProps) {
  const [threads, setThreads] = useState<NarrativeThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'alerts' | 'trending'>('all');

  const fetchThreads = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/narratives`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const openThread = async (id: number) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`${API}/api/narratives/${id}`);
      setSelected(await res.json());
    } catch { setError('Failed to load thread detail'); }
    finally { setThreadLoading(false); }
  };

  const alertCount    = threads.filter(t => t.alert !== null).length;
  const trendingCount = threads.filter(t => t.article_count >= 3 && Date.now() - new Date(t.last_seen).getTime() < 24 * 3600000).length;

  const displayed = filter === 'alerts'   ? threads.filter(t => t.alert !== null)
                  : filter === 'trending' ? threads.filter(t => t.article_count >= 3 && Date.now() - new Date(t.last_seen).getTime() < 24 * 3600000)
                  : threads;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', rowGap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={onBack} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={13} /> Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={17} style={{ color: 'var(--accent-blue)' }} /> Narrative Intelligence
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {threads.length} active story threads · AI-grouped news arcs
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={fetchThreads} disabled={loading} style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
            </button>
            {[
              { id: 'all',      label: `All (${threads.length})`, color: undefined },
              { id: 'trending', label: `🔥 Trending (${trendingCount})`, color: 'var(--accent-blue)' },
              { id: 'alerts',   label: `⚠ Alerts (${alertCount})`, color: '#ef4444' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.8rem',
                background: filter === f.id ? (f.color || 'var(--accent-blue)') : 'var(--bg-card)',
                color: filter === f.id ? '#fff' : (f.color || 'var(--text-muted)'),
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* What is this? — explanation bar for first-time users */}
      {!loading && threads.length > 0 && (
        <div style={{ padding: '10px 28px', background: 'rgba(79,124,255,0.04)', borderBottom: '1px solid rgba(79,124,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Narrative threads</strong> group related news articles into story arcs. Click any card to see all articles and spot contradictions between sources.
          </p>
        </div>
      )}

      <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ margin: 0 }}>Weaving narrative threads…</p>
            <p style={{ margin: '6px 0 0', fontSize: 12 }}>Grouping related stories with AI</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ color: '#ef4444', marginBottom: 12 }}>⚠ {error}</p>
            <button onClick={fetchThreads} style={{ padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              {filter === 'alerts' ? '🔔' : filter === 'trending' ? '📈' : '📰'}
            </div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              {filter === 'alerts' ? 'No alert-level threads right now'
               : filter === 'trending' ? 'No trending threads in the last 24h'
               : 'No narrative threads yet'}
            </p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>
              {filter !== 'all' ? 'Try the "All" filter to see all threads.' : 'Sync news from the home feed to generate story threads.'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} style={{ padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Show all threads</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
            {displayed.map((thread, i) => (
              <ThreadCard key={thread.id} thread={thread} onOpen={openThread} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {(selected || threadLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); } }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 800, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
            {threadLoading
              ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}><div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />Loading thread…</div>
              : selected && <ThreadDetailModal detail={selected} onClose={() => setSelected(null)} />
            }
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}
