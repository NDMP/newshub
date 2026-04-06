import React, { useState, useEffect } from 'react';

const FAQ_DATA = [
  {
    question: "How is the bias score calculated?",
    answer: "Our AI analyzes linguistic markers, framing patterns, loaded language, and source reliability to generate a normalized score between 0 and 1. Every article goes through a 6-agent pipeline."
  },
  {
    question: "How often is the news updated?",
    answer: "NewsHub automatically syncs every 15 minutes from 100+ global sources. You can also trigger a manual sync or force refresh from the dashboard."
  },
  {
    question: "What are Narrative Threads?",
    answer: "Our AI groups related articles into story threads, tracking how a topic evolves over time across different sources and languages."
  }
];

const STATS = [
  { value: '6', label: 'AI Agents' },
  { value: '100+', label: 'News Sources' },
  { value: '15m', label: 'Sync Interval' },
  { value: '10+', label: 'Languages' },
];

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-container">

      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="logo">News<span>Hub</span></div>
        <button className="login-btn" onClick={onGetStarted}>Sign In →</button>
      </nav>

      {/* ── Hero ── */}
      <main className="landing-hero animate-on-scroll">
        <div className="hero-content">
          <div className="badge">AI-Powered News Intelligence</div>
          <h1>Understand the news.<br />Not just read it.</h1>
          <p>
            NewsHub uses 6 AI agents to analyze every article for bias,
            propaganda, and reliability — giving you the full picture,
            not just the headline.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onGetStarted}>
              Start Exploring
            </button>
            <button className="secondary-btn" onClick={() => {
              document.querySelector('.features-grid')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              See Features
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--text-accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-mockup">
          <div className="glow-orb" />
          <div className="mockup-window">
            <div className="mockup-header">
              <div className="dot" /><div className="dot" /><div className="dot" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>NewsHub — Live Feed</span>
            </div>
            <div className="mockup-body">
              {/* Simulated article card */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reuters</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· 2 min ago</span>
                </div>
                <div className="skeleton-line full" style={{ marginBottom: 6 }} />
                <div className="skeleton-line half" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden', marginRight: 12 }}>
                    <div style={{ width: '25%', height: '100%', background: 'var(--accent-green)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 99 }}>Low Bias</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fox News</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· 5 min ago</span>
                </div>
                <div className="skeleton-line full" style={{ marginBottom: 6 }} />
                <div className="skeleton-line" style={{ width: '75%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden', marginRight: 12 }}>
                    <div style={{ width: '72%', height: '100%', background: 'var(--accent-red)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-red)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 99 }}>High Bias</span>
                </div>
              </div>

              <div className="skeleton-grid">
                <div className="skeleton-box" />
                <div className="skeleton-box" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Features ── */}
      <section className="features-grid animate-on-scroll">
        {[
          { tag: 'Live', title: 'Real-time Feed', desc: 'Syncs every 15 minutes from 100+ sources across 10 languages. Never miss a breaking story.' },
          { tag: 'AI', title: 'Bias Detection', desc: '6 AI agents analyze every article for loaded language, framing, and propaganda techniques.' },
          { tag: 'Intel', title: 'Narrative Threads', desc: 'AI groups related articles into story threads, showing how narratives evolve over time.' },
          { tag: 'Map', title: 'Story Graph', desc: 'Visual force-directed graph showing how articles connect and where contradictions exist.' },
          { tag: 'World', title: 'Cross-language', desc: 'Compare how the same story is covered differently in Spanish, French, German and more.' },
          { tag: 'Chat', title: 'AI Assistant', desc: 'Ask anything about current events. The AI searches live news to answer your question.' },
        ].map(f => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon">{f.tag}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className="how-it-works animate-on-scroll">
        <h2>How NewsHub Works</h2>
        <p className="section-description">
          Every article enters a 6-agent AI pipeline: TrackerAgent groups it into
          a narrative thread, PropagandaAgent detects manipulation, ClaimsAgent
          extracts key facts, ContradictionAgent finds conflicts between sources,
          SummarizerAgent writes a neutral summary, and AlertAgent flags escalating stories.
        </p>
        <p className="section-description">
          The result is not just a news feed — it's a complete intelligence layer
          on top of global media.
        </p>
      </section>

      {/* ── Testimonials ── */}
      <section className="reviews-marquee-section animate-on-scroll">
        <div className="section-title">
          <label>What People Say</label>
          <h2>Built for clarity.</h2>
        </div>
        <div className="marquee">
          <div className="marquee-content">
            {[1, 2].map(i => (
              <React.Fragment key={i}>
                {[
                  { text: '"The bias breakdown changed how I read news. I finally see the full picture."', name: 'Sarah Chen, Policy Analyst' },
                  { text: '"The narrative threads feature is incredible. Watching a story evolve in real time."', name: 'Marcus T., Researcher' },
                  { text: '"Finally, news that doesn\'t feel like an agenda. Pure data, pure intelligence."', name: 'Dr. Elena V., Journalist' },
                  { text: '"The propaganda detection is eye-opening. Every article has techniques I never noticed."', name: 'Raj P., Student' },
                ].map((r, j) => (
                  <div className="review-card" key={j}>
                    <p>{r.text}</p>
                    <strong>{r.name}</strong>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faq-section animate-on-scroll">
        <div className="section-title">
          <label>FAQ</label>
          <h2>Good questions.</h2>
        </div>
        <div className="faq-accordion">
          {FAQ_DATA.map((item, i) => (
            <div key={i} className={`faq-node ${openFaq === i ? 'active' : ''}`}>
              <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {item.question}
                <span className="faq-icon">{openFaq === i ? '−' : '+'}</span>
              </button>
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="animate-on-scroll" style={{ textAlign: 'center', padding: '40px 40px 80px', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 400, color: 'var(--text-accent)', letterSpacing: '-0.03em', marginBottom: 16 }}>
          Ready to see the truth?
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 28 }}>
          Join NewsHub and read with intelligence.
        </p>
        <button className="primary-btn" onClick={onGetStarted} style={{ fontSize: 15, padding: '14px 36px' }}>
          Get Started — It's Free
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="logo" style={{ fontSize: '1.1rem' }}>News<span>Hub</span></div>
          <p>© 2026 NewsHub Intelligence. Final Year Project.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
