import { useState, useEffect } from 'react';
import { LayoutDashboard, BookOpen, Clock, Flame, Bookmark, TrendingUp, RefreshCw } from 'lucide-react';

interface DashData {
  stats: {
    articles_read_week: number; reading_mins_week: number;
    saved_count: number; reading_streak_days: number; reading_goal_mins: number;
  };
  top_categories: { name: string; count: number }[];
  top_sources:    { name: string; count: number }[];
  bias_balance:   { Low: number; Medium: number; High: number };
  recommended:    any[];
}

interface Props { onBack: () => void; userId: string; userEmail: string; }

const API = (() => {
  const u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
})();
const FALLBACK = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=300&q=60';

export default function DashboardPage({ onBack, userId, userEmail }: Props) {
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const displayName = (userEmail.split('@')[0] || '')
    .replace(/[._\-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const load = () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true); setError('');
    fetch(`${API}/api/features/dashboard?user_id=${userId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]);

  const StatCard = ({ icon, color, bg, value, unit, label, note }: any) => (
    <div className="dash-stat">
      <div className="dash-stat-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="dash-stat-num">
        {value}<sup style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>{unit}</sup>
      </div>
      <div className="dash-stat-name">{label}</div>
      <div className="dash-stat-note">{note}</div>
    </div>
  );

  const Skeleton = ({ h = 100 }: { h?: number }) => (
    <div className="fp-skeleton" style={{ height: h }} />
  );

  if (!userId) return (
    <div className="feature-page">
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-purple"><LayoutDashboard size={20} /></div>
        <div className="fph-text"><h1 className="fph-title">My Dashboard</h1></div>
      </div>
      <div className="fp-empty">
        <div className="fp-empty-icon">🔐</div>
        <h3>Sign in required</h3>
        <p>Please sign in to view your reading analytics.</p>
      </div>
    </div>
  );

  return (
    <div className="feature-page">

      {/* Header */}
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-purple"><LayoutDashboard size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">My Dashboard</h1>
          <p className="fph-sub">Welcome back, {displayName} · Last 7 days</p>
        </div>
        <div className="fph-action">
          <button className="fp-btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="fc-error">⚠️ {error}</div>}

      {loading ? (
        <>
          <div className="dash-stats">
            {[1,2,3,4].map(i => <Skeleton key={i} h={108} />)}
          </div>
          <Skeleton h={80} />
          <div className="dash-two"><Skeleton h={180} /><Skeleton h={180} /></div>
          <Skeleton h={120} />
        </>
      ) : !data ? null : (() => {
        const s = data.stats;
        const goalMins    = (s.reading_goal_mins || 10) * 7;
        const goalPct     = Math.min(100, Math.round((s.reading_mins_week / goalMins) * 100));
        const biasTotal   = (data.bias_balance.Low || 0) + (data.bias_balance.Medium || 0) + (data.bias_balance.High || 0);
        const noData      = s.articles_read_week === 0;

        return (
          <>
            {/* Stats grid */}
            <div className="dash-stats">
              <StatCard
                icon={<BookOpen size={17} />} color="var(--accent-blue)" bg="rgba(79,124,255,0.12)"
                value={s.articles_read_week} label="Articles Read" note="this week"
              />
              <StatCard
                icon={<Clock size={17} />} color="var(--accent-teal)" bg="rgba(34,211,238,0.12)"
                value={s.reading_mins_week} unit="m" label="Reading Time" note="this week"
              />
              <StatCard
                icon={<Flame size={17} />} color="var(--accent-amber)" bg="rgba(245,158,11,0.12)"
                value={s.reading_streak_days} label="Day Streak" note="consecutive days"
              />
              <StatCard
                icon={<Bookmark size={17} />} color="var(--accent-purple)" bg="rgba(167,139,250,0.12)"
                value={s.saved_count} label="Saved" note="articles total"
              />
            </div>

            {/* No data tip */}
            {noData && (
              <div className="bias-insight warn">
                📖 Start reading articles from the home feed — your stats, categories, and recommendations will appear here automatically!
              </div>
            )}

            {/* Reading goal */}
            <div className="fp-card">
              <div className="dash-goal-header">
                <span className="dash-goal-label"><TrendingUp size={14} /> Weekly Reading Goal</span>
                <span className="dash-goal-pct">{goalPct}% complete</span>
              </div>
              <div className="dash-goal-track">
                <div className="dash-goal-fill" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="dash-goal-note">
                {s.reading_mins_week} min read · Goal: {goalMins} min/week ({s.reading_goal_mins} min/day)
              </div>
            </div>

            {/* Two column: Categories + Bias */}
            <div className="dash-two">

              {/* Top categories */}
              <div className="fp-card">
                <div className="fp-card-title">📂 Top Categories</div>
                {data.top_categories.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Read articles from the home feed to see your top categories here.
                  </p>
                ) : (() => {
                  const max = data.top_categories[0].count;
                  return data.top_categories.map((c, i) => (
                    <div key={i} className="dash-rank">
                      <span className="dash-rank-n">#{i + 1}</span>
                      <span className="dash-rank-name">{c.name}</span>
                      <div className="dash-rank-bar">
                        <div className="dash-rank-fill" style={{ width: `${Math.round((c.count / max) * 100)}%` }} />
                      </div>
                      <span className="dash-rank-ct">{c.count}</span>
                    </div>
                  ));
                })()}
              </div>

              {/* Bias balance */}
              <div className="fp-card">
                <div className="fp-card-title">⚖️ Bias Balance</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Bias distribution of articles you've read this week
                </p>
                {biasTotal === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Read some articles to see your bias balance.
                  </p>
                ) : (
                  <>
                    {([
                      ['✅ Balanced',    data.bias_balance.Low,    'var(--accent-green)'],
                      ['⚠️ Some Slant',  data.bias_balance.Medium, 'var(--accent-amber)'],
                      ['🔴 Opinionated', data.bias_balance.High,   'var(--accent-red)'],
                    ] as [string, number, string][]).map(([lbl, cnt, color]) => (
                      <div key={lbl} className="bias-row">
                        <span className="bias-lbl">{lbl}</span>
                        <div className="bias-track">
                          <div className="bias-fill" style={{ width: `${Math.round((cnt / biasTotal) * 100)}%`, background: color }} />
                        </div>
                        <span className="bias-pct">{Math.round((cnt / biasTotal) * 100)}%</span>
                      </div>
                    ))}
                    <div className={`bias-insight ${data.bias_balance.Low > biasTotal * 0.6 ? 'good' : 'warn'}`}>
                      {data.bias_balance.Low > biasTotal * 0.6
                        ? '🎉 Great — you\'re reading mostly balanced sources!'
                        : '💡 Tip: Try reading more balanced sources for a broader perspective.'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Top sources */}
            {data.top_sources.length > 0 && (
              <div className="fp-card">
                <div className="fp-card-title">📰 Favourite Sources</div>
                <div className="dash-sources">
                  {data.top_sources.map((src, i) => (
                    <div key={i} className="dash-src-chip">
                      <span className="dash-src-name">{src.name}</span>
                      <span className="dash-src-count">{src.count} article{src.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended */}
            {data.recommended.length > 0 && (
              <div className="fp-card">
                <div className="fp-card-title">✨ Recommended For You</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  {noData ? 'Latest articles — start reading to get personalised picks' : 'Based on your favourite categories'}
                </p>
                <div className="dash-recs">
                  {data.recommended.map((a: any, i: number) => (
                    <div key={i} className="dash-rec">
                      <img
                        className="dash-rec-img"
                        src={a.image_url || FALLBACK}
                        alt={a.title}
                        onError={e => { (e.target as HTMLImageElement).src = FALLBACK; }}
                      />
                      <div className="dash-rec-body">
                        <div className="dash-rec-cat">{(a.category || '').split('|')[0]}</div>
                        <div className="dash-rec-title">{a.title}</div>
                        <div className="dash-rec-src">{a.source}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
