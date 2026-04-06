import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Zap, Users, MessageSquare, CheckCircle, XCircle, RotateCcw, AlertCircle, Trophy, Target, BookOpen, ChevronRight } from 'lucide-react';

interface InterviewModePageProps { onBack: () => void; userId?: string; }
type Mode = 'feed' | 'quiz' | 'gd' | 'opinion';

const API = (() => { let u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'; if (!u.startsWith('http')) u = `https://${u}`; return u; })();

const FIELDS  = ['Engineering', 'Medical', 'Commerce', 'Arts', 'Science', 'Management'];
const TARGETS = ['Placement', 'UPSC', 'CAT/MBA', 'GATE', 'Banking', 'Higher Studies'];

const PRIORITY_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'HIGH PRIORITY' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'MEDIUM' },
  low:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: 'LOW' },
};

function friendlyError(raw: string) {
  if (!raw) return { msg: 'Something went wrong. Please retry.', isRateLimit: false, waitSecs: 0 };
  const isRateLimit = raw.includes('rate_limit') || raw.includes('Rate limit') || raw.includes('429') || raw.includes('TPM');
  const match = raw.match(/try again in ([\d.]+)s/);
  const waitSecs = match ? Math.ceil(parseFloat(match[1])) + 2 : isRateLimit ? 16 : 0;
  const msg = isRateLimit ? `AI is busy — auto-retrying in ${waitSecs}s…` : raw.length > 120 ? 'Server error — please retry.' : raw;
  return { msg, isRateLimit, waitSecs };
}

const Spinner = ({ label = 'AI is thinking…' }: { label?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '60px 20px' }}>
    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{label}</p>
  </div>
);

function RateLimitBanner({ waitSecs, onRetry }: { waitSecs: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(waitSecs);
  useEffect(() => {
    if (remaining <= 0) { onRetry(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);
  return (
    <div style={{ margin: '20px 0', padding: '18px 22px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, display: 'flex', gap: 12 }}>
      <AlertCircle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>⚡ AI Rate Limit — Free Tier</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Auto-retrying in <strong style={{ color: '#f59e0b' }}>{remaining}s</strong></p>
        <button onClick={() => { setRemaining(0); onRetry(); }} style={{ padding: '6px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Retry Now
        </button>
      </div>
    </div>
  );
}

function PageShell({ onBack, title, subtitle, children }: { onBack: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Back to Feed
        </button>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-accent)', margin: 0 }}>🎯 {title}</h1>
          {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 48px' }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function InterviewModePage({ onBack, userId }: InterviewModePageProps) {
  const [mode,     setMode]     = useState<Mode>('quiz');
  const [field,    setField]    = useState('Engineering');
  const [target,   setTarget]   = useState('Placement');
  const [feed,     setFeed]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [errorInfo,setErrorInfo]= useState<any>(null);
  const [stats,    setStats]    = useState<any>(null);
  const [selected, setSelected] = useState<{ article: any; mode: Mode } | null>(null);

  useEffect(() => { loadFeed(); if (userId) loadStats(); }, [field, target]);

  const loadFeed = async () => {
    setLoading(true); setError(''); setErrorInfo(null);
    try {
      const r = await fetch(`${API}/api/interview/feed?field=${field}&target=${target}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setFeed(d.articles || []);
    } catch (e: any) {
      const info = friendlyError(e.message || '');
      setError(info.msg); setErrorInfo(info); setFeed([]);
    } finally { setLoading(false); }
  };

  const loadStats = async () => {
    try { const r = await fetch(`${API}/api/interview/stats/${userId}`); setStats(await r.json()); }
    catch { /* ignore */ }
  };

  const saveSession = async (data: any) => {
    if (!userId) return;
    try {
      await fetch(`${API}/api/interview/save-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...data }),
      });
      loadStats();
    } catch { /* ignore */ }
  };

  if (selected?.mode === 'quiz')    return <QuizMode    article={selected.article} onBack={() => setSelected(null)} onSave={saveSession} />;
  if (selected?.mode === 'gd')      return <GDMode      article={selected.article} onBack={() => setSelected(null)} onSave={saveSession} />;
  if (selected?.mode === 'opinion') return <OpinionMode article={selected.article} onBack={() => setSelected(null)} onSave={saveSession} />;

  const MODE_CONFIG = [
    { id: 'quiz',    icon: <Zap size={15}/>,           label: 'Rapid Fire Quiz',   desc: '5 MCQ questions, instant results',        color: 'var(--accent-blue)',   btnLabel: 'Start Quiz'   },
    { id: 'gd',      icon: <Users size={15}/>,         label: 'GD Preparation',    desc: 'Arguments, facts & opening lines',         color: 'var(--accent-teal)',   btnLabel: 'Prep GD'      },
    { id: 'opinion', icon: <MessageSquare size={15}/>, label: 'Opinion Practice',  desc: 'Write your view, AI rates & scores it',    color: 'var(--accent-purple)', btnLabel: 'Give Opinion' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: stats?.total_sessions > 0 ? 14 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-accent)' }}>🎯 Interview Mode</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>AI-powered current affairs practice for {target} prep</p>
            </div>
          </div>

          {/* Stats badges */}
          {stats?.total_sessions > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { icon: '🔥', label: 'Streak', value: `${stats.streak}d` },
                { icon: '⭐', label: 'Avg Score', value: `${stats.avg_score}%` },
                { icon: '📝', label: 'Sessions', value: stats.total_sessions },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ textAlign: 'center', padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-accent)' }}>{icon} {value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '24px 24px' }}>

        {/* ── Step 1: Your profile ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={13} /> Step 1 — Tell us about yourself
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>YOUR FIELD OF STUDY</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FIELDS.map(f => (
                  <button key={f} onClick={() => setField(f)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: field === f ? 'var(--accent-blue)' : 'var(--bg-elevated)', color: field === f ? '#fff' : 'var(--text-secondary)', border: `1px solid ${field === f ? 'var(--accent-blue)' : 'var(--border)'}` }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>YOUR TARGET EXAM / JOB</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TARGETS.map(t => (
                  <button key={t} onClick={() => setTarget(t)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: target === t ? '#8b5cf6' : 'var(--bg-elevated)', color: target === t ? '#fff' : 'var(--text-secondary)', border: `1px solid ${target === t ? '#8b5cf6' : 'var(--border)'}` }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={loadFeed} style={{ padding: '10px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'var(--accent-teal)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', height: 'fit-content' }}>
              <RotateCcw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Step 2: Choose practice mode ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={13} /> Step 2 — Choose how to practise
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {MODE_CONFIG.map(m => (
              <button key={m.id} onClick={() => setMode(m.id as Mode)} style={{
                padding: '16px',
                background: mode === m.id ? `${m.color}12` : 'var(--bg-elevated)',
                border: `2px solid ${mode === m.id ? m.color : 'var(--border)'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: mode === m.id ? m.color : 'var(--text-secondary)' }}>
                  {m.icon}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</span>
                  {mode === m.id && <CheckCircle size={13} style={{ marginLeft: 'auto', color: m.color }} />}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Step 3: Pick an article ── */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={13} /> Step 3 — Pick a news topic to practise on
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', letterSpacing: 0, textTransform: 'none', marginLeft: 4 }}>
            ({field} / {target} · {feed.length} topics ranked by AI)
          </span>
        </div>

        {loading ? (
          <Spinner label={`Finding relevant ${field} topics for ${target} prep…`} />
        ) : error ? (
          <div style={{ padding: '0 4px' }}>
            {errorInfo?.isRateLimit
              ? <RateLimitBanner waitSecs={errorInfo.waitSecs} onRetry={loadFeed} />
              : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <p style={{ color: '#ef4444', marginBottom: 12 }}>⚠ {error}</p>
                  <button onClick={loadFeed} style={{ padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button>
                </div>
              )
            }
          </div>
        ) : feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📰</div>
            <p style={{ marginBottom: 12, fontWeight: 600 }}>No {field} articles found for {target} prep today</p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Try a different field/target combination, or sync more news first.</p>
            <button onClick={onBack} style={{ padding: '8px 18px', background: 'var(--accent-blue)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' }}>
              Go sync news →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {feed.map((article, i) => {
              const ps = PRIORITY_STYLE[article.priority] || PRIORITY_STYLE.low;
              const activeModeConfig = MODE_CONFIG.find(m => m.id === mode)!;
              return (
                <div key={article.id || i}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.2s', animation: 'fadeUp 0.3s ease both', animationDelay: `${i * 0.04}s` }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  {/* Priority bar */}
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 99, background: ps.color, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Priority + source */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 800, color: ps.color, background: ps.bg, border: `1px solid ${ps.color}30`, letterSpacing: '0.07em' }}>
                        {ps.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{article.source}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {article.category}</span>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 10 }}>
                      {article.title}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {article.why_relevant && (
                        <p style={{ fontSize: 12, color: 'var(--accent-teal)', display: 'flex', alignItems: 'flex-start', gap: 6, margin: 0 }}>
                          <span>💡</span> <span>{article.why_relevant}</span>
                        </p>
                      )}
                      {article.key_fact && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6, margin: 0 }}>
                          <span>📌</span> <span>{article.key_fact}</span>
                        </p>
                      )}
                      {article.likely_question && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 6, margin: 0 }}>
                          <span>❓</span> <span>{article.likely_question}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Single CTA — matches selected mode */}
                  <button
                    onClick={() => setSelected({ article, mode })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                      padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      background: activeModeConfig.color, color: '#fff', border: 'none',
                      flexShrink: 0, transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                  >
                    {activeModeConfig.icon} {activeModeConfig.btnLabel}
                    <ChevronRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Quiz Mode ────────────────────────────────────────────────────────────────
function QuizMode({ article, onBack, onSave }: any) {
  const [quiz,     setQuiz]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers,  setAnswers]  = useState<boolean[]>([]);
  const [done,     setDone]     = useState(false);
  const [quizErr,  setQuizErr]  = useState<any>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/interview/quiz`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: article.title, summary: article.summary, category: article.category }),
        });
        const d = await r.json();
        if (d.error) { setQuizErr(friendlyError(d.error)); return; }
        setQuiz(d);
      } catch (e: any) { setQuizErr(friendlyError(e.message)); }
      finally { setLoading(false); }
    })();
  }, []);

  const q = quiz?.questions?.[current];
  const score = done ? Math.round((answers.filter(Boolean).length / answers.length) * 100) : 0;

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === q.correct;
    setTimeout(() => {
      const newAns = [...answers, correct];
      setAnswers(newAns);
      if (current + 1 < quiz.questions.length) { setCurrent(c => c + 1); setSelected(null); }
      else {
        setDone(true);
        const fs = Math.round((newAns.filter(Boolean).length / newAns.length) * 100);
        onSave({ mode: 'quiz', topic: quiz.topic, article_id: article.id, score: fs, total_q: newAns.length, correct_q: newAns.filter(Boolean).length, time_spent: Math.round((Date.now() - startTime.current) / 1000) });
      }
    }, 1200);
  };

  if (loading) return <PageShell onBack={onBack} title="Rapid Fire Quiz" subtitle={`"${article.title.slice(0, 60)}…"`}><Spinner label="Generating quiz questions…" /></PageShell>;
  if (quizErr) return (
    <PageShell onBack={onBack} title="Rapid Fire Quiz">
      {quizErr.isRateLimit
        ? <RateLimitBanner waitSecs={quizErr.waitSecs} onRetry={() => setQuizErr(null)} />
        : <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>⚠ {quizErr.msg}<br /><button onClick={() => setQuizErr(null)} style={{ marginTop: 12, padding: '8px 20px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Retry</button></div>
      }
    </PageShell>
  );

  if (done) return (
    <PageShell onBack={onBack} title="Quiz Results">
      <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: score >= 80 ? 'rgba(34,197,94,0.1)' : score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', border: `3px solid ${score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444' }}>{score}%</div>
        </div>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-accent)', marginBottom: 6 }}>
          {score >= 80 ? '🏆 Excellent!' : score >= 60 ? '👍 Good effort' : '📚 Keep practising'}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
          {answers.filter(Boolean).length} of {answers.length} correct
          {score >= 80 ? ' — Interview ready on this topic!' : score >= 60 ? ' — Review the incorrect ones.' : ' — Read the article again and retry.'}
        </p>

        {quiz.questions.map((q: any, i: number) => (
          <div key={i} style={{ textAlign: 'left', padding: '12px 16px', marginBottom: 8, background: answers[i] ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${answers[i] ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
              {answers[i] ? <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />}
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{q.question}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 22, margin: 0 }}>✓ {q.options[q.correct]} — {q.explanation}</p>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onBack} style={{ flex: 1, padding: '11px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>← Back to Feed</button>
        </div>
      </div>
    </PageShell>
  );

  return (
    <PageShell onBack={onBack} title={`Rapid Fire — ${quiz?.topic || 'Quiz'}`} subtitle={`Question ${current + 1} of ${quiz?.questions?.length}`}>
      <div style={{ maxWidth: 600, margin: '32px auto' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 28 }}>
          {quiz.questions.map((_: any, i: number) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < answers.length ? 'var(--accent-blue)' : i === current ? 'var(--accent-teal)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Q{current + 1} of {quiz.questions.length} · {q?.difficulty?.toUpperCase()}
        </div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-accent)', lineHeight: 1.45, marginBottom: 24 }}>{q?.question}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q?.options.map((opt: string, idx: number) => {
            let bg = 'var(--bg-card)', border = 'var(--border)', color = 'var(--text-primary)';
            if (selected !== null) {
              if (idx === q.correct)    { bg = 'rgba(34,197,94,0.08)';  border = '#22c55e'; color = '#22c55e'; }
              else if (idx === selected) { bg = 'rgba(239,68,68,0.08)'; border = '#ef4444'; color = '#ef4444'; }
            }
            return (
              <button key={idx} onClick={() => handleAnswer(idx)} disabled={selected !== null} style={{ width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: 12, background: bg, border: `1px solid ${border}`, color, fontSize: 14, fontWeight: 500, cursor: selected !== null ? 'default' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}

// ─── GD Mode ──────────────────────────────────────────────────────────────────
function GDMode({ article, onBack, onSave }: any) {
  const [gd,      setGd]      = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'prep' | 'facts' | 'strategy'>('prep');
  const [gdErr,   setGdErr]   = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/interview/gd`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: article.title, summary: article.summary, category: article.category }) });
        const data = await r.json();
        setGd(data);
        onSave({ mode: 'gd', topic: data.gd_topic, article_id: article.id, score: 100, total_q: 1, correct_q: 1, time_spent: 0 });
      } catch (e: any) { setGdErr(friendlyError(e?.message || '')); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <PageShell onBack={onBack} title="GD Preparation" subtitle={`"${article.title.slice(0, 60)}…"`}><Spinner label="Building your GD prep kit…" /></PageShell>;
  if (gdErr)   return <PageShell onBack={onBack} title="GD Preparation">{gdErr.isRateLimit ? <div style={{ padding: '20px 24px' }}><RateLimitBanner waitSecs={gdErr.waitSecs} onRetry={onBack} /></div> : <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>⚠ {gdErr.msg}</div>}</PageShell>;
  if (!gd)     return <PageShell onBack={onBack} title="GD Preparation"><p style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Failed to load. Try again.</p></PageShell>;

  return (
    <PageShell onBack={onBack} title="GD Preparation Kit" subtitle={`Built from: "${article.title.slice(0, 70)}…"`}>
      <div style={{ maxWidth: 820, margin: '24px auto' }}>

        {/* Topic card */}
        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(79,124,255,0.08), rgba(34,211,238,0.05))', border: '1px solid rgba(79,124,255,0.2)', borderRadius: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: 8 }}>GD TOPIC</div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-accent)', lineHeight: 1.35, marginBottom: 8 }}>"{gd.gd_topic}"</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{gd.background}</p>
        </div>

        {/* Opening line card */}
        <div style={{ padding: '14px 18px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>OPENING LINE TO USE</div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>"{gd.opening_line}"</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
          {(['prep', 'facts', 'strategy'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: tab === t ? 'var(--bg-secondary)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.2s' }}>
              {t === 'prep' ? '⚖ Arguments' : t === 'facts' ? '📊 Facts & Data' : '🎯 Strategy'}
            </button>
          ))}
        </div>

        {tab === 'prep' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: '✅ Arguments FOR', color: '#22c55e', points: gd.for_points, icon: '📈' },
              { label: '❌ Arguments AGAINST', color: '#ef4444', points: gd.against_points, icon: '📉' },
            ].map(side => (
              <div key={side.label} style={{ padding: 20, background: `${side.color}07`, border: `1px solid ${side.color}25`, borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: side.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>{side.label}</div>
                {side.points?.map((p: any, i: number) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{p.point}</p>
                    <p style={{ fontSize: 11, color: side.color, background: `${side.color}10`, padding: '3px 8px', borderRadius: 6, margin: 0 }}>{side.icon} {p.data}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === 'facts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gd.key_facts?.map((f: string, i: number) => (
              <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>📊</span>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, margin: 0 }}>{f}</p>
              </div>
            ))}
            {gd.india_angle && (
              <div style={{ padding: '14px 18px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-amber)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>🇮🇳 India Angle</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{gd.india_angle}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'strategy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '18px 22px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-amber)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>How to Conclude</div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>"{gd.how_to_conclude}"</p>
            </div>
          </div>
        )}

        <button onClick={onBack} style={{ marginTop: 24, padding: '11px 28px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ← Back to Feed
        </button>
      </div>
    </PageShell>
  );
}

// ─── Opinion Mode ─────────────────────────────────────────────────────────────
function OpinionMode({ article, onBack, onSave }: any) {
  const [answer,   setAnswer]   = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [opErr,    setOpErr]    = useState<any>(null);
  const minWords = 30;
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  const submit = async () => {
    if (wordCount < minWords) return;
    setLoading(true); setOpErr(null);
    try {
      const r = await fetch(`${API}/api/interview/opinion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: article.title, summary: article.summary, category: article.category, user_answer: answer }) });
      const data = await r.json();
      setFeedback(data);
      onSave({ mode: 'opinion', topic: article.title, article_id: article.id, score: data.score, total_q: 1, correct_q: data.score >= 60 ? 1 : 0, time_spent: 0, feedback: data.verdict });
    } catch (e: any) { setOpErr(friendlyError(e?.message || '')); }
    finally { setLoading(false); }
  };

  return (
    <PageShell onBack={onBack} title="Opinion Practice" subtitle={`"${article.title.slice(0, 65)}…"`}>
      <div style={{ maxWidth: 700, margin: '24px auto' }}>

        {/* Question card */}
        <div style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 10 }}>Interview Question</div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-accent)', lineHeight: 1.45, marginBottom: 8 }}>"{article.title}"</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>What is your opinion on this topic, and how does it affect India?</p>
        </div>

        {!feedback ? (
          <>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Share your opinion here… (minimum 30 words for AI evaluation)"
              rows={7}
              style={{ width: '100%', background: 'var(--bg-card)', border: `1px solid ${wordCount >= minWords ? '#22c55e' : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.65, fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div>
                <span style={{ fontSize: 12, color: wordCount >= minWords ? '#22c55e' : 'var(--text-muted)' }}>
                  {wordCount} words {wordCount < minWords ? `— ${minWords - wordCount} more needed` : '✓ ready to submit'}
                </span>
                {wordCount > 0 && wordCount < minWords && (
                  <div style={{ width: `${(wordCount / minWords) * 100}%`, height: 2, background: 'var(--accent-blue)', borderRadius: 99, marginTop: 5, transition: 'width 0.3s', maxWidth: 200 }} />
                )}
              </div>
              <button onClick={submit} disabled={wordCount < minWords || loading} style={{ padding: '11px 28px', background: wordCount >= minWords ? 'var(--accent-blue)' : 'var(--bg-elevated)', color: wordCount >= minWords ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: wordCount >= minWords ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                {loading ? 'Analyzing your answer…' : 'Get AI Feedback →'}
              </button>
            </div>
            {opErr && (
              <div style={{ marginTop: 12 }}>
                {opErr.isRateLimit
                  ? <RateLimitBanner waitSecs={opErr.waitSecs} onRetry={() => { setOpErr(null); submit(); }} />
                  : <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>⚠ {opErr.msg}</p>
                }
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Score card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: feedback.score >= 80 ? 'rgba(34,197,94,0.1)' : feedback.score >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', border: `3px solid ${feedback.score >= 80 ? '#22c55e' : feedback.score >= 60 ? '#f59e0b' : '#ef4444'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: feedback.score >= 80 ? '#22c55e' : feedback.score >= 60 ? '#f59e0b' : '#ef4444', lineHeight: 1 }}>{feedback.score}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</div>
              </div>
              <div>
                <div style={{ fontSize: 18, marginBottom: 5 }}>
                  {feedback.grade === 'A' ? '🏆' : feedback.grade === 'B' ? '👍' : feedback.grade === 'C' ? '📚' : '⚠️'} Grade {feedback.grade}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>"{feedback.verdict}"</p>
              </div>
            </div>

            {/* Detailed feedback */}
            {[
              { key: 'strengths',      label: '✅ What You Did Well', color: '#22c55e' },
              { key: 'improvements',   label: '⚡ What to Improve',   color: '#f59e0b' },
              { key: 'missing_points', label: '❌ Points You Missed', color: '#ef4444' },
            ].map(s => feedback[s.key]?.length ? (
              <div key={s.key} style={{ padding: '16px 20px', background: `${s.color}07`, border: `1px solid ${s.color}25`, borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{s.label}</div>
                {feedback[s.key].map((item: string, i: number) => (
                  <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 5, paddingLeft: 12, borderLeft: `2px solid ${s.color}`, lineHeight: 1.5 }}>{item}</p>
                ))}
              </div>
            ) : null)}

            {feedback.better_answer && (
              <div style={{ padding: '16px 20px', background: 'rgba(79,124,255,0.04)', border: '1px solid rgba(79,124,255,0.18)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-blue)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>💡 Model Answer</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>"{feedback.better_answer}"</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setFeedback(null); setAnswer(''); }} style={{ flex: 1, padding: '11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>Try Again</button>
              <button onClick={onBack} style={{ flex: 1, padding: '11px', background: 'var(--accent-blue)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>← Back to Feed</button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
