import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellOff, Plus, X, Zap, Clock, ExternalLink, RefreshCw } from 'lucide-react';

interface AlertItem {
  id: number; title: string; source: string; category: string;
  date: string; url: string; matched_keyword: string;
}
interface Props { onBack: () => void; userId: string; onAlertCountChange: (n: number) => void; }

const API = (() => {
  const u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
})();

const POLL_MS   = 5 * 60 * 1000; // 5 minutes
const SUGGESTED = ['Modi','India','IPL','Budget 2025','RBI','ISRO','Artificial Intelligence',
                   'Pakistan','Election','Cricket','Sensex','Inflation'];

function timeAgo(s: string) {
  try {
    const diff = Date.now() - new Date(s).getTime();
    const m    = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export default function AlertsPage({ onBack, userId, onAlertCountChange }: Props) {
  const [keywords,   setKeywords]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nh_alert_keywords') || '[]'); } catch { return []; }
  });
  const [newKw,      setNewKw]      = useState('');
  const [alerts,     setAlerts]     = useState<AlertItem[]>([]);
  const [dismissed,  setDismissed]  = useState<Set<number>>(new Set());
  const [checking,   setChecking]   = useState(false);
  const [lastCheck,  setLastCheck]  = useState<string | null>(
    () => localStorage.getItem('nh_last_checked')
  );
  const [enabled,    setEnabled]    = useState(true);
  const [error,      setError]      = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveKeywords = (kws: string[]) => {
    setKeywords(kws);
    localStorage.setItem('nh_alert_keywords', JSON.stringify(kws));
  };

  const addKeyword = (kw?: string) => {
    const k = (kw ?? newKw).trim();
    if (!k || keywords.includes(k) || keywords.length >= 15) return;
    saveKeywords([...keywords, k]);
    setNewKw('');
  };

  const removeKeyword = (kw: string) => saveKeywords(keywords.filter(k => k !== kw));

  const checkAlerts = useCallback(async (manual = false) => {
    if (!keywords.length || !enabled) return;
    if (manual) setChecking(true);
    setError('');

    try {
      const since = lastCheck
        ? new Date(new Date(lastCheck).getTime() - 5 * 60000).toISOString()
        : new Date(Date.now() - 6 * 3600 * 1000).toISOString();

      const res  = await fetch(`${API}/api/features/check-alerts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ keywords, last_checked: manual ? null : since }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');

      const now   = data.checked_at || new Date().toISOString();
      localStorage.setItem('nh_last_checked', now);
      setLastCheck(now);

      const fresh: AlertItem[] = data.alerts || [];
      setAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const merged = [
          ...fresh.filter(a => !existingIds.has(a.id)),
          ...prev,
        ].slice(0, 60);

        const visible = merged.filter(a => !dismissed.has(a.id)).length;
        localStorage.setItem('nh_alert_count', String(visible));
        onAlertCountChange(visible);
        return merged;
      });
    } catch (e: any) {
      console.error('[ALERTS]', e.message);
      if (manual) setError(e.message || 'Failed to check alerts');
    } finally {
      if (manual) setChecking(false);
    }
  }, [keywords, enabled, lastCheck, dismissed, onAlertCountChange]);

  // Poll every 5 minutes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (enabled && keywords.length > 0) {
      checkAlerts(); // immediate check
      timerRef.current = setInterval(() => checkAlerts(), POLL_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [keywords, enabled]);

  const dismiss = (id: number) => {
    setDismissed(p => {
      const n = new Set(p); n.add(id);
      const visible = alerts.filter(a => !n.has(a.id)).length;
      localStorage.setItem('nh_alert_count', String(visible));
      onAlertCountChange(visible);
      return n;
    });
  };

  const dismissAll = () => {
    const allIds = new Set(alerts.map(a => a.id));
    setDismissed(allIds);
    localStorage.setItem('nh_alert_count', '0');
    onAlertCountChange(0);
  };

  const visible = alerts.filter(a => !dismissed.has(a.id));

  return (
    <div className="feature-page">

      {/* Header */}
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-amber"><Bell size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">Breaking News Alerts</h1>
          <p className="fph-sub">Live keyword monitoring · checks every 5 minutes</p>
        </div>
        <div className="fph-action">
          <button
            className={enabled ? 'fp-toggle-on' : 'fp-toggle-off'}
            onClick={() => setEnabled(e => !e)}
          >
            {enabled ? <><Bell size={13} /> Alerts On</> : <><BellOff size={13} /> Alerts Off</>}
          </button>
        </div>
      </div>

      {/* Keyword manager */}
      <div className="alerts-keywords">
        <div className="alerts-kw-title">
          <Zap size={14} /> Watch Keywords
          <span className="alerts-kw-count">{keywords.length}/15 keywords</span>
        </div>

        <div className="alerts-kw-row">
          <input
            className="alerts-kw-input"
            placeholder="Add keyword e.g. Modi, IPL, Budget…"
            value={newKw}
            onChange={e => setNewKw(e.target.value)}
            maxLength={50}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
          />
          <button
            className="alerts-add-btn"
            onClick={() => addKeyword()}
            disabled={!newKw.trim() || keywords.length >= 15}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="alerts-active-kws">
            {keywords.map(kw => (
              <div key={kw} className="alerts-kw-chip">
                <Bell size={9} />
                <span>{kw}</span>
                <button className="alerts-kw-del" onClick={() => removeKeyword(kw)}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Suggested keywords */}
        <div>
          <div className="alerts-suggest-lbl">Quick add</div>
          <div className="fp-chips" style={{ marginTop: 8 }}>
            {SUGGESTED.filter(k => !keywords.includes(k)).map(kw => (
              <button key={kw} className="fp-chip" onClick={() => addKeyword(kw)}>
                + {kw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="fc-error">⚠️ {error}</div>}

      {/* Status bar */}
      <div className="alerts-status">
        <div className="alerts-status-left">
          <div className={`alerts-dot${enabled && keywords.length > 0 ? ' live' : ''}`} />
          <span>
            {!keywords.length ? 'Add keywords to start monitoring'
              : enabled ? 'Monitoring live' : 'Monitoring paused'}
          </span>
          {lastCheck && (
            <span className="alerts-last-check">
              <Clock size={11} /> Last checked {timeAgo(lastCheck)}
            </span>
          )}
        </div>
        <div className="alerts-status-right">
          {visible.length > 0 && (
            <button className="alerts-dismiss-all" onClick={dismissAll}>
              Dismiss all
            </button>
          )}
          <button
            className="fp-btn-secondary"
            onClick={() => checkAlerts(true)}
            disabled={checking || !keywords.length}
          >
            {checking
              ? <><RefreshCw size={12} className="spin" /> Checking…</>
              : <><Zap size={12} /> Check Now</>
            }
          </button>
        </div>
      </div>

      {/* No keywords */}
      {keywords.length === 0 && (
        <div className="fp-empty">
          <div className="fp-empty-icon">🔔</div>
          <h3>Add keywords to watch</h3>
          <p>Type a topic above or click a quick-add suggestion. We'll alert you when matching news breaks — checked every 5 minutes.</p>
        </div>
      )}

      {/* Keywords set but no alerts yet */}
      {keywords.length > 0 && visible.length === 0 && !checking && (
        <div className="fp-empty">
          <div className="fp-empty-icon">✅</div>
          <h3>All clear</h3>
          <p>No recent news matching your keywords. Click <strong>Check Now</strong> to search the full archive, or wait for the next auto-check.</p>
        </div>
      )}

      {/* Alert list */}
      {visible.length > 0 && (
        <>
          <div className="alerts-list-header">
            <span>Matching Articles</span>
            <span className="alerts-count-pill">
              {visible.length} alert{visible.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="alerts-list">
            {visible.map(a => (
              <div key={a.id} className="alert-card">
                <div className="alert-card-kw">
                  <Bell size={9} /> {a.matched_keyword}
                </div>
                <div className="alert-card-main">
                  <div className="alert-card-meta">
                    <span className="alert-card-src">{a.source}</span>
                    {a.date && <><span className="alert-card-dot">·</span><span className="alert-card-time">{timeAgo(a.date)}</span></>}
                    {a.category && <span className="alert-card-cat">{(a.category || '').split('|')[0]}</span>}
                  </div>
                  <div className="alert-card-title">{a.title}</div>
                </div>
                <div className="alert-card-btns">
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="alert-card-btn open" title="Open article">
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <button className="alert-card-btn dismiss" onClick={() => dismiss(a.id)} title="Dismiss">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
