// frontend/src/components/NewsletterPage.tsx — FULLY FIXED
// Replace your existing NewsletterPage component with this file

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Calendar, Check, ChevronRight, Mail, Zap, RefreshCw } from 'lucide-react';

type Frequency = 'breaking' | 'daily' | 'weekly';
type Step = 'checking' | 'form' | 'success' | 'updated' | 'reactivated';

interface NewsletterPageProps {
  onBack:     () => void;
  userEmail?: string;
}

const CATEGORIES = ['General', 'Technology', 'Business', 'Health', 'Sports', 'Entertainment'];

const FREQ_OPTIONS: { value: Frequency; icon: any; label: string; desc: string; color: string; when: string }[] = [
  { value: 'breaking', icon: Zap,      label: 'Breaking Alerts',  desc: 'Immediate alerts for critical news only',   color: 'var(--accent-red)',    when: 'Only when importance > 80%' },
  { value: 'daily',    icon: Bell,     label: 'Daily Digest',     desc: 'Top 5 important stories every morning',     color: 'var(--accent-blue)',   when: '7:00 AM every day' },
  { value: 'weekly',   icon: Calendar, label: 'Weekly Roundup',   desc: 'Best stories of the week, curated',         color: 'var(--accent-purple)', when: 'Sunday 6:00 PM' },
];

export default function NewsletterPage({ onBack, userEmail = '' }: NewsletterPageProps) {
  const [step,       setStep]       = useState<Step>('checking');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const [email,      setEmail]      = useState(userEmail);
  const [name,       setName]       = useState('');
  const [frequency,  setFrequency]  = useState<Frequency>('daily');
  const [topics,     setTopics]     = useState<string[]>(['General', 'Technology', 'Business']);
  const [maxPerWeek, setMaxPerWeek] = useState(7);
  const [existingSub, setExistingSub] = useState<any>(null);

  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const url    = apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl}`;

  // ── Check subscription status on load ──────────────────────
  useEffect(() => {
    if (userEmail) {
      checkStatus(userEmail);
    } else {
      setStep('form');
    }
  }, [userEmail]);

  const checkStatus = async (emailToCheck: string) => {
    setStep('checking');
    try {
      const r = await fetch(`${url}/api/newsletter/check/${encodeURIComponent(emailToCheck.toLowerCase())}`);
      const d = await r.json();
      if (d.subscribed && d.subscriber) {
        setExistingSub(d.subscriber);
        // Pre-fill form with existing preferences
        setEmail(d.subscriber.email);
        setFrequency(d.subscriber.frequency || 'daily');
        setTopics(d.subscriber.topics || ['General', 'Technology', 'Business']);
      }
      setStep('form');
    } catch {
      setStep('form');
    }
  };

  const toggleTopic = (cat: string) => {
    setTopics(prev => prev.includes(cat) ? prev.filter(t => t !== cat) : [...prev, cat]);
  };

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!topics.length)                  { setError('Please select at least one topic.');  return; }

    setLoading(true);
    try {
      const r    = await fetch(`${url}/api/newsletter/subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), name: name.trim(), frequency, topics, max_per_week: maxPerWeek }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Subscription failed');

      // ✅ Handle different response types
      if (data.already)      setStep('updated');
      else if (data.reactivated) setStep('reactivated');
      else                   setStep('success');

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Checking state ──────────────────────────────────────────
  if (step === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Checking subscription status…</p>
        </div>
      </div>
    );
  }

  // ── Success states ──────────────────────────────────────────
  if (step === 'success' || step === 'updated' || step === 'reactivated') {
    const chosen = FREQ_OPTIONS.find(f => f.value === frequency)!;
    const isNew  = step === 'success';
    const isBack = step === 'reactivated';

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>

          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
            {isNew ? '🎉' : isBack ? '👋' : '✅'}
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            {isNew  ? "You're subscribed!"     : ''}
            {step === 'updated'     ? 'Preferences Updated!'  : ''}
            {step === 'reactivated' ? 'Welcome Back!'         : ''}
          </h1>

          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
            {isNew  && <>Check your inbox — we've sent a welcome email to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.</>}
            {step === 'updated'     && <>Your newsletter preferences for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> have been updated.</>}
            {step === 'reactivated' && <>Your subscription for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> has been reactivated. Welcome back!</>}
          </p>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 28, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
              Your Preferences
            </div>
            {[
              { label: 'Frequency',    value: chosen.label,         color: chosen.color },
              { label: 'Timing',       value: chosen.when,          color: 'var(--text-secondary)' },
              { label: 'Topics',       value: topics.join(', '),    color: 'var(--text-secondary)' },
              { label: 'Max per week', value: `${maxPerWeek} emails`, color: 'var(--text-secondary)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ fontSize: 12, color: row.color, fontWeight: 700, textAlign: 'right', maxWidth: '55%' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Back to NewsHub <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Form state ──────────────────────────────────────────────
  const chosen = FREQ_OPTIONS.find(f => f.value === frequency)!;
  const isExisting = !!existingSub;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 32, padding: 0 }}>
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79,124,255,0.1)', border: '1px solid rgba(79,124,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={20} color="var(--accent-blue)" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {isExisting ? 'Update Preferences' : 'NewsHub Newsletter'}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                {isExisting ? `Managing subscription for ${existingSub.email}` : 'Important news only. Never spam.'}
              </p>
            </div>
          </div>

          {/* Already subscribed banner */}
          {isExisting && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, marginTop: 14 }}>
              <Check size={16} color="var(--accent-green)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>Already Subscribed</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  You're on the <strong>{existingSub.frequency}</strong> plan. Update your preferences below.
                </div>
              </div>
            </div>
          )}

          {!isExisting && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {['AI-filtered importance scoring', 'You control the frequency', 'One-click unsubscribe'].map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 99, fontSize: 11, fontWeight: 600, color: 'var(--accent-green)' }}>
                  <Check size={10} strokeWidth={3} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Email + Name */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            Your Details
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address *</label>
              <input
                type="email" placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setExistingSub(null); }}
                disabled={isExisting}
                style={{ width: '100%', padding: '10px 14px', background: isExisting ? 'var(--bg-elevated)' : 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: isExisting ? 0.7 : 1 }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name (optional)</label>
              <input
                type="text" placeholder="Your name"
                value={name} onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {/* Check different email */}
          {!isExisting && (
            <button
              onClick={() => { if (email.includes('@')) checkStatus(email); }}
              style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={11} /> Check if already subscribed
            </button>
          )}
        </div>

        {/* Frequency */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>How Often?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FREQ_OPTIONS.map(opt => {
              const Icon     = opt.icon;
              const selected = frequency === opt.value;
              return (
                <button key={opt.value} onClick={() => setFrequency(opt.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: selected ? `${opt.color}0d` : 'var(--bg-elevated)', border: `1px solid ${selected ? opt.color + '40' : 'var(--border)'}`, borderRadius: 11, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${opt.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={opt.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: selected ? opt.color : 'var(--text-primary)', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{opt.when}</div>
                  {selected && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topics */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Topics You Care About</div>
            <span style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{topics.length} selected</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const active = topics.includes(cat);
              return (
                <button key={cat} onClick={() => toggleTopic(cat)}
                  style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.2s', background: active ? 'var(--accent-blue)' : 'var(--bg-elevated)', color: active ? '#fff' : 'var(--text-muted)', outline: active ? 'none' : '1px solid var(--border)' }}>
                  {active && <Check size={11} strokeWidth={3} style={{ marginRight: 5, verticalAlign: 'middle' }} />}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Max per week */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Max Emails Per Week</div>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)' }}>{maxPerWeek}</span>
          </div>
          <input type="range" min={1} max={14} step={1} value={maxPerWeek}
            onChange={e => setMaxPerWeek(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-blue)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>
            <span>1 — Minimal</span><span>7 — Daily</span><span>14 — Maximum</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', padding: '15px', background: loading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent-blue), #7c5cfc)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s', letterSpacing: '-0.01em' }}>
          {loading ? (
            <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Processing…</>
          ) : (
            isExisting ? <><RefreshCw size={16} /> Update My Preferences</> : <><Mail size={16} /> Subscribe to NewsHub</>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
          No spam, ever. Unsubscribe with one click at any time.
        </p>

      </div>
    </div>
  );
}