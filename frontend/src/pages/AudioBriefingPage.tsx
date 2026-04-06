import { useState, useEffect, useRef } from 'react';
import { Headphones, Play, Pause, Square, RefreshCw, Settings } from 'lucide-react';

interface Props { onBack: () => void; userId: string; userEmail: string; }

const API = (() => {
  const u = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  return u.startsWith('http') ? u : `https://${u}`;
})();

const ALL_CATS  = ['General', 'Technology', 'Business', 'Sports', 'Health', 'Entertainment'];
const SPEEDS    = [
  { id: 'slow',   label: '🐢 Slow',   rate: 0.8 },
  { id: 'normal', label: '▶️ Normal', rate: 1.0 },
  { id: 'fast',   label: '⚡ Fast',   rate: 1.35 },
];

export default function AudioBriefingPage({ onBack, userId, userEmail }: Props) {
  const displayName = (userEmail.split('@')[0] || '')
    .replace(/[._\-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const [script,   setScript]   = useState('');
  const [stories,  setStories]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [playing,  setPlaying]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [wordIdx,  setWordIdx]  = useState(-1);
  const [speed,    setSpeed]    = useState('normal');
  const [selCats,  setSelCats]  = useState(['General', 'Technology', 'Business']);
  const [count,    setCount]    = useState(5);
  const [showSet,  setShowSet]  = useState(false);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);
  const words  = script.split(' ').filter(Boolean);

  // Cleanup on unmount
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const stopSpeech = () => {
    window.speechSynthesis?.cancel();
    setPlaying(false); setPaused(false); setProgress(0); setWordIdx(-1);
  };

  const generate = async () => {
    stopSpeech();
    setLoading(true); setError(''); setScript(''); setStories([]);
    try {
      const res  = await fetch(`${API}/api/features/audio-briefing`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, categories: selCats, max_stories: count }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Server error');
      setScript(data.script || '');
      setStories(data.stories || []);
    } catch (e: any) {
      setError(e.message || 'Failed to generate briefing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const play = () => {
    if (!script) return;
    if (!window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    // Resume if paused
    if (paused && uttRef.current) {
      window.speechSynthesis.resume();
      setPlaying(true); setPaused(false);
      return;
    }

    stopSpeech();
    const rate = SPEEDS.find(s => s.id === speed)?.rate || 1;
    const utt  = new SpeechSynthesisUtterance(script);
    utt.rate   = rate;
    utt.lang   = 'en-IN';

    // Pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const pick   = voices.find(v => v.lang === 'en-IN')
      || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('india'))
      || voices.find(v => v.lang.startsWith('en-GB'))
      || voices.find(v => v.lang.startsWith('en'));
    if (pick) utt.voice = pick;

    utt.onboundary = e => {
      if (e.name === 'word') {
        const spokenSoFar = script.slice(0, e.charIndex).split(' ').length - 1;
        setWordIdx(spokenSoFar);
        setProgress(Math.min(99, Math.round((spokenSoFar / words.length) * 100)));
      }
    };
    utt.onend   = () => { setPlaying(false); setPaused(false); setProgress(100); setWordIdx(-1); };
    utt.onerror = (e: any) => {
      // 'interrupted' is normal when user stops — don't show as error
      if (e.error !== 'interrupted') {
        setError('Speech playback error. Try again.');
      }
      setPlaying(false); setPaused(false);
    };

    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
    setPlaying(true); setPaused(false);
  };

  const pause = () => {
    window.speechSynthesis?.pause();
    setPlaying(false); setPaused(true);
  };

  const toggleCat = (c: string) => {
    setSelCats(p => p.includes(c)
      ? (p.length > 1 ? p.filter(x => x !== c) : p)
      : [...p, c]
    );
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="feature-page">

      {/* Header */}
      <div className="feature-page-header">
        <div className="fph-icon-wrap fph-teal"><Headphones size={20} /></div>
        <div className="fph-text">
          <h1 className="fph-title">Audio Briefing</h1>
          <p className="fph-sub">AI-written · spoken aloud · personalised for you</p>
        </div>
        <div className="fph-action">
          <button className="fp-btn-secondary" onClick={() => setShowSet(s => !s)}>
            <Settings size={12} /> Settings
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSet && (
        <div className="audio-settings-panel">
          <div className="audio-settings-group">
            <div className="audio-settings-lbl">Categories</div>
            <div className="fp-chips">
              {ALL_CATS.map(c => (
                <button
                  key={c}
                  className={`fp-chip${selCats.includes(c) ? ' active' : ''}`}
                  onClick={() => toggleCat(c)}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className="audio-settings-group">
            <div className="audio-settings-lbl">Playback Speed</div>
            <div className="fp-chips">
              {SPEEDS.map(s => (
                <button
                  key={s.id}
                  className={`fp-chip${speed === s.id ? ' active' : ''}`}
                  onClick={() => setSpeed(s.id)}
                >{s.label}</button>
              ))}
            </div>
          </div>
          <div className="audio-settings-group">
            <div className="audio-settings-lbl">Stories: {count}</div>
            <input
              type="range" min={3} max={8} value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="audio-range"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="fc-error">⚠️ {error}</div>}

      {/* Hero (pre-generate) */}
      {!script && !loading && (
        <div className="audio-hero">
          <div className="audio-hero-icon">🎙️</div>
          <h2 className="audio-hero-title">{greeting()}, {displayName}!</h2>
          <p className="audio-hero-sub">
            Generate your personalised {count}-story briefing covering {selCats.join(', ')} news.
            The AI writes a natural radio script — then plays it aloud.
          </p>
          <button className="audio-gen-btn" onClick={generate}>
            <Headphones size={16} /> Generate My Briefing
          </button>
        </div>
      )}

      {/* Generating spinner */}
      {loading && (
        <div className="audio-hero">
          <div className="audio-hero-icon">✍️</div>
          <h2 className="audio-hero-title">Writing your briefing…</h2>
          <p className="audio-hero-sub">AI is writing a personalised radio script from today's top news.</p>
          <button className="audio-gen-btn" disabled>
            <RefreshCw size={16} className="spin" /> Generating…
          </button>
        </div>
      )}

      {/* Stories list */}
      {!loading && stories.length > 0 && (
        <div className="fp-card">
          <div className="fp-card-title">📋 Today's Stories ({stories.length})</div>
          <div className="audio-stories">
            {stories.map((s: any, i: number) => (
              <div key={i} className="audio-story">
                <div className="audio-story-n">{i + 1}</div>
                <div className="audio-story-text">
                  <span className="audio-story-title">{s.title}</span>
                  <span className="audio-story-src">{s.source} · {s.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player */}
      {!loading && script && (
        <div className="audio-player">
          {/* Progress bar */}
          <div className="audio-prog-bar">
            <div className="audio-prog-fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Controls */}
          <div className="audio-controls">
            <div className="audio-status">
              <div className={`audio-status-dot${playing ? ' playing' : ''}`} />
              <span>
                {playing ? 'Playing…' : paused ? 'Paused' : progress >= 100 ? '✅ Finished' : 'Ready to play'}
              </span>
              {progress > 0 && progress < 100 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress}%</span>
              )}
            </div>
            <div className="audio-btns">
              {!playing
                ? <button className="audio-play-btn" onClick={play}>
                    <Play size={15} fill="currentColor" />
                    {paused ? 'Resume' : progress >= 100 ? 'Replay' : 'Play'}
                  </button>
                : <button className="audio-pause-btn" onClick={pause}>
                    <Pause size={15} fill="currentColor" /> Pause
                  </button>
              }
              {(playing || paused) && (
                <button className="audio-stop-btn" onClick={stopSpeech} title="Stop">
                  <Square size={13} />
                </button>
              )}
              <button className="fp-btn-secondary" onClick={generate} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} /> New
              </button>
            </div>
          </div>

          {/* Script with word highlight */}
          <div className="audio-script">
            {words.map((w, i) => (
              <span
                key={i}
                className={`audio-word${i === wordIdx && playing ? ' active' : ''}`}
              >{w} </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
