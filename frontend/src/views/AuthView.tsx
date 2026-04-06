// frontend/src/components/AuthView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

const CSS = `
  .nh-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(6,6,12,0.85);
    backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: nhFadeIn 0.2s ease;
  }
  @keyframes nhFadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes nhSlideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes nhSpin    { to{transform:rotate(360deg)} }

  .nh-card {
    position: relative; width: 100%; max-width: 420px;
    background: #0f0f1a; border: 1px solid #1e1e30; border-radius: 20px;
    padding: 36px 32px 28px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
    animation: nhSlideUp 0.25s ease;
  }
  .nh-close {
    position:absolute; top:14px; right:14px;
    width:32px; height:32px; border-radius:50%;
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);
    color:#9090a8; font-size:18px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; transition:all 0.15s;
  }
  .nh-close:hover { background:rgba(239,68,68,0.12); color:#ef4444; border-color:rgba(239,68,68,0.3); }

  .nh-logo { font-size:13px; font-weight:700; color:#60607a; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:20px; }
  .nh-logo span { color:#4f7cff; }
  .nh-title { font-size:26px; font-weight:800; color:#fff; letter-spacing:-0.03em; margin-bottom:6px; }
  .nh-sub   { font-size:13px; color:#60607a; margin-bottom:24px; }

  .nh-error {
    background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);
    border-radius:10px; padding:11px 14px; font-size:13px; color:#ef4444; margin-bottom:16px; line-height:1.5;
  }
  .nh-ok {
    background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.25);
    border-radius:10px; padding:11px 14px; font-size:13px; color:#22c55e; margin-bottom:16px; line-height:1.5;
  }
  .nh-label {
    display:block; font-size:11px; font-weight:700; letter-spacing:0.07em;
    text-transform:uppercase; color:#60607a; margin-bottom:8px;
  }
  .nh-field {
    width:100%; padding:11px 14px;
    background:#16161f; border:1.5px solid #1e1e2a; border-radius:10px;
    color:#f0f0f5; font-size:14px; outline:none; font-family:inherit;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .nh-field:focus { border-color:#4f7cff; box-shadow:0 0 0 3px rgba(79,124,255,0.15); }
  .nh-field::placeholder { color:#3a3a50; }
  .nh-group { margin-bottom:16px; }

  .nh-pw-wrap { position:relative; }
  .nh-pw-wrap .nh-field { padding-right:44px; }
  .nh-eye {
    position:absolute; right:12px; top:50%; transform:translateY(-50%);
    background:none; border:none; cursor:pointer; font-size:16px;
    opacity:0.5; transition:opacity 0.15s; padding:0; line-height:1;
  }
  .nh-eye:hover { opacity:1; }

  .nh-strength {
    font-size:11px; font-weight:700; margin-top:7px;
    padding:4px 10px; border-radius:6px; display:inline-block;
  }
  .nh-strength.weak   { color:#ef4444; background:rgba(239,68,68,0.08); }
  .nh-strength.ok     { color:#f59e0b; background:rgba(245,158,11,0.08); }
  .nh-strength.strong { color:#22c55e; background:rgba(34,197,94,0.08); }

  .nh-forgot {
    display:block; background:none; border:none; color:#60607a; font-size:12px;
    cursor:pointer; text-align:right; padding:0; margin:-8px 0 16px;
    transition:color 0.15s; font-family:inherit;
  }
  .nh-forgot:hover { color:#4f7cff; }

  .nh-btn {
    width:100%; padding:13px; border:none; border-radius:10px;
    background:linear-gradient(135deg,#4f7cff 0%,#7c5cfc 100%);
    color:#fff; font-size:14px; font-weight:700; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    font-family:inherit; transition:all 0.2s; letter-spacing:0.01em;
  }
  .nh-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(79,124,255,0.35); }
  .nh-btn:disabled { opacity:0.45; cursor:not-allowed; }

  .nh-spinner {
    width:16px; height:16px;
    border:2.5px solid rgba(255,255,255,0.3); border-top-color:#fff;
    border-radius:50%; animation:nhSpin 0.7s linear infinite;
  }
  .nh-toggle { text-align:center; margin-top:20px; font-size:13px; color:#60607a; }
  .nh-toggle button {
    background:none; border:none; color:#4f7cff; font-size:13px;
    font-weight:700; cursor:pointer; margin-left:5px; font-family:inherit; transition:color 0.15s;
  }
  .nh-toggle button:hover { color:#7c9fff; }

  /* OTP boxes */
  .nh-otp-wrap {
    display:flex; gap:10px; justify-content:center; margin:24px 0 8px;
  }
  .nh-otp-digit {
    width:52px; height:60px;
    background:#16161f; border:2px solid #1e1e2a; border-radius:12px;
    color:#4f7cff; font-size:24px; font-weight:800; text-align:center;
    font-family:'Courier New',monospace; outline:none;
    transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
    caret-color:transparent; user-select:none;
    -webkit-user-select:none;
  }
  .nh-otp-digit:focus {
    border-color:#4f7cff;
    box-shadow:0 0 0 3px rgba(79,124,255,0.2);
    background:#1a1a28;
  }
  .nh-otp-digit.filled {
    border-color:rgba(79,124,255,0.6);
    background:rgba(79,124,255,0.06);
  }

  .nh-timer-bar { height:3px; border-radius:99px; background:#1e1e2a; margin:0 0 12px; overflow:hidden; }
  .nh-timer-fill {
    height:100%; border-radius:99px;
    background:linear-gradient(90deg,#4f7cff,#22c55e);
    transition:width 1s linear;
  }
  .nh-timer-fill.warn { background:linear-gradient(90deg,#f59e0b,#ef4444); }

  .nh-timer {
    text-align:center; font-size:13px; font-weight:600; color:#22c55e;
    margin-bottom:20px; display:flex; align-items:center; justify-content:center; gap:6px;
  }
  .nh-timer.warn { color:#f59e0b; }
  .nh-timer.dead { color:#ef4444; }

  .nh-otp-hint { text-align:center; font-size:12px; color:#60607a; margin-bottom:20px; line-height:1.6; }
  .nh-otp-hint strong { color:#9090a8; }

  .nh-resend-row {
    display:flex; align-items:center; justify-content:center;
    gap:12px; margin-top:14px; font-size:12px; color:#60607a;
  }
  .nh-link {
    background:none; border:none; color:#4f7cff; font-size:12px;
    font-weight:600; cursor:pointer; padding:0; font-family:inherit; transition:color 0.15s;
  }
  .nh-link:disabled { opacity:0.4; cursor:not-allowed; color:#60607a; }
  .nh-link:not(:disabled):hover { color:#7c9fff; text-decoration:underline; }
`;

function injectCSS() {
  if (document.getElementById('nh-auth-css')) return;
  const s = document.createElement('style');
  s.id = 'nh-auth-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ── Countdown ──────────────────────────────────────────────────────────────
function useCountdown(seconds: number, active: boolean) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!active) { setLeft(seconds); return; }
    setLeft(seconds);
    const id = setInterval(() => setLeft(r => r <= 1 ? (clearInterval(id), 0) : r - 1), 1000);
    return () => clearInterval(id);
  }, [active, seconds]);
  return left;
}

// ── OTP Input — fully array-based, no trimEnd bug ──────────────────────────
function OTPInput({ onComplete, reset }: { onComplete: (v: string) => void; reset: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (reset) { setDigits(Array(6).fill('')); refs.current[0]?.focus(); }
  }, [reset]);

  const updateDigits = (next: string[]) => {
    setDigits(next);
    const joined = next.join('');
    onComplete(joined);
  };

  const handleChange = (i: number, raw: string) => {
    // Accept only digits
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    updateDigits(next);
    if (digit && i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 0);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = '';
        updateDigits(next);
      } else if (i > 0) {
        next[i - 1] = '';
        updateDigits(next);
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft'  && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = Array(6).fill('');
    pasted.split('').forEach((c, idx) => { next[idx] = c; });
    updateDigits(next);
    const focus = Math.min(pasted.length, 5);
    setTimeout(() => refs.current[focus]?.focus(), 0);
  };

  return (
    <div className="nh-otp-wrap">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className={`nh-otp-digit${d ? ' filled' : ''}`}
        />
      ))}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type Screen = 'signin' | 'signup' | 'forgot' | 'otp-signup' | 'otp-reset' | 'new-password';
interface Props { onAuthSuccess: (u: { email: string }) => void; onBack: () => void; }

// ── Main Component ─────────────────────────────────────────────────────────
const AuthView: React.FC<Props> = ({ onAuthSuccess, onBack }) => {
  useEffect(() => { injectCSS(); }, []);

  const [screen, setScreen]     = useState<Screen>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [newPass, setNewPass]   = useState('');
  const [otp, setOtp]           = useState('');
  const [otpReset, setOtpReset] = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [timerOn, setTimerOn]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const timeLeft  = useCountdown(300, timerOn);
  const fmt       = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const pct       = (timeLeft / 300) * 100;
  const timerCls  = timeLeft <= 60 ? 'dead' : timeLeft <= 120 ? 'warn' : '';

  const str = (p: string) => p.length >= 12 ? 'strong' : p.length >= 8 ? 'ok' : 'weak';
  const strLabel = (p: string) => p.length >= 12 ? '✅ Strong' : p.length >= 8 ? '⚠️ Acceptable' : '❌ Too short (min 8)';

  const clear = () => { setError(''); setInfo(''); };

  const startOTPScreen = (type: 'signin' | 'signup' | 'forgot', screen: Screen) => {
    setOtp('');
    setOtpReset(true);
    setTimeout(() => setOtpReset(false), 100);
    setTimerOn(false);
    setTimeout(() => setTimerOn(true), 50);
    setScreen(screen);
  };

  const sendOTP = async (type: 'signup' | 'forgot') => {
    setLoading(true); clear();
    try {
      const r = await fetch(`${API}/api/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), type }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to send OTP');
      setInfo('✅ OTP sent! Check your inbox (and spam folder).');
      if (type === 'signup') startOTPScreen(type, 'otp-signup');
      if (type === 'forgot') startOTPScreen(type, 'otp-reset');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Direct sign-in — no OTP needed
  const handleSignIn = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); clear();
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      onAuthSuccess({ email: data.user.email! });
    } catch (e: any) { setError(e.message || 'Sign-in failed. Check your credentials.'); }
    finally { setLoading(false); }
  };

  const verifySignUp = async () => {
    if (otp.replace(/\D/g,'').length < 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true); clear();
    try {
      const r = await fetch(`${API}/api/auth/verify-signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, otp: otp.replace(/\D/g,'') }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      // ✅ Set the Supabase session so the app recognizes the user
      if (d.session?.access_token && d.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token:  d.session.access_token,
          refresh_token: d.session.refresh_token,
        });
      }
      onAuthSuccess({ email: d.user?.email || email });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const verifyReset = () => {
    if (otp.replace(/\D/g,'').length < 6) { setError('Please enter all 6 digits.'); return; }
    clear(); setScreen('new-password');
  };

  const submitNewPass = async () => {
    if (newPass.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); clear();
    try {
      const r = await fetch(`${API}/api/auth/verify-reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.replace(/\D/g,''), newPassword: newPass }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setInfo('✅ Password reset! You can now sign in.');
      setScreen('signin'); setPassword(''); setNewPass('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Shared pieces ──────────────────────────────────────────────────────
  const Logo = () => <div className="nh-logo">News<span>Hub</span> ✦ Intelligence</div>;
  const Err  = () => error ? <div className="nh-error">{error}</div> : null;
  const Info = () => info  ? <div className="nh-ok">{info}</div>    : null;

  const OTPBlock = (type: 'signup' | 'forgot') => {
    const verify   = type === 'signup' ? verifySignUp : verifyReset;
    const backScr  = type === 'signup' ? 'signup' : 'forgot';
    const allFilled = otp.replace(/\D/g,'').length === 6;

    return <>
      <Err /><Info />
      <div className="nh-otp-hint">Code sent to <strong>{email}</strong></div>
      <OTPInput onComplete={setOtp} reset={otpReset} />
      <div className="nh-timer-bar">
        <div className={`nh-timer-fill${timerCls ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`nh-timer ${timerCls}`}>
        {timeLeft > 0
          ? <><span>⏱</span> Expires in <strong>{fmt(timeLeft)}</strong></>
          : <span>⛔ OTP expired — request a new one</span>}
      </div>
      <button className="nh-btn" disabled={loading || !allFilled || timeLeft === 0} onClick={verify}>
        {loading ? <span className="nh-spinner" /> : 'Verify & Continue →'}
      </button>
      <div className="nh-resend-row">
        <button className="nh-link" disabled={loading || timeLeft > 240}
          onClick={() => sendOTP(type)}>
          {timeLeft > 240 ? `Resend in ${fmt(timeLeft - 240)}` : 'Resend OTP'}
        </button>
        <span style={{opacity:0.4}}>·</span>
        <button className="nh-link" onClick={() => { clear(); setOtp(''); setScreen(backScr as Screen); }}>
          Change email
        </button>
      </div>
    </>;
  };

  return (
    <div className="nh-overlay">
      <div className="nh-card">
        <button className="nh-close" onClick={onBack}>×</button>

        {/* Sign In */}
        {screen === 'signin' && <>
          <Logo />
          <div className="nh-title">Welcome back</div>
          <div className="nh-sub">Sign in to your NewsHub account</div>
          <Err /><Info />
          <div className="nh-group">
            <label className="nh-label">Email</label>
            <input className="nh-field" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="nh-group">
            <label className="nh-label">Password</label>
            <div className="nh-pw-wrap">
              <input className="nh-field" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} />
              <button className="nh-eye" type="button" onClick={() => setShowPass(p => !p)}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <button className="nh-forgot" onClick={() => { clear(); setScreen('forgot'); }}>Forgot password?</button>
          <button className="nh-btn" disabled={loading || !email || !password} onClick={handleSignIn}>
            {loading ? <span className="nh-spinner" /> : 'Sign In →'}
          </button>
          <p className="nh-toggle">Don't have an account?
            <button onClick={() => { clear(); setScreen('signup'); }}>Create one</button>
          </p>
        </>}

        {/* Sign Up */}
        {screen === 'signup' && <>
          <Logo />
          <div className="nh-title">Create account</div>
          <div className="nh-sub">Join the elite news collective</div>
          <Err /><Info />
          <div className="nh-group">
            <label className="nh-label">Email</label>
            <input className="nh-field" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="nh-group">
            <label className="nh-label">Password</label>
            <div className="nh-pw-wrap">
              <input className="nh-field" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} />
              <button className="nh-eye" type="button" onClick={() => setShowPass(p => !p)}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {password && <div className={`nh-strength ${str(password)}`}>{strLabel(password)}</div>}
          </div>
          <button className="nh-btn" disabled={loading || !email || password.length < 8} onClick={() => sendOTP('signup')}>
            {loading ? <span className="nh-spinner" /> : '✉️ Send Verification OTP'}
          </button>
          <p className="nh-toggle">Already have an account?
            <button onClick={() => { clear(); setScreen('signin'); }}>Sign in</button>
          </p>
        </>}

        {/* Forgot Password */}
        {screen === 'forgot' && <>
          <Logo />
          <div className="nh-title">Reset password</div>
          <div className="nh-sub">We'll send a 6-digit reset code to your email</div>
          <Err /><Info />
          <div className="nh-group">
            <label className="nh-label">Email</label>
            <input className="nh-field" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button className="nh-btn" disabled={loading || !email} onClick={() => sendOTP('forgot')}>
            {loading ? <span className="nh-spinner" /> : '🔑 Send Reset Code'}
          </button>
          <p className="nh-toggle">Remember it?
            <button onClick={() => { clear(); setScreen('signin'); }}>Sign in</button>
          </p>
        </>}

        {/* OTP Screens */}
        {screen === 'otp-signup' && <>
          <Logo />
          <div className="nh-title">Verify your email</div>
          <div className="nh-sub">Confirm your email to activate your account</div>
          {OTPBlock('signup')}
        </>}

        {screen === 'otp-reset' && <>
          <Logo />
          <div className="nh-title">Reset verification</div>
          <div className="nh-sub">Enter the code to set a new password</div>
          {OTPBlock('forgot')}
        </>}

        {/* New Password */}
        {screen === 'new-password' && <>
          <Logo />
          <div className="nh-title">New password</div>
          <div className="nh-sub">OTP verified — set your new password below</div>
          <Err /><Info />
          <div className="nh-group">
            <label className="nh-label">New Password</label>
            <div className="nh-pw-wrap">
              <input className="nh-field" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                value={newPass} onChange={e => setNewPass(e.target.value)} />
              <button className="nh-eye" type="button" onClick={() => setShowPass(p => !p)}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {newPass && <div className={`nh-strength ${str(newPass)}`}>{strLabel(newPass)}</div>}
          </div>
          <button className="nh-btn" disabled={loading || newPass.length < 8} onClick={submitNewPass}>
            {loading ? <span className="nh-spinner" /> : '✅ Reset Password'}
          </button>
        </>}

      </div>
    </div>
  );
};

export default AuthView;
