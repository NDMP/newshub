// frontend/src/views/ArticleView.tsx
import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ShieldAlert, TrendingUp, BookOpen, AlertTriangle, Film, Minimize2, Maximize2 } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Article } from '../types';
import BiasChart from '../components/BiasChart';
import ArticleTTS from '../components/ArticleTTS';
import NewsLawyer from '../components/NewsLawyer';

interface ArticleViewProps {
  article: Article;
  onBack: () => void;
}

const biasColor = (label: string) => {
  const l = label?.toLowerCase();
  if (l === 'low')    return 'var(--bias-low)';
  if (l === 'medium') return 'var(--bias-med)';
  if (l === 'high')   return 'var(--bias-high)';
  return 'var(--text-muted)';
};

const sentimentColor = (label: string) => {
  const l = label?.toLowerCase();
  if (l === 'positive') return 'var(--accent-green)';
  if (l === 'negative') return 'var(--accent-red)';
  return 'var(--text-muted)';
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
        {payload[0].name}: {payload[0].value}%
      </div>
    );
  }
  return null;
};

// 🎬 Video Player Component
const VideoPlayer = ({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMinimized) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isMinimized) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: '320px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 1000,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'all 0.2s'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Film size={14} color="var(--accent-blue)" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Now Playing</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setIsMinimized(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px'
              }}
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#000',
      marginBottom: '24px',
      position: 'relative'
    }}>
      <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
      </div>
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            backdropFilter: 'blur(4px)'
          }}
        >
          <Minimize2 size={18} />
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(0,0,0,0.7)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            backdropFilter: 'blur(4px)'
          }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

const ArticleView: React.FC<ArticleViewProps> = ({ article, onBack }) => {
  const [biasData, setBiasData] = useState<any>(null);
  const [loadingBias, setLoadingBias] = useState(false);
  
  // 🎬 Video state
  const [videos, setVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  // Fetch videos when article loads
  useEffect(() => {
    if (article?.id) {
      fetchVideos();
    }
  }, [article]);

  const fetchVideos = async () => {
    if (!article) return;
    setLoadingVideos(true);
    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;

      const response = await fetch(`${apiUrl}/api/videos/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    article.title,
          category: article.category
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log('[VIDEOS] Found:', data.videos?.length || 0, '| Query:', data.query);

      if (data.videos && data.videos.length > 0) {
        setVideos(data.videos);
        setSelectedVideo(data.videos[0]);
      } else {
        setVideos([]);
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error('[VIDEOS] Failed to fetch:', error);
      setVideos([]);
      setSelectedVideo(null);
    } finally {
      setLoadingVideos(false);
    }
  };

  const compareBias = async () => {
    setLoadingBias(true);
    try {
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      if (!apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
      const res  = await fetch(`${apiUrl}/api/bias-comparison/${article.id}`);
      const data = await res.json();
      setBiasData(data);
    } catch (err) {
      console.error('Bias comparison error', err);
    } finally {
      setLoadingBias(false);
    }
  };

  let breakdown: any = {};
  try {
    breakdown = typeof article.bias_breakdown === 'string'
      ? JSON.parse(article.bias_breakdown || '{}')
      : (article.bias_breakdown || {});
  } catch { /* ignore */ }

  // ✅ Intelligence Scores - RESTORED
  const objectivityScore = Math.round((1 - (article.bias_score || 0.5)) * 100);
  const reliabilityScore = Math.round((article.reliability_score || 0.5) * 100);
  const neutralityScore  = Math.round((1 - Math.abs(article.sentiment_score || 0)) * 100);

  const radarData = [
    { subject: 'Objectivity', A: objectivityScore, fullMark: 100 },
    { subject: 'Reliability', A: reliabilityScore, fullMark: 100 },
    { subject: 'Neutrality',  A: neutralityScore,  fullMark: 100 },
  ];

  const hasAnalysis = breakdown.framing && breakdown.framing !== 'Framing analysis unavailable.';
  const propagandaTechniques: any[] = (article as any).propaganda_techniques || [];

  return (
    <div className="article-modal-overlay">
      <div className="article-modal-content">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-source">
            <span className="source-badge">{article.source}</span>
            <span className="date-text">
              {new Date(article.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
              background: `${biasColor(article.bias_label)}18`,
              color: biasColor(article.bias_label),
              border: `1px solid ${biasColor(article.bias_label)}30`,
              letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>
              {article.bias_label} Bias
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
              color: sentimentColor(article.sentiment_label),
              background: `${sentimentColor(article.sentiment_label)}18`,
              border: `1px solid ${sentimentColor(article.sentiment_label)}30`,
              letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>
              {article.sentiment_label}
            </span>

            {/* 🎬 Video indicator in header */}
            {videos.length > 0 && (
              <span style={{
                padding: '3px 8px',
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(79, 124, 255, 0.1)',
                color: 'var(--accent-blue)',
                border: '1px solid rgba(79, 124, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Film size={10} />
                Video Available
              </span>
            )}
          </div>
          <div className="modal-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* News Visual button removed */}
            <a href={article.url} target="_blank" rel="noreferrer" className="action-btn-icon" title="Read original">
              <ExternalLink size={16} />
            </a>
            <button onClick={onBack} className="action-btn-icon" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Main article */}
          <article className="article-main">
            <h1 className="article-headline">{article.title}</h1>

            {/* 🎬 VIDEO SECTION - shows at top of article */}
            {loadingVideos && (
              <div style={{ width: '100%', height: '52px', background: 'var(--bg-card)', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Finding related videos…
              </div>
            )}

            {!loadingVideos && selectedVideo && (
              <VideoPlayer
                videoId={selectedVideo.videoId}
                title={selectedVideo.title}
                onClose={() => setSelectedVideo(null)}
              />
            )}

            {/* Video thumbnails strip - other related videos */}
            {!loadingVideos && videos.length > 1 && selectedVideo && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Related Videos
                </div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px 0' }}>
                  {videos.filter(v => v.videoId !== selectedVideo.videoId).slice(0, 3).map(video => (
                    <div
                      key={video.videoId}
                      onClick={() => setSelectedVideo(video)}
                      title={video.title}
                      style={{
                        minWidth: '150px', maxWidth: '150px',
                        borderRadius: '10px', overflow: 'hidden',
                        cursor: 'pointer', position: 'relative',
                        border: '1px solid var(--border)',
                        transition: 'all 0.2s',
                        background: 'var(--bg-card)',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.border = '1px solid var(--accent-blue)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.border = '1px solid var(--border)'; }}
                    >
                      {/* Thumbnail */}
                      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                        <img
                          src={video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                          alt={video.title}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Play button */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 26, height: 26, background: 'rgba(255,0,0,0.85)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '9px solid white', marginLeft: '2px' }} />
                        </div>
                        {/* Duration badge */}
                        {video.duration && (
                          <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3 }}>
                            {video.duration}
                          </div>
                        )}
                      </div>
                      {/* Title + channel */}
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {video.title}
                        </div>
                        {video.channelTitle && (
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {video.channelTitle}
                          </div>
                        )}
                        {video.viewCount && (
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{video.viewCount}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {article.image_url && !selectedVideo && (
              <div className="article-hero-img">
                <img src={article.image_url} alt={article.title} />
              </div>
            )}

            <div className="article-text">
              {(article.content || '').split('\n').map((p, i) =>
                p.trim() ? <p key={i}>{p}</p> : null
              )}
            </div>

            {/* Propaganda Techniques */}
            {propagandaTechniques.length > 0 && (
              <div style={{ marginTop: 28, padding: 20, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                  <AlertTriangle size={14} color="var(--accent-red)" />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-red)' }}>
                    Propaganda Techniques Detected
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {propagandaTechniques.map((t: any, i: number) => (
                    <span key={i} title={t.example || ''} style={{
                      padding: '5px 12px', borderRadius: 99,
                      background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      fontSize: 12, fontWeight: 700, cursor: 'help'
                    }}>
                      {t.technique} {t.confidence ? `${Math.round(t.confidence * 100)}%` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bias breakdown */}
            {hasAnalysis && (
              <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                  <ShieldAlert size={14} color="var(--accent-amber)" />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Bias Breakdown
                  </span>
                </div>

                {breakdown.loaded_language?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                      Loaded Language
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {breakdown.loaded_language.map((w: string, i: number) => (
                        <span key={i} style={{
                          padding: '3px 10px', borderRadius: 99,
                          background: 'rgba(245,158,11,0.08)', color: 'var(--accent-amber)',
                          border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, fontWeight: 600
                        }}>{w}</span>
                      ))}
                    </div>
                  </div>
                )}

                {breakdown.framing && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Framing</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{breakdown.framing}</p>
                  </div>
                )}

                {breakdown.omissions && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Potential Omissions</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{breakdown.omissions}</p>
                  </div>
                )}
              </div>
            )}
            <NewsLawyer article={article} />

            {/* Bias comparison */}
            <button className="compare-bias-btn" onClick={compareBias} disabled={loadingBias} style={{ marginTop: 24 }}>
              {loadingBias ? 'Loading...' : '⚖ Compare Source Bias'}
            </button>

            {biasData && (
              <div className="bias-comparison" style={{ marginTop: 16 }}>
                <h3>Media Bias Comparison</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Bias</th>
                      <th>Sentiment</th>
                      <th>Reliability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biasData.comparisons?.map((item: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{item.source}</td>
                        <td style={{ color: biasColor(item.bias_label), fontWeight: 600 }}>{item.bias_label}</td>
                        <td style={{ color: sentimentColor(item.sentiment_label) }}>{item.sentiment_label}</td>
                        <td>{Math.round((item.reliability_score || 0.5) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <BiasChart data={biasData.comparisons} />
              </div>
            )}
          </article>

          {/* Sidebar - WITH INTELLIGENCE SCORES RESTORED */}
          <aside className="article-sidebar">

            {/* AI Summary */}
            <section className="sidebar-section highlight-box">
              <h3 className="section-title">
                <BookOpen size={13} /> AI Summary
              </h3>
              <p className="summary-text">{article.summary}</p>
            </section>

            {/* ✅ INTELLIGENCE SCORES - RESTORED */}
            <section className="sidebar-section">
              <h3 className="section-title">
                <TrendingUp size={13} /> Intelligence Scores
              </h3>

              {/* Score bars */}
              {[
                { label: 'Objectivity', value: objectivityScore, color: 'var(--accent-blue)' },
                { label: 'Reliability', value: reliabilityScore, color: 'var(--accent-teal)' },
                { label: 'Neutrality',  value: neutralityScore,  color: 'var(--accent-purple)' },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span>{s.label}</span>
                    <span style={{ color: s.color }}>{s.value}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${s.value}%`, height: '100%', background: s.color, borderRadius: 99, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}

              {/* Radar chart */}
              <div className="chart-container" style={{ height: 200, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="A" stroke="var(--accent-blue)" fill="var(--accent-blue)" fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Meta info */}
            <section className="sidebar-section">
              <h3 className="section-title">
                <ShieldAlert size={13} /> Article Info
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Category', value: article.category },
                  { label: 'Language', value: ((article as any).language || 'en').toUpperCase() },
                  { label: 'Bias Score', value: `${Math.round((article.bias_score || 0) * 100)}%`, color: biasColor(article.bias_label) },
                  { label: 'Sentiment', value: `${article.sentiment_label} (${article.sentiment_score?.toFixed(2)})`, color: sentimentColor(article.sentiment_label) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                    <span style={{ color: row.color || 'var(--text-secondary)', fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </section>

          </aside>
        </div>
      </div>

      {/* ── TTS Floating Player ── */}
      <ArticleTTS
        title={article.title}
        content={article.content || article.summary || ''}
      />
    </div>
  );
};

export default ArticleView;