import { useState } from 'react';
import { ShieldCheck, Search, CheckCircle, XCircle, AlertTriangle, HelpCircle, Loader, Link } from 'lucide-react';

interface FCResult {
  verdict: string; confidence: number; explanation: string;
  key_facts: string[]; tip: string; from_cache: boolean;
  gemini_used?: boolean; gemini_reason?: string; source_used?: string;
}
interface Props { onBack: () => void; }

const API = (() => {
  const u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
})();

const EXAMPLES = [
  'India is the most populous country in the world',
  'The moon landing in 1969 was faked by NASA',
  'India\'s GDP grew more than 7% in 2024',
  '5G towers cause COVID-19',
  'RBI raised interest rates in 2024',
];

const VERDICTS: Record<string, { label: string; icon: any; textColor: string; bg: string; border: string }> = {
  verified:   { label: '✅ Verified',   icon: CheckCircle,   textColor: 'var(--accent-green)',  bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.2)'  },
  false:      { label: '❌ False',      icon: XCircle,       textColor: 'var(--accent-red)',    bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)'  },
  misleading: { label: '⚠️ Misleading', icon: AlertTriangle, textColor: 'var(--accent-amber)',  bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
  unverified: { label: '❓ Unverified', icon: HelpCircle,    textColor: 'var(--accent-amber)',  bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
};

const STEPS = [
  'Analysing the claim…',
  'Searching news database…',
  'Cross-referencing sources…',
  'Generating verdict…',
];

export default function FactCheckPage({ onBack }: Props) {
  const [input,   setInput]   = useState('');
  const [result,  setResult]  = useState<FCResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [history, setHistory] = useState<{ claim: string; result: FCResult }[]>([]);

  const isUrl = /^https?:\/\//i.test(input.trim());

  const check = async (text?: string, recheck = false) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput(q);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res  = await fetch(`${API}/api/features/factcheck`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ claim: q, recheck }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');

      // Normalise key_facts — can come back as JSON string or array
      let kf = data.key_facts;
      if (typeof kf === 'string') { try { kf = JSON.parse(kf); } catch { kf = []; } }
      if (!Array.isArray(kf)) kf = [];

      const fc: FCResult = { ...data, key_facts: kf };
      setResult(fc);
      setHistory(p => [{ claim: q, result: fc }, ...p.slice(0, 4)]);
    } catch (e: any) {
      setError(e.message || 'Fact check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const v     = result ? (VERDICTS[result.verdict] ?? VERDICTS['unverified']) : null;
  const VIcon = v?.icon;

  return (
    <div className="feature-page">

      {/* ── Header ── */}
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-green"><ShieldCheck size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">Fact Checker</h1>
          <p className="fph-sub">Paste a claim, headline, or news URL · AI verifies it instantly</p>
        </div>
      </div>

      {/* ── Input card ── */}
      <div className="fc-input-card">
        {isUrl && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
            background: 'rgba(34,211,238,0.07)', borderBottom: '1px solid rgba(34,211,238,0.15)',
            fontSize: 12, color: 'var(--accent-teal)',
          }}>
            <Link size={12} />
            <span>URL detected — we'll fact-check what this article claims</span>
          </div>
        )}
        <textarea
          className="fc-textarea"
          placeholder="Type a claim, paste a headline, or drop in a news article URL…"
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={3}
          maxLength={600}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) check(); }}
        />
        <div className="fc-input-footer">
          <span className="fc-char">{input.length}/600 · Ctrl+Enter to check</span>
          <button className="fc-btn" onClick={() => check()} disabled={loading || !input.trim()}>
            {loading
              ? <><Loader size={14} className="spin" /> Checking…</>
              : <><Search size={14} /> Fact Check</>
            }
          </button>
        </div>
      </div>

      {/* ── Example chips ── */}
      {!result && !loading && (
        <div>
          <div className="fc-examples-label">Try an example claim</div>
          <div className="fp-chips" style={{ marginTop: 7 }}>
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="fp-chip" onClick={() => check(ex)}>{ex}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && <div className="fc-error">⚠️ {error}</div>}

      {/* ── Loading steps ── */}
      {loading && (
        <div className="fc-loading">
          {STEPS.map((step, i) => (
            <div key={i} className="fc-step" style={{ animationDelay: `${i * 0.5}s` }}>
              <div className="fc-step-dot" />{step}
            </div>
          ))}
        </div>
      )}

      {/* ── Result card ── */}
      {result && v && VIcon && (
        <div className="fc-result" style={{ background: v.bg, borderColor: v.border }}>

          {/* Verdict row */}
          <div className="fc-verdict-row">
            <div className="fc-verdict-icon"><VIcon size={28} style={{ color: v.textColor }} /></div>
            <div className="fc-verdict-body">
              <div className="fc-verdict-label" style={{ color: v.textColor }}>{v.label}</div>
              <div className="fc-verdict-desc">
                {result.verdict === 'verified'   && 'This claim appears to be accurate.'}
                {result.verdict === 'false'       && 'This claim appears to be inaccurate or fabricated.'}
                {result.verdict === 'misleading'  && 'This claim is partially true but lacks important context.'}
                {result.verdict === 'unverified'  && 'Not enough evidence to confirm or deny this claim.'}
              </div>
            </div>
            {/* Confidence ring */}
            <div className="fc-conf">
              <div className="fc-conf-wrap">
                <svg viewBox="0 0 36 36" width="56" height="56">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-elevated)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={v.textColor} strokeWidth="2.5"
                    strokeDasharray={`${result.confidence} 100`} strokeLinecap="round"
                    transform="rotate(-90 18 18)" />
                </svg>
                <div className="fc-conf-num">{result.confidence}%</div>
              </div>
              <div className="fc-conf-lbl">Confidence</div>
            </div>
          </div>

          {/* Claim echo */}
          <div className="fc-claim">"{input}"</div>

          {/* Explanation */}
          <div className="fc-explanation">{result.explanation}</div>

          {/* Gemini WHY explanation — shown for every verdict */}
          {result.gemini_used && result.gemini_reason && (
            <div style={{
              marginTop: 16, borderRadius: 12, overflow: 'hidden',
              border: '1px solid rgba(66,133,244,0.2)',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                background: 'rgba(66,133,244,0.08)',
                borderBottom: '1px solid rgba(66,133,244,0.15)',
              }}>
                <span style={{ fontSize: 15 }}>🤖</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#4285f4', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Why? —  AI Explains
                </span>
              </div>

              {/* 3 lines */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'CLAIM',   icon: '📌', text: typeof result.gemini_reason === 'object' ? result.gemini_reason.what  : null, color: '#6b7280' },
                  { label: 'TRUTH',   icon: '✅', text: typeof result.gemini_reason === 'object' ? result.gemini_reason.truth : null, color: '#16a34a' },
                  { label: 'REASON',  icon: result.verdict === 'false' ? '❌' : result.verdict === 'misleading' ? '⚠️' : '📋',
                    text: typeof result.gemini_reason === 'object' ? result.gemini_reason.why : null,
                    color: result.verdict === 'false' ? '#dc2626' : result.verdict === 'misleading' ? '#d97706' : '#2563eb' },
                ].filter(row => row.text).map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: row.color, letterSpacing: '0.07em', textTransform: 'uppercase', marginRight: 6 }}>
                        {row.label}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {row.text}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Fallback if reason is still a string */}
                {typeof result.gemini_reason === 'string' && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {result.gemini_reason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source badge */}
          {result.source_used && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Verified by:
              </span>
              {result.source_used === 'both' ? (
                <>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(91,138,255,0.12)', color: 'var(--accent-blue)', fontWeight: 700 }}>Articles</span>
                </>
              ) : result.source_used === 'ai_knowledge' ? (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(91,138,255,0.12)', color: 'var(--accent-blue)', fontWeight: 700 }}>Groq LLaMA</span>
              ) : (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(52,211,153,0.12)', color: 'var(--accent-green)', fontWeight: 700 }}>DB Articles</span>
              )}
            </div>
          )}

          {/* Key facts */}
          {result.key_facts.length > 0 && (
            <div className="fc-facts">
              <div className="fc-facts-label">Key Facts</div>
              {result.key_facts.map((f, i) => (
                <div key={i} className="fc-fact-item">
                  <div className="fc-fact-dot" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          {result.tip && <div className="fc-tip">💡 {result.tip}</div>}

          {/* Cache notice */}
          {result.from_cache && (
            <div className="fc-cached">⚡ Result from cache ·{' '}
              <button
                style={{ background:'none',border:'none',color:'var(--accent-blue)',cursor:'pointer',padding:0,fontSize:'inherit',fontWeight:700 }}
                onClick={() => check(input, true)}>
                Re-check live
              </button>
            </div>
          )}

          {/* Check another */}
          <button className="fp-btn-secondary" style={{ alignSelf: 'flex-start' }}
            onClick={() => { setResult(null); setInput(''); }}>
            Check another claim
          </button>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 1 && (
        <div className="fc-history">
          <div className="fc-history-label">Recent Checks</div>
          {history.slice(1).map((h, i) => {
            const hv = VERDICTS[h.result.verdict] ?? VERDICTS['unverified'];
            return (
              <button
                key={i}
                className="fc-history-row"
                onClick={() => { setInput(h.claim); setResult(h.result); setError(''); }}
              >
                <span className="fc-hist-v" style={{ color: hv.textColor }}>{hv.label}</span>
                <span className="fc-hist-c">
                  {h.claim.length > 80 ? h.claim.slice(0, 80) + '…' : h.claim}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
