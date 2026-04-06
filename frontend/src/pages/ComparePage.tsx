import { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, ChevronUp, Globe, RefreshCw, Layers } from 'lucide-react';

interface Claim { claim: string; confidence: number; }
interface ArticleWithClaims {
  id: number; title: string; source: string; date: string; summary: string;
  bias_label: 'Low' | 'Medium' | 'High';
  sentiment_label: string; language: string; claims: Claim[];
}
interface LanguageGroup { language: string; articles: ArticleWithClaims[]; }
interface CompareResult { topic: string; groups: LanguageGroup[]; total: number; }

const LANG_META: Record<string, { label: string; flag: string; color: string }> = {
  en: { label: 'English',     flag: '🇮🇳', color: '#3b82f6'  },
  hi: { label: 'Hindi',       flag: '🇮🇳', color: '#f59e0b'  },
  ta: { label: 'Tamil Nadu',  flag: '🏴', color: '#10b981'  },
  es: { label: 'Spanish',     flag: '🇪🇸', color: '#ef4444'  },
  ar: { label: 'Arabic',      flag: '🇸🇦', color: '#22c55e'  },
  fr: { label: 'French',      flag: '🇫🇷', color: '#8b5cf6'  },
  de: { label: 'German',      flag: '🇩🇪', color: '#f59e0b'  },
  zh: { label: 'Chinese',     flag: '🇨🇳', color: '#ec4899'  },
};

const BIAS_COLORS: Record<string, string> = {
  Low:    '#22d3ee',
  Medium: '#f59e0b',
  High:   '#ef4444',
};

// Topics that reflect actual Indian news now stored in DB
const QUICK_TOPICS = [
  'India', 'Tamil Nadu', 'Modi', 'Chennai', 'IPL',
  'ISRO', 'RBI', 'Budget', 'Bollywood', 'Cricket',
  'CSK', 'Pakistan', 'China', 'AI',
];

const API = (() => { let u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'; if (!u.startsWith('http')) u = `https://${u}`; return u; })();

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ComparePage({ onBack }: { onBack: () => void }) {
  const [topic,          setTopic]          = useState('');
  const [result,         setResult]         = useState<CompareResult | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [error,          setError]          = useState('');
  const [hasSearched,    setHasSearched]    = useState(false);

  const handleSearch = async (searchTopic?: string) => {
    const q = (searchTopic ?? topic).trim();
    if (!q) return;
    setLoading(true); setError(''); setResult(null); setHasSearched(true);
    try {
      const res = await fetch(`${API}/api/compare-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: q }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: CompareResult = await res.json();
      if (data.error) throw new Error(data.error as any);
      setResult(data);
      setActiveLanguage(data.groups[0]?.language ?? null);
    } catch (e: any) {
      setError(e.message || 'Search failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (t: string) => { setTopic(t); handleSearch(t); };

  const activeLang = result?.groups.find(g => g.language === activeLanguage);

  // Bias summary across all languages
  const biasStats = result ? (() => {
    const all = result.groups.flatMap(g => g.articles);
    const total = all.length || 1;
    const low    = all.filter(a => a.bias_label === 'Low').length;
    const medium = all.filter(a => a.bias_label === 'Medium').length;
    const high   = all.filter(a => a.bias_label === 'High').length;
    return { low, medium, high, total };
  })() : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── Sticky header ── */}
      <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={17} style={{ color: '#3b82f6' }} /> Cross-Language Comparison
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              See how the same story is framed across different sources and languages
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder='Type a topic to compare — e.g. "India", "Budget", "IPL"'
              style={{ width: '100%', paddingLeft: 42, paddingRight: 14, paddingTop: 12, paddingBottom: 12, background: 'var(--bg-card)', border: `1px solid ${topic.trim() ? 'var(--accent-blue)' : 'var(--border)'}`, borderRadius: 10, fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={!topic.trim() || loading}
            style={{ padding: '12px 26px', background: topic.trim() && !loading ? 'var(--accent-blue)' : 'var(--bg-elevated)', color: topic.trim() && !loading ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: topic.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            {loading ? <><RefreshCw size={14} className="spin" /> Searching…</> : <><Search size={14} /> Compare</>}
          </button>
        </div>

        {/* Quick topic chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Quick:</span>
          {QUICK_TOPICS.map(t => (
            <button key={t} onClick={() => handleQuick(t)} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: topic === t ? 'var(--accent-blue)' : 'var(--bg-elevated)', color: topic === t ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── How it works (before first search) ── */}
        {!hasSearched && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { icon: '🔍', title: 'Search any topic', desc: 'Type a keyword or click a quick topic above to find related articles' },
              { icon: '🌐', title: 'Compare by language', desc: 'See how English, Hindi, Tamil and other sources cover the same story' },
              { icon: '⚖️', title: 'Spot bias & framing', desc: 'Each article is scored for political bias and sentiment automatically' },
              { icon: '📊', title: 'Key claims', desc: 'AI extracts specific claims from each article so you can compare them' },
            ].map(card => (
              <div key={card.title} style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{card.title}</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 600 }}>Searching across all languages…</p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>AI is scoring relevance and filtering unrelated articles</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div style={{ padding: '16px 20px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, color: '#ef4444', marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── No results ── */}
        {hasSearched && !loading && !error && result && result.groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>No articles found for "{result.topic}"</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              No articles matching this topic are in your database yet.<br />
              Try syncing more news from the home feed, or use a different keyword.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Tamil Nadu', 'India', 'CSK', 'Modi', 'ISRO', 'Chennai'].map(s => (
                <button key={s} onClick={() => handleQuick(s)} style={{ padding: '8px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Try "{s}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && result.groups.length > 0 && (
          <>
            {/* Results header */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>
                  Results for: <span style={{ color: 'var(--accent-blue)' }}>"{result.topic}"</span>
                </h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {result.total ?? 0} relevant articles · {result.groups.length} language{result.groups.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Bias summary pills */}
              {biasStats && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Balanced',    count: biasStats.low,    color: '#22d3ee' },
                    { label: 'Some slant',  count: biasStats.medium, color: '#f59e0b' },
                    { label: 'High bias',   count: biasStats.high,   color: '#ef4444' },
                  ].filter(b => b.count > 0).map(b => (
                    <span key={b.label} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}30` }}>
                      {b.count} {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Language tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {result.groups.map(g => {
                const meta = LANG_META[g.language] || { label: g.language.toUpperCase(), flag: '🌐', color: '#6b7280' };
                const isActive = g.language === activeLanguage;
                return (
                  <button key={g.language} onClick={() => setActiveLanguage(g.language)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 99, border: `2px solid ${isActive ? meta.color : 'var(--border)'}`, background: isActive ? `${meta.color}18` : 'var(--bg-card)', color: isActive ? meta.color : 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: 16 }}>{meta.flag}</span>
                    <span>{meta.label}</span>
                    <span style={{ background: isActive ? `${meta.color}30` : 'var(--bg-elevated)', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>{g.articles.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Active language view */}
            {activeLang && (() => {
              const meta = LANG_META[activeLang.language] || { label: activeLang.language.toUpperCase(), flag: '🌐', color: '#6b7280' };
              const biases = activeLang.articles.map(a => a.bias_label);
              const avgBias = biases.includes('High') ? 'High' : biases.includes('Medium') ? 'Medium' : 'Low';

              return (
                <div>
                  {/* Language header card */}
                  <div style={{ padding: '14px 20px', background: 'var(--bg-card)', border: `1px solid ${meta.color}30`, borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 28 }}>{meta.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: meta.color, fontSize: 15 }}>{meta.label} Coverage</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {activeLang.articles.length} article{activeLang.articles.length !== 1 ? 's' : ''} · Average bias: <span style={{ color: BIAS_COLORS[avgBias], fontWeight: 700 }}>{avgBias}</span>
                      </div>
                    </div>
                    <Layers size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>

                  {/* Articles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeLang.articles.map(article => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}

// ── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({ article }: { article: ArticleWithClaims }) {
  const [expanded, setExpanded] = useState(false);
  const biasColor = BIAS_COLORS[article.bias_label] || '#22d3ee';

  const sentimentEmoji = (() => {
    const s = (article.sentiment_label || '').toLowerCase();
    if (s.includes('positive') || s.includes('pos')) return '🟢';
    if (s.includes('negative') || s.includes('neg')) return '🔴';
    return '⚪';
  })();

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
    >
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Bias bar */}
        <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 99, background: biasColor, flexShrink: 0 }} />

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.45, color: 'var(--text-primary)' }}>
            {article.title}
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{article.source}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {timeAgo(article.date)}</span>
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: `${biasColor}15`, color: biasColor, border: `1px solid ${biasColor}25` }}>
              {article.bias_label} Bias
            </span>
            {article.sentiment_label && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {sentimentEmoji} {article.sentiment_label}
              </span>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <ChevronDown size={15} />
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 16px 34px', borderTop: '1px solid var(--border)' }}>
          {article.summary && (
            <p style={{ margin: '12px 0', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{article.summary}</p>
          )}

          {article.claims.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 10 }}>
                Key Claims ({article.claims.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {article.claims.map((c, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 800, flexShrink: 0, fontSize: 16, lineHeight: 1 }}>›</span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{c.claim}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, padding: '1px 6px', background: 'var(--bg-card)', borderRadius: 6 }}>{Math.round(c.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
