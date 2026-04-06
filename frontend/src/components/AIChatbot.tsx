import { useState, useRef, useEffect } from 'react';

const SUGGESTIONS = [
  "What's big in India today?",
  "Latest IPL cricket scores?",
  "Explain today's top story simply",
  "Any technology news today?",
  "What is happening in politics?",
  "Explain inflation in simple words",
];

interface Message { role: 'user'|'bot'; text: string; time: string; }
interface Props    { onClose: () => void; }

function nowTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const AIChatbot: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'bot',
    text: "Hi! 👋 I'm your NewsHub AI.\n\nAsk me anything — today's news, cricket scores, politics, explanations, or just a chat. I remember our conversation!",
    time: nowTime(),
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  function buildHistory() {
    return messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  }

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setMessages(p => [...p, { role: 'user', text: q, time: nowTime() }]);
    setInput('');
    setLoading(true);
    try {
      let api = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      if (!api.startsWith('http')) api = `https://${api}`;
      const res  = await fetch(`${api}/api/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history: buildHistory() }),
      });
      const data = await res.json();
      const clean = (data.answer || 'No response. Try again!')
        .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim();
      setMessages(p => [...p, { role: 'bot', text: clean, time: nowTime() }]);
    } catch {
      setMessages(p => [...p, { role: 'bot', text: "Can't connect right now. Check your internet. 🔌", time: nowTime() }]);
    } finally { setLoading(false); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => setMessages([{ role: 'bot', text: "Chat cleared! Ask me anything. 🧹", time: nowTime() }]);

  return (
    <div className="chatbot-panel">

      {/* Header */}
      <div className="cbp-header">
        <div className="cbp-header-left">
          <span className="cbp-dot" />
          <div>
            <div className="cbp-title">NewsHub AI</div>
            <div className="cbp-sub">Powered by Groq · Ask anything</div>
          </div>
        </div>
        <div className="cbp-header-right">
          <button className="cbp-icon-btn" onClick={clearChat} title="Clear">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
          <button className="cbp-icon-btn" onClick={onClose} title="Close AI">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Suggestion chips */}
      {messages.length <= 1 && (
        <div className="cbp-chips">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="cbp-chip" onClick={() => send(s)} disabled={loading}>{s}</button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="cbp-messages">
        {messages.map((m, i) => (
          <div key={i} className={`cbp-row ${m.role}`}>
            <div className={`cbp-avatar ${m.role}`}>{m.role === 'bot' ? 'AI' : 'You'}</div>
            <div className="cbp-bubble-col">
              <div className={`cbp-bubble ${m.role}`}>
                {m.text.split('\n').map((line, j) => line ? <p key={j}>{line}</p> : <br key={j} />)}
              </div>
              <span className="cbp-time">{m.time}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="cbp-row bot">
            <div className="cbp-avatar bot">AI</div>
            <div className="cbp-bubble-col">
              <div className="cbp-bubble bot">
                <div className="cbp-typing"><span/><span/><span/></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="cbp-input-area">
        <textarea
          ref={inputRef}
          className="cbp-input"
          placeholder="Ask anything… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={loading}
          rows={1}
          maxLength={1000}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 96) + 'px';
          }}
        />
        <button
          className="cbp-send"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          {loading
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          }
        </button>
      </div>
      <div className="cbp-hint">Enter to send &nbsp;·&nbsp; Shift+Enter for new line</div>
    </div>
  );
};

export default AIChatbot;
