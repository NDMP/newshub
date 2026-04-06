// frontend/src/components/TrendingWidget.tsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Flame } from 'lucide-react';

interface TrendingWidgetProps {
    onArticleClick: (articleId: number) => void;
}

const TrendingWidget: React.FC<TrendingWidgetProps> = ({ onArticleClick }) => {
    const [trending, setTrending] = useState<any[]>([]);
    const [period, setPeriod] = useState('day');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();
    }, [period]);

    const fetchTrending = async () => {
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/user/trending?period=${period}`);
            const data = await response.json();
            setTrending(data.trending || []);
        } catch (error) {
            console.error('Failed to fetch trending:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTrendingIcon = (score: number) => {
        if (score > 100) return '🔥';
        if (score > 50) return '📈';
        return '📊';
    };

    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} color="var(--accent-red)" />
                    Trending Now
                </h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {['hour', 'day', 'week'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: period === p ? 'var(--accent-blue)' : 'transparent',
                                color: period === p ? 'white' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {p === 'hour' ? 'Hour' : p === 'day' ? 'Day' : 'Week'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    Loading trending...
                </div>
            ) : (
                <div>
                    {trending.map((article, index) => (
                        <div
                            key={article.id}
                            onClick={() => onArticleClick(article.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 0',
                                borderBottom: index < trending.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <div style={{
                                width: '24px',
                                height: '24px',
                                backgroundColor: index < 3 ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: index < 3 ? '#ef4444' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '12px'
                            }}>
                                {index < 3 ? `#${index + 1}` : index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    marginBottom: '4px',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {article.title}
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '10px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <span>{article.source}</span>
                                    <span>•</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        {getTrendingIcon(article.trending_score)}
                                        {article.view_count || 0} reads
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TrendingWidget;