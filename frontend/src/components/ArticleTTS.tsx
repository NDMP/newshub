import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Square, ChevronUp, ChevronDown, Zap, BookOpen, RotateCcw, Settings, X } from 'lucide-react';

// ══════════════════════════════════════════════════════════
//  LANGUAGE CONFIG
// ══════════════════════════════════════════════════════════
const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)',  flag: '🇮🇳', script: null },
  { code: 'hi-IN', label: 'Hindi',            flag: '🇮🇳', script: /[\u0900-\u097F]/ },
  { code: 'ta-IN', label: 'Tamil',            flag: '🇮🇳', script: /[\u0B80-\u0BFF]/ },
  { code: 'te-IN', label: 'Telugu',           flag: '🇮🇳', script: /[\u0C00-\u0C7F]/ },
  { code: 'bn-IN', label: 'Bengali',          flag: '🇮🇳', script: /[\u0980-\u09FF]/ },
  { code: 'mr-IN', label: 'Marathi',          flag: '🇮🇳', script: /[\u0900-\u097F]/ },
  { code: 'gu-IN', label: 'Gujarati',         flag: '🇮🇳', script: /[\u0A80-\u0AFF]/ },
  { code: 'kn-IN', label: 'Kannada',          flag: '🇮🇳', script: /[\u0C80-\u0CFF]/ },
  { code: 'ml-IN', label: 'Malayalam',        flag: '🇮🇳', script: /[\u0D00-\u0D7F]/ },
  { code: 'pa-IN', label: 'Punjabi',          flag: '🇮🇳', script: /[\u0A00-\u0A7F]/ },
  { code: 'ur-IN', label: 'Urdu',             flag: '🇮🇳', script: /[\u0600-\u06FF]/ },
  { code: 'or-IN', label: 'Odia',             flag: '🇮🇳', script: /[\u0B00-\u0B7F]/ },
  { code: 'as-IN', label: 'Assamese',         flag: '🇮🇳', script: /[\u0980-\u09FF]/ },
];

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════

/** Detect language from article text */
function detectLanguage(text: string): string {
  for (const lang of LANGUAGES) {
    if (lang.script && lang.script.test(text)) return lang.code;
  }
  return 'en-IN';
}

/** Clean text for speech */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[.*?\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into sentences */
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/** Extract key points from article */
function extractKeyPoints(title: string, content: string): { text: string; type: string; sentenceIndex: number }[] {
  const sentences = toSentences(cleanText(content));
  const keyPoints: { text: string; type: string; sentenceIndex: number }[] = [];
  const seen = new Set<string>();

  const add = (text: string, type: string, idx: number) => {
    const t = text.trim();
    if (t.length < 20 || seen.has(t)) return;
    seen.add(t);
    keyPoints.push({ text: t, type, sentenceIndex: idx });
  };

  // Title is always key
  add(title, 'Headline', -1);

  sentences.forEach((s, i) => {
    const lower = s.toLowerCase();
    if (/\d+(%|crore|lakh|million|billion|thousand|percent|rs\.?|rupee)/i.test(s)) {
      add(s, 'Statistic', i);
    } else if (/"[^"]{10,}"/.test(s) || /said|stated|announced|confirmed|according to/.test(lower)) {
      add(s, 'Quote', i);
    } else if (/announced|launched|approved|signed|passed|rejected|won|lost|died|arrested/.test(lower)) {
      add(s, 'Event', i);
    } else if (/impact|affect|result|consequence|therefore|thus|hence/.test(lower)) {
      add(s, 'Impact', i);
    } else if (i === 0 || i === 1) {
      add(s, 'Lead', i);
    } else if (i === sentences.length - 1) {
      add(s, 'Conclusion', i);
    }
  });

  return keyPoints.slice(0, 10);
}

const TYPE_COLOR: Record<string, string> = {
  Headline:   'var(--accent-blue)',
  Statistic:  'var(--accent-teal)',
  Quote:      'var(--accent-purple)',
  Event:      'var(--accent-amber)',
  Impact:     'var(--accent-red)',
  Lead:       'var(--accent-green)',
  Conclusion: 'var(--text-muted)',
};

const TYPE_ICON: Record<string, string> = {
  Headline:   '📰', Statistic: '📊', Quote: '💬',
  Event:      '⚡', Impact:    '🎯', Lead:  '🔵', Conclusion: '🔚',
};

// ══════════════════════════════════════════════════════════
//  PROPS
// ══════════════════════════════════════════════════════════
interface ArticleTTSProps {
  title:   string;
  content: string;
}

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function ArticleTTS({ title, content }: ArticleTTSProps) {
  const [supported, setSupported]       = useState(true);
  const [open, setOpen]                 = useState(false);
  const [showPanel, setShowPanel]       = useState(false);
  const [tab, setTab]                   = useState<'player' | 'keypoints' | 'settings'>('player');

  // Playback state
  const [playing, setPlaying]           = useState(false);
  const [paused,  setPaused]            = useState(false);
  const [mode,    setMode]              = useState<'full' | 'keypoints'>('full');
  const [speed,   setSpeed]             = useState(1);
  const [langCode, setLangCode]         = useState(() => detectLanguage(title + ' ' + content));
  const [voices,  setVoices]            = useState<SpeechSynthesisVoice[]>([]);
  const [voice,   setVoice]             = useState<SpeechSynthesisVoice | null>(null);

  // Progress
  const [currentSentence, setCurrentSentence] = useState(-1);
  const [currentKP,       setCurrentKP]       = useState(-1);
  const [progress,        setProgress]         = useState(0);

  // Data
  const sentences  = useRef<string[]>([]);
  const keyPoints  = useRef<{ text: string; type: string; sentenceIndex: number }[]>([]);
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);
  const chunkIdx   = useRef(0);
  const totalChunks = useRef(0);
  const isStopped  = useRef(false);

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    if (!window.speechSynthesis) { setSupported(false); return; }

    const full = `${title}. ${cleanText(content)}`;
    sentences.current = toSentences(full);
    keyPoints.current = extractKeyPoints(title, content);

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      setVoices(all);
      // Try to find matching voice
      const match = all.find(v => v.lang === langCode)
        || all.find(v => v.lang.startsWith(langCode.split('-')[0]))
        || all[0];
      setVoice(match || null);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => { stopAll(); };
  }, [title, content]);

  // ── Voice filter by lang ──────────────────────────────
  const filteredVoices = voices.filter(v =>
    v.lang === langCode || v.lang.startsWith(langCode.split('-')[0])
  );

  // ── Stop everything ───────────────────────────────────
  const stopAll = useCallback(() => {
    isStopped.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false); setPaused(false);
    setCurrentSentence(-1); setCurrentKP(-1); setProgress(0);
    chunkIdx.current = 0;
  }, []);

  // ── Speak a single chunk ──────────────────────────────
  const speakChunk = useCallback((chunks: string[], idx: number, startSentenceIdx: number) => {
    if (isStopped.current || idx >= chunks.length) {
      setPlaying(false); setPaused(false);
      setCurrentSentence(-1); setCurrentKP(-1); setProgress(0);
      return;
    }

    const utt = new SpeechSynthesisUtterance(chunks[idx]);
    utt.lang  = langCode;
    utt.rate  = speed;
    utt.pitch = mode === 'keypoints' ? 1.2 : 1;
    if (voice) utt.voice = voice;

    utt.onstart = () => {
      const si = startSentenceIdx + idx;
      setCurrentSentence(si);
      setProgress(Math.round((idx / chunks.length) * 100));
      // Find if this sentence is a key point
      const kpIdx = keyPoints.current.findIndex(kp => kp.sentenceIndex === si || chunks[idx].includes(kp.text.substring(0, 30)));
      setCurrentKP(kpIdx);
    };

    utt.onend = () => {
      if (!isStopped.current) {
        chunkIdx.current = idx + 1;
        speakChunk(chunks, idx + 1, startSentenceIdx);
      }
    };

    utt.onerror = (e) => {
      if (e.error !== 'interrupted') {
        console.error('[TTS]', e.error);
        setPlaying(false);
      }
    };

    window.speechSynthesis.speak(utt);
  }, [langCode, speed, voice, mode]);

  // ── Play ──────────────────────────────────────────────
  const play = useCallback(() => {
    if (!supported) return;
    stopAll();
    isStopped.current = false;

    let chunks: string[];
    if (mode === 'keypoints') {
      chunks = keyPoints.current.map(kp => kp.text);
    } else {
      chunks = sentences.current;
    }

    if (!chunks.length) return;
    totalChunks.current = chunks.length;
    setPlaying(true); setPaused(false);
    speakChunk(chunks, 0, 0);
  }, [mode, speakChunk, stopAll, supported]);

  // ── Pause / Resume ────────────────────────────────────
  const togglePause = useCallback(() => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [paused]);

  // ── Jump to key point ─────────────────────────────────
  const jumpToKeyPoint = useCallback((kpIdx: number) => {
    if (!supported) return;
    stopAll();
    isStopped.current = false;

    const remaining = keyPoints.current.slice(kpIdx).map(kp => kp.text);
    if (!remaining.length) return;
    setMode('keypoints');
    setPlaying(true); setPaused(false);
    setCurrentKP(kpIdx);
    speakChunk(remaining, 0, kpIdx);
  }, [speakChunk, stopAll, supported]);

  // ── Repeat last KP ────────────────────────────────────
  const repeatLastKP = useCallback(() => {
    if (currentKP >= 0) jumpToKeyPoint(currentKP);
  }, [currentKP, jumpToKeyPoint]);

  // ── When speed/voice/lang changes, restart if playing ─
  useEffect(() => {
    if (playing && !paused) { play(); }
  }, [speed, voice, langCode]);

  if (!supported) return null;

  const kps = keyPoints.current;
  const langInfo = LANGUAGES.find(l => l.code === langCode);

  // ══════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════
  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Read Article Aloud"
        style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 301,
          width: 52, height: 52, borderRadius: '50%',
          background: playing ? 'var(--accent-green)' : 'var(--bg-elevated)',
          border: `2px solid ${playing ? 'var(--accent-green)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: playing ? '0 4px 20px rgba(34,197,94,0.4)' : 'var(--shadow-md)',
          color: playing ? '#fff' : 'var(--text-secondary)',
        }}
        onMouseEnter={e => { if (!playing) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
        onMouseLeave={e => { if (!playing) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
      >
        {playing && !paused
          ? <WaveIcon />
          : <Volume2 size={20} />
        }
      </button>

      {/* ── Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 160, right: 28, zIndex: 302,
          width: 360, background: 'var(--bg-secondary)',
          border: '1px solid var(--border)', borderRadius: 20,
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}>

          {/* Header */}
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Volume2 size={15} color="var(--accent-blue)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Read Aloud</span>
              {playing && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: 'var(--accent-green)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {paused ? 'PAUSED' : 'LIVE'}
                </span>
              )}
            </div>
            <button onClick={() => { stopAll(); setOpen(false); }} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {([['player', '🎵 Player'], ['keypoints', `⚡ Key Points (${kps.length})`], ['settings', '⚙️ Settings']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 6px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: tab === t ? 'var(--bg-secondary)' : 'var(--bg-card)',
                color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}>{label}</button>
            ))}
          </div>

          {/* ── PLAYER TAB ── */}
          {tab === 'player' && (
            <div style={{ padding: 18 }}>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10 }}>
                {([['full', <BookOpen size={11}/>, 'Full Article'], ['keypoints', <Zap size={11}/>, 'Key Points Only']] as const).map(([m, icon, label]) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: mode === m ? 'var(--bg-secondary)' : 'transparent',
                    color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  }}>{icon} {label}</button>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal))', borderRadius: 99, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{progress}% complete</span>
                  {currentKP >= 0 && <span style={{ color: 'var(--accent-teal)' }}>⚡ {kps[currentKP]?.type}</span>}
                </div>
              </div>

              {/* Current sentence preview */}
              {currentSentence >= 0 && sentences.current[currentSentence] && (
                <div style={{ padding: '10px 12px', background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.2)', borderRadius: 10, marginBottom: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  🔊 {sentences.current[currentSentence]}
                </div>
              )}

              {/* Main controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
                {/* Repeat KP */}
                <button onClick={repeatLastKP} disabled={currentKP < 0} title="Repeat last key point"
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentKP >= 0 ? 'pointer' : 'not-allowed', color: currentKP >= 0 ? 'var(--text-secondary)' : 'var(--border)', transition: 'all 0.2s' }}>
                  <RotateCcw size={14} />
                </button>

                {/* Stop */}
                <button onClick={stopAll} disabled={!playing && !paused}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: playing || paused ? 'pointer' : 'not-allowed', color: playing || paused ? 'var(--accent-red)' : 'var(--border)', transition: 'all 0.2s' }}>
                  <Square size={14} />
                </button>

                {/* Play / Pause main */}
                <button onClick={playing ? togglePause : play}
                  style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-blue)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', boxShadow: '0 4px 16px rgba(79,124,255,0.35)', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  {playing && !paused ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: 2 }} />}
                </button>

                {/* Jump next KP */}
                <button onClick={() => jumpToKeyPoint(Math.min(currentKP + 1, kps.length - 1))} title="Next key point"
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', fontSize: 16 }}>
                  <ChevronUp size={16} />
                </button>

                {/* Mute/stop with icon */}
                <button onClick={() => { setMode(m => m === 'full' ? 'keypoints' : 'full'); }}
                  title={`Switch to ${mode === 'full' ? 'key points' : 'full article'} mode`}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: mode === 'keypoints' ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)', border: `1px solid ${mode === 'keypoints' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: mode === 'keypoints' ? 'var(--accent-amber)' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                  <Zap size={14} />
                </button>
              </div>

              {/* Speed */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Speed</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)} style={{
                      flex: 1, padding: '6px 2px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      background: speed === s ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                      color: speed === s ? '#fff' : 'var(--text-muted)',
                    }}>{s}x</button>
                  ))}
                </div>
              </div>

              {/* Language quick select */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Language — {langInfo?.label}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {LANGUAGES.slice(0, 6).map(l => (
                    <button key={l.code} onClick={() => { setLangCode(l.code); const v = voices.find(vv => vv.lang === l.code || vv.lang.startsWith(l.code.split('-')[0])); if (v) setVoice(v); }} style={{
                      padding: '4px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                      background: langCode === l.code ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                      color: langCode === l.code ? '#fff' : 'var(--text-muted)',
                    }}>{l.flag} {l.label.split(' ')[0]}</button>
                  ))}
                  <button onClick={() => setTab('settings')} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                    More →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── KEY POINTS TAB ── */}
          {tab === 'keypoints' && (
            <div style={{ padding: 16, maxHeight: 380, overflowY: 'auto' }}>
              {kps.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No key points detected.</p>
              ) : kps.map((kp, i) => (
                <div key={i} onClick={() => jumpToKeyPoint(i)} style={{
                  padding: '12px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                  background: currentKP === i ? `${TYPE_COLOR[kp.type]}12` : 'var(--bg-card)',
                  border: `1px solid ${currentKP === i ? TYPE_COLOR[kp.type] : 'var(--border)'}`,
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = currentKP === i ? TYPE_COLOR[kp.type] : 'var(--border)'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: TYPE_COLOR[kp.type], display: 'flex', alignItems: 'center', gap: 4 }}>
                      {TYPE_ICON[kp.type]} {kp.type.toUpperCase()}
                    </span>
                    {currentKP === i && playing && !paused && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 99 }}>▶ NOW</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {kp.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {tab === 'settings' && (
            <div style={{ padding: 16, maxHeight: 380, overflowY: 'auto' }}>

              {/* All languages */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Language</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {LANGUAGES.map(l => {
                    const count = voices.filter(v => v.lang === l.code || v.lang.startsWith(l.code.split('-')[0])).length;
                    return (
                      <button key={l.code} onClick={() => { setLangCode(l.code); const v = voices.find(vv => vv.lang === l.code || vv.lang.startsWith(l.code.split('-')[0])); if (v) setVoice(v); }} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', borderRadius: 9, cursor: 'pointer', border: 'none', transition: 'all 0.2s', textAlign: 'left',
                        background: langCode === l.code ? 'rgba(79,124,255,0.08)' : 'var(--bg-elevated)',
                        border: `1px solid ${langCode === l.code ? 'var(--accent-blue)' : 'var(--border)'}`,
                      }}>
                        <span style={{ fontSize: 13 }}>{l.flag} <span style={{ fontWeight: 600, color: langCode === l.code ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{l.label}</span></span>
                        <span style={{ fontSize: 10, color: count > 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {count > 0 ? `${count} voice${count > 1 ? 's' : ''}` : 'no voice'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice selector */}
              {filteredVoices.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Voice</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredVoices.map(v => (
                      <button key={v.name} onClick={() => setVoice(v)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 9, cursor: 'pointer', border: 'none', textAlign: 'left', transition: 'all 0.2s',
                        background: voice?.name === v.name ? 'rgba(79,124,255,0.08)' : 'var(--bg-elevated)',
                        border: `1px solid ${voice?.name === v.name ? 'var(--accent-blue)' : 'var(--border)'}`,
                      }}>
                        <span style={{ fontSize: 12, color: voice?.name === v.name ? 'var(--accent-blue)' : 'var(--text-secondary)', fontWeight: voice?.name === v.name ? 700 : 400 }}>
                          {v.name}
                        </span>
                        {v.localService && <span style={{ fontSize: 9, color: 'var(--accent-green)', fontWeight: 700 }}>LOCAL</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredVoices.length === 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--accent-amber)' }}>
                  ⚠️ No voices found for {langInfo?.label}. Your OS may not have this language installed. English will be used.
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
            Powered by Web Speech API · Works offline
          </div>
        </div>
      )}
    </>
  );
}

// ── Animated wave icon when playing ──────────────────────
function WaveIcon() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 99,
          background: '#fff',
          animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
          height: `${8 + i * 3}px`,
        }} />
      ))}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}
