// frontend/src/components/NewsLawyer.tsx
// ═══════════════════════════════════════════════════════════════
//  "Your News Lawyer" — AI advocate that fights for the reader
//
//  Usage inside ArticleView.tsx:
//    import NewsLawyer from './NewsLawyer';
//    <NewsLawyer article={article} />
//
//  Place it just before the closing </article> tag in ArticleView
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface LawyerData {
  verdict:                     string;
  manipulation_score:          number;
  who_benefits:                string[];
  what_they_buried:            string[];
  real_impact_on_you:          string;
  question_nobody_is_asking:   string;
  emotional_engineering: {
    primary_emotion: string;
    technique:       string;
    trigger_words:   string[];
  };
  what_changed_vs_what_stayed: string;
  trust_verdict: {
    label:  string;
    reason: string;
  };
}

interface Props {
  article: {
    id:              number;
    title:           string;
    bias_score?:     number;
    bias_label?:     string;
    sentiment_label?: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────
function manipulationColor(score: number) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#4f7cff';
  return '#22c55e';
}

function manipulationLabel(score: number) {
  if (score >= 75) return 'HIGHLY ENGINEERED';
  if (score >= 50) return 'MODERATE MANIPULATION';
  if (score >= 25) return 'MILDLY BIASED';
  return 'RELATIVELY HONEST';
}

function trustColor(label: string) {
  const map: Record<string, string> = {
    TRUSTED:      '#22c55e',
    CAUTION:      '#f59e0b',
    SKEPTICAL:    '#f97316',
    MANIPULATIVE: '#ef4444',
  };
  return map[label] || '#9090a8';
}

function emotionEmoji(emotion: string) {
  const map: Record<string, string> = {
    fear:    '😨', anger: '😡', pride: '🇮🇳',
    anxiety: '😰', hope:  '🌟', sadness: '😢',
    neutral: '😐', outrage: '🤬', disgust: '🤢',
  };
  return map[emotion?.toLowerCase()] || '🧠';
}

// ── Main Component ─────────────────────────────────────────────
const NewsLawyer: React.FC<Props> = ({ article }) => {
  const [data,    setData]    = useState<LawyerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [open,    setOpen]    = useState(false);

  const analyze = async () => {
    if (data) { setOpen(true); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/lawyer/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ article_id: article.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Analysis failed');
      setData(d);
      setOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const mScore = data?.manipulation_score ?? 0;
  const mColor = manipulationColor(mScore);

  return (
    <div style={{ marginTop: 32 }}>

      {/* ── Trigger Button ── */}
      {!open && (
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(79,124,255,0.1) 0%, rgba(167,139,250,0.1) 100%)',
            border: '1px solid rgba(79,124,255,0.3)',
            borderRadius: 14,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'linear-gradient(135deg, rgba(79,124,255,0.18) 0%, rgba(167,139,250,0.18) 100%)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(79,124,255,0.6)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'linear-gradient(135deg, rgba(79,124,255,0.1) 0%, rgba(167,139,250,0.1) 100%)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(79,124,255,0.3)';
          }}
        >
          {/* Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #4f7cff, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            ⚖️
          </div>

          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f0f5', letterSpacing: '-0.01em' }}>
              {loading ? 'Your News Lawyer is reading...' : 'Consult Your News Lawyer'}
            </div>
            <div style={{ fontSize: 12, color: '#60607a', marginTop: 2 }}>
              {loading
                ? 'Analyzing manipulation tactics, buried facts & hidden agendas'
                : 'Find out what this article is hiding and who benefits from it'}
            </div>
          </div>

          {loading ? (
            <div style={{
              width: 20, height: 20, border: '2.5px solid rgba(79,124,255,0.3)',
              borderTopColor: '#4f7cff', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
          ) : (
            <div style={{ fontSize: 18, color: '#4f7cff', flexShrink: 0 }}>→</div>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12, padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, fontSize: 13, color: '#ef4444',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Full Panel ── */}
      {open && data && (
        <div style={{
          background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%)',
          border: '1px solid rgba(79,124,255,0.2)',
          borderRadius: 16,
          overflow: 'hidden',
          animation: 'lawyerSlide 0.3s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(79,124,255,0.12), rgba(167,139,250,0.08))',
            borderBottom: '1px solid rgba(79,124,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚖️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f0f0f5', letterSpacing: '-0.01em' }}>
                  Your News Lawyer
                </div>
                <div style={{ fontSize: 11, color: '#60607a' }}>
                  Fighting for you, not the media
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9090a8', fontSize: 16, transition: 'all 0.15s',
              }}
            >×</button>
          </div>

          <div style={{ padding: '20px' }}>

            {/* ── Verdict Banner ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(79,124,255,0.06)',
              border: '1px solid rgba(79,124,255,0.2)',
              borderRadius: 12, marginBottom: 20,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#4f7cff', marginBottom: 8,
              }}>
                ⚖️ Lawyer's Verdict
              </div>
              <p style={{ fontSize: 14, color: '#f0f0f5', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                {data.verdict}
              </p>
            </div>

            {/* ── Two-col top row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

              {/* Manipulation Score */}
              <div style={{
                padding: '14px 16px',
                background: `${mColor}0a`,
                border: `1px solid ${mColor}25`,
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: mColor, marginBottom: 10 }}>
                  Manipulation Score
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: mColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {mScore}
                  <span style={{ fontSize: 16 }}>/100</span>
                </div>
                <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${mScore}%`, height: '100%', borderRadius: 99,
                    background: mColor, transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: mColor, marginTop: 6, letterSpacing: '0.04em' }}>
                  {manipulationLabel(mScore)}
                </div>
              </div>

              {/* Trust Verdict */}
              <div style={{
                padding: '14px 16px',
                background: `${trustColor(data.trust_verdict.label)}0a`,
                border: `1px solid ${trustColor(data.trust_verdict.label)}25`,
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: trustColor(data.trust_verdict.label), marginBottom: 10 }}>
                  Source Trust
                </div>
                <div style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 99,
                  background: `${trustColor(data.trust_verdict.label)}18`,
                  border: `1px solid ${trustColor(data.trust_verdict.label)}40`,
                  fontSize: 13, fontWeight: 800, color: trustColor(data.trust_verdict.label),
                  letterSpacing: '0.05em', marginBottom: 8,
                }}>
                  {data.trust_verdict.label}
                </div>
                <p style={{ fontSize: 12, color: '#9090a8', lineHeight: 1.5, margin: 0 }}>
                  {data.trust_verdict.reason}
                </p>
              </div>
            </div>

            {/* ── Who Benefits ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 12, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ef4444', marginBottom: 12 }}>
                🎯 Who Benefits From You Believing This?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.who_benefits.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: '#ef4444', marginTop: 1,
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 13, color: '#d0d0e0', lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── What They Buried ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 12, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f59e0b', marginBottom: 12 }}>
                🔍 What This Article Buried
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.what_they_buried.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }}>▸</span>
                    <span style={{ fontSize: 13, color: '#d0d0e0', lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Real Impact on You ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(34,197,94,0.04)',
              border: '1px solid rgba(34,197,94,0.15)',
              borderRadius: 12, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22c55e', marginBottom: 10 }}>
                💥 Real Impact on Your Life
              </div>
              <p style={{ fontSize: 13, color: '#d0d0e0', lineHeight: 1.65, margin: 0 }}>
                {data.real_impact_on_you}
              </p>
            </div>

            {/* ── Emotional Engineering ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(167,139,250,0.04)',
              border: '1px solid rgba(167,139,250,0.15)',
              borderRadius: 12, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 12 }}>
                🧠 Emotional Engineering Detected
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>{emotionEmoji(data.emotional_engineering.primary_emotion)}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f5', textTransform: 'capitalize' }}>
                    Designed to trigger: <span style={{ color: '#a78bfa' }}>{data.emotional_engineering.primary_emotion}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9090a8', marginTop: 3 }}>
                    {data.emotional_engineering.technique}
                  </div>
                </div>
              </div>
              {data.emotional_engineering.trigger_words?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#60607a', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Trigger Words Used:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {data.emotional_engineering.trigger_words.map((word, i) => (
                      <span key={i} style={{
                        padding: '3px 10px', borderRadius: 99,
                        background: 'rgba(167,139,250,0.1)',
                        border: '1px solid rgba(167,139,250,0.25)',
                        fontSize: 12, fontWeight: 600, color: '#a78bfa',
                      }}>
                        "{word}"
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── What Changed vs Recycled ── */}
            {data.what_changed_vs_what_stayed && (
              <div style={{
                padding: '14px 18px',
                background: 'rgba(79,124,255,0.04)',
                border: '1px solid rgba(79,124,255,0.12)',
                borderRadius: 12, marginBottom: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4f7cff', marginBottom: 8 }}>
                  🔄 New vs Recycled Narrative
                </div>
                <p style={{ fontSize: 13, color: '#9090a8', lineHeight: 1.65, margin: 0 }}>
                  {data.what_changed_vs_what_stayed}
                </p>
              </div>
            )}

            {/* ── The Question Nobody Asked ── */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9090a8', marginBottom: 10 }}>
                ❓ The Question Nobody Is Asking
              </div>
              <p style={{ fontSize: 14, color: '#f0f0f5', lineHeight: 1.6, margin: 0, fontWeight: 600, fontStyle: 'italic' }}>
                "{data.question_nobody_is_asking}"
              </p>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 11, color: '#3a3a50' }}>
                Analysis by NewsHub AI · Not legal advice
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 12, color: '#60607a', transition: 'all 0.15s',
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes lawyerSlide {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default NewsLawyer;