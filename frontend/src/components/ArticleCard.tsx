import React from 'react';
import type { Article } from '../types';

interface ArticleCardProps {
    article: Article;
    onClick: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
    // Premium stock image fallback
    const fallbackImage = `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80`;
    const imageUrl = article.image_url || fallbackImage;

    return (
        <div className="article-item" onClick={onClick}>
            <div className="item-image">
                <img src={imageUrl} alt={article.title} onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== fallbackImage) target.src = fallbackImage;
                }} />
                <div className="item-category">{article.category}</div>
            </div>
            <div className="item-content">
                <div className="item-meta">
                    <span>{article.source}</span>
                    <span>•</span>
                    <span>{new Date(article.date).toLocaleDateString()}</span>
                </div>
                <h2 className="item-title">{article.title}</h2>
                <div className="item-footer">
                    <div className="reliability-meter">
                        <div className="meter-fill" style={{ width: `${(article.bias_score || 0.1) * 100}%` }}></div>
                    </div>
                    <div className="bias-tag">{article.bias_label} Bias</div>
                </div>
            </div>
        </div>
    );
};

export default ArticleCard;
