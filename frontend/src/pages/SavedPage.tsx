import { useState, useEffect } from 'react';
import { Bookmark, Search, ExternalLink, Trash2, RefreshCw } from 'lucide-react';

interface SavedRow {
  id: number;
  saved_at: string;
  articles: {
    id: number; title: string; source: string; date: string;
    image_url: string; category: string; summary: string; url: string;
  } | null;
}

interface Props { onBack: () => void; userId: string; onUnsave: (id: number) => void; }

const API = (() => {
  const u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
})();
const FALLBACK = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=60';

function ago(s: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export default function SavedPage({ onBack, userId, onUnsave }: Props) {
  const [saved,   setSaved]   = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('All');

  const load = () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError('');
    fetch(`${API}/api/features/saved?user_id=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setSaved(d.articles || []);
      })
      .catch(e => setError(e.message || 'Failed to load saved articles'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]);

  const unsave = async (articleId: number) => {
    await fetch(`${API}/api/features/save`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, article_id: articleId }),
    });
    setSaved(p => p.filter(s => s.articles?.id !== articleId));
    onUnsave(articleId);
  };

  // Filter options from saved categories
  const cats = ['All', ...new Set(
    saved.map(s => (s.articles?.category || '').split('|')[0].trim()).filter(Boolean)
  )];

  const list = saved.filter(s => {
    if (!s.articles) return false;
    const matchCat = filter === 'All' || (s.articles.category || '').includes(filter);
    const q = search.toLowerCase();
    return matchCat && (!q ||
      s.articles.title.toLowerCase().includes(q) ||
      (s.articles.source || '').toLowerCase().includes(q)
    );
  });

  if (!userId) return (
    <div className="feature-page">
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-blue"><Bookmark size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">Saved Articles</h1>
          <p className="fph-sub">Your personal reading list</p>
        </div>
      </div>
      <div className="fp-empty">
        <div className="fp-empty-icon">🔐</div>
        <h3>Sign in required</h3>
        <p>Please sign in to save and view your articles.</p>
      </div>
    </div>
  );

  return (
    <div className="feature-page">

      {/* ── Header ── */}
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-blue"><Bookmark size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">Saved Articles</h1>
          <p className="fph-sub">Your personal reading list · {saved.length} article{saved.length !== 1 ? 's' : ''} saved</p>
        </div>
        <div className="fph-action">
          <button className="fp-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      {saved.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="fp-search-wrap">
            <Search size={14} className="fp-search-icon" />
            <input
              className="fp-search"
              placeholder="Search saved articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {cats.length > 2 && (
            <div className="fp-chips">
              {cats.map(c => (
                <button
                  key={c}
                  className={`fp-chip${filter === c ? ' active' : ''}`}
                  onClick={() => setFilter(c)}
                >{c}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="fc-error">
          ⚠️ {error}
          <button className="fp-btn-secondary" style={{ marginLeft: 12 }} onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="saved-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="fp-skeleton" style={{ height: 96, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : list.length === 0 && !error ? (
        <div className="fp-empty">
          <div className="fp-empty-icon">{search || filter !== 'All' ? '🔍' : '🔖'}</div>
          <h3>{search || filter !== 'All' ? 'No matches found' : 'Nothing saved yet'}</h3>
          <p>
            {search || filter !== 'All'
              ? 'Try a different search or clear the filter.'
              : 'Browse the news feed and tap the 🔖 bookmark icon on any article card to save it here.'}
          </p>
        </div>
      ) : (
        <div className="saved-list">
          {list.map(row => {
            const a = row.articles!;
            const cat = (a.category || '').split('|')[0].trim();
            return (
              <div key={row.id} className="saved-item">
                <img
                  className="saved-thumb"
                  src={a.image_url || FALLBACK}
                  alt={a.title}
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                />
                <div className="saved-content">
                  <div className="saved-tags">
                    {cat && <span className="saved-cat">{cat}</span>}
                    <span className="saved-source">{a.source}</span>
                    <span className="saved-dot">·</span>
                    <span className="saved-date">Saved {ago(row.saved_at)}</span>
                  </div>
                  <div className="saved-title">{a.title}</div>
                  {a.summary && <div className="saved-summary">{a.summary}</div>}
                </div>
                <div className="saved-actions">
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="saved-btn open"
                      title="Open full article"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    className="saved-btn remove"
                    onClick={() => unsave(a.id)}
                    title="Remove from saved"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
