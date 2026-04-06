import React from 'react';
import { Bookmark } from 'lucide-react';
import type { Article } from '../types';

interface ArticleCardProps {
  article:  Article;
  onClick:  () => void;
  isSaved?: boolean;
  onSave?:  () => void;
  index?:   number;
}

// ── Fix 1: Clean article titles ──────────────────────────────────────────────
// Inserts spaces where missing between words/acronyms, fixes known typos
function cleanTitle(raw: string): string {
  if (!raw) return '';
  let t = raw;

  // Fix known company-name typos that appear frequently in Indian news
  const typoFixes: Record<string, string> = {
    'BPLC':   'BPCL',
    'Relince': 'Reliance',
    'Infosys': 'Infosys',   // already correct — guard against mangling
    'SENSEX':  'Sensex',
    'NIFFTY':  'NIFTY',
    'TATASTEEL': 'Tata Steel',
    'WIPRO':   'Wipro',
    'HDFC':    'HDFC',
  };
  Object.entries(typoFixes).forEach(([wrong, right]) => {
    t = t.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
  });

  // Insert space between a lowercase letter immediately followed by an uppercase
  // e.g. "IndiaAchieve" → "India Achieve"
  t = t.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Insert space between digits and letters if stuck together
  // e.g. "12thJanuary" → "12th January"
  t = t.replace(/(\d)([A-Za-z])/g, '$1 $2');
  t = t.replace(/([A-Za-z])(\d)/g, '$1 $2');

  // Collapse multiple spaces
  t = t.replace(/\s{2,}/g, ' ').trim();

  return t;
}

// ── Fix 2: Separate bias and sentiment badges ─────────────────────────────────
function getBiasInfo(label: string): { text: string; className: string } {
  const l = (label || '').toLowerCase();
  if (l.includes('high'))   return { text: '🔴 Opinionated', className: 'tag-bias-high' };
  if (l.includes('med'))    return { text: '⚠️ Some Slant',  className: 'tag-bias-medium' };
  return                           { text: '✅ Balanced',    className: 'tag-bias-low' };
}

function getSentimentInfo(label: string): { text: string; className: string } {
  const l = (label || '').toLowerCase();
  if (l.includes('pos')) return { text: '😊 Positive', className: 'tag-sentiment-pos' };
  if (l.includes('neg')) return { text: '😟 Negative', className: 'tag-sentiment-neg' };
  return                        { text: '😐 Neutral',  className: 'tag-sentiment-neu' };
}

function formatDate(dateStr: string): string {
  try {
    const d    = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

const FALLBACK = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80';

const ArticleCard: React.FC<ArticleCardProps> = (props) => {
  const { article, onClick, isSaved, onSave } = props;
  const bias      = getBiasInfo(article.bias_label || '');
  const sentiment = getSentimentInfo(article.sentiment_label || '');
  const dateStr   = formatDate(article.date);
  const imgUrl    = article.image_url || FALLBACK;
  const category  = (article.category || '').split('|')[0].split('/')[0].trim();

  // Apply title cleanup
  const cleanedTitle = cleanTitle(article.title);

  return (
    <div className="article-card" onClick={onClick} role="button" tabIndex={0}
      style={{ animationDelay: `${Math.min((props.index || 0) * 0.05, 0.4)}s` }}
      onKeyDown={e => e.key === 'Enter' && onClick()}>

      <div className="card-img-wrap">
        <img className="card-img" src={imgUrl} alt={cleanedTitle} loading="lazy"
          onError={e => { const t = e.target as HTMLImageElement; if (t.src !== FALLBACK) t.src = FALLBACK; }} />
        {category && <span className="card-cat-pill">{category}</span>}

        {/* Bookmark button */}
        {onSave && (
          <button
            className={`card-save-btn${isSaved ? ' saved' : ''}`}
            onClick={e => { e.stopPropagation(); onSave(); }}
            title={isSaved ? 'Remove from saved' : 'Save for later'}
          >
            <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="card-body">
        <div className="card-meta">
          <span className="card-source">{article.source}</span>
          <span className="card-dot">·</span>
          <span className="card-date">{dateStr}</span>
        </div>

        <h2 className="card-title">{cleanedTitle}</h2>
        {article.summary && <p className="card-summary">{article.summary}</p>}

        {/* Fix 2: Two clearly separate badges — bias and sentiment */}
        <div className="card-tags">
          <span className={`card-tag card-tag-bias ${bias.className}`}>
            {bias.text}
          </span>
          <span className={`card-tag card-tag-sentiment ${sentiment.className}`}>
            {sentiment.text}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;
