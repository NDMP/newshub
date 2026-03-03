import React from 'react';
import { X, ExternalLink, ShieldAlert, TrendingUp, BookOpen } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Article } from '../types';
import '../index.css';

interface ArticleViewProps {
    article: Article;
    onBack: () => void;
}

const ArticleCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600 }}>{`${payload[0].name}: ${payload[0].value}%`}</p>
            </div>
        );
    }
    return null;
};

const ArticleView: React.FC<ArticleViewProps> = ({ article, onBack }) => {
    let breakdown: any = {};
    try {
        breakdown = typeof article.bias_breakdown === 'string'
            ? JSON.parse(article.bias_breakdown || '{}')
            : (article.bias_breakdown || {});
    } catch (e) {
        console.error("Failed to parse bias_breakdown", e);
    }

    // Prepare chart data
    const objectivityScore = Math.round((1 - (article.bias_score || 0.5)) * 100);
    const reliabilityScore = Math.round((article.reliability_score || 0.5) * 100);
    const neutralityScore = Math.round((1 - Math.abs(article.sentiment_score || 0)) * 100);

    const radarData = [
        { subject: 'Objectivity', A: objectivityScore, fullMark: 100 },
        { subject: 'Reliability', A: reliabilityScore, fullMark: 100 },
        { subject: 'Neutrality', A: neutralityScore, fullMark: 100 },
    ];

    const isAnalysisReady = breakdown.framing && breakdown.framing !== "Framing analysis unavailable." && breakdown.framing !== "Framing analysis unavailable";

    return (
        <div className="article-modal-overlay">
            <div className="article-modal-content">
                <div className="modal-header">
                    <div className="modal-source">
                        <span className="source-badge">{article.source}</span>
                        <span className="date-text">{new Date(article.date).toLocaleDateString()}</span>
                    </div>
                    <div className="modal-actions">
                        <a href={article.url} target="_blank" rel="noreferrer" className="action-btn-icon" title="Read Original">
                            <ExternalLink size={20} />
                        </a>
                        <button onClick={onBack} className="action-btn-icon" title="Close">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="modal-body">
                    <article className="article-main">
                        <h1 className="article-headline">{article.title}</h1>

                        {article.image_url && (
                            <div className="article-hero-img">
                                <img src={article.image_url} alt={article.title} />
                            </div>
                        )}

                        <div className="article-text">
                            {article.content.split('\n').map((p, i) => (
                                p.trim() ? <p key={i}>{p}</p> : null
                            ))}
                        </div>
                    </article>

                    <aside className="article-sidebar">
                        <section className="sidebar-section highlight-box">
                            <h3 className="section-title"><BookOpen size={16} /> AI Summary</h3>
                            <p className="summary-text">{article.summary}</p>
                        </section>

                        <section className="sidebar-section">
                            <h3 className="section-title"><TrendingUp size={16} /> Bias Metrics</h3>
                            <div className="chart-container" style={{ height: 260, width: '100%', marginTop: '-20px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        <PolarGrid stroke="var(--border-subtle)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Metrics" dataKey="A" stroke="var(--accent-blue)" fill="var(--accent-blue)" fillOpacity={0.3} />
                                        <Tooltip content={<ArticleCustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        <section className="sidebar-section">
                            <h3 className="section-title"><ShieldAlert size={16} /> Linguistic Breakdown</h3>

                            {!isAnalysisReady ? (
                                <div className="breakdown-cards">
                                    <div className="unavailable-notice" style={{ marginBottom: '16px', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(37, 99, 235, 0.05)' }}>
                                        <strong>AI Offline:</strong> Displaying Simulated Premium Analysis
                                    </div>
                                    <div className="breakdown-card">
                                        <h4>Loaded Language</h4>
                                        <div className="tags-wrapper">
                                            <span className="word-tag">unprecedented</span>
                                            <span className="word-tag">shocking</span>
                                            <span className="word-tag">massive</span>
                                        </div>
                                    </div>

                                    <div className="breakdown-card">
                                        <h4>Framing</h4>
                                        <p>The article uses dramatic terminology to emphasize the scale of the event, potentially steering the reader towards an emotional response rather than an objective stance.</p>
                                    </div>

                                    <div className="breakdown-card">
                                        <h4>Omitted Perspectives</h4>
                                        <p>Lacks viewpoints from independent third-party analysts and historical context regarding similar industry shifts.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="breakdown-cards">
                                    <div className="breakdown-card">
                                        <h4>Loaded Language</h4>
                                        <div className="tags-wrapper">
                                            {breakdown.loaded_language?.length ? (
                                                breakdown.loaded_language.map((w: string) => <span key={w} className="word-tag">{w}</span>)
                                            ) : (
                                                <span className="text-secondary">None detected</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="breakdown-card">
                                        <h4>Framing</h4>
                                        <p>{breakdown.framing}</p>
                                    </div>

                                    <div className="breakdown-card">
                                        <h4>Omitted Perspectives</h4>
                                        <p>{breakdown.omissions}</p>
                                    </div>
                                </div>
                            )}
                        </section>
                    </aside>
                </div>
            </div>

        </div>
    );
};

export default ArticleView;
