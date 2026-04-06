// ═══════════════════════════════════════════════════════════
//  NewsHub Email Templates
//  backend/emailTemplates.js
//  Plain HTML emails — works with any email provider
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL  = process.env.API_URL       || 'http://localhost:3001';

// ── Shared styles ─────────────────────────────────────────
const STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', Arial, sans-serif; background: #0a0a0f; color: #f0f0f5; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #0a0a0f; }
    .header { background: #111118; border-bottom: 1px solid #1e1e2a; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }
    .logo span { color: #4f7cff; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .badge-breaking { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
    .badge-daily    { background: rgba(79,124,255,0.15); color: #4f7cff; border: 1px solid rgba(79,124,255,0.3); }
    .badge-weekly   { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
    .hero { padding: 32px 32px 24px; background: linear-gradient(135deg, #111118 0%, #16161f 100%); border-bottom: 1px solid #1e1e2a; }
    .hero-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #60607a; margin-bottom: 10px; }
    .hero-title { font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.25; letter-spacing: -0.02em; margin-bottom: 10px; }
    .hero-meta { font-size: 12px; color: #60607a; }
    .content { padding: 24px 32px; }
    .article-card { background: #16161f; border: 1px solid #1e1e2a; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
    .article-card:hover { border-color: #2a2a3a; }
    .article-source { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .source-name { font-size: 11px; font-weight: 700; color: #9090a8; letter-spacing: 0.04em; text-transform: uppercase; }
    .article-date { font-size: 11px; color: #60607a; }
    .article-title { font-size: 16px; font-weight: 700; color: #f0f0f5; line-height: 1.4; margin-bottom: 8px; }
    .article-title a { color: #f0f0f5; text-decoration: none; }
    .article-title a:hover { color: #4f7cff; }
    .article-summary { font-size: 13px; color: #9090a8; line-height: 1.65; margin-bottom: 12px; }
    .article-footer { display: flex; align-items: center; justify-content: space-between; }
    .bias-tag { display: inline-block; padding: 3px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .bias-low    { background: rgba(34,197,94,0.1);  color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
    .bias-medium { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
    .bias-high   { background: rgba(239,68,68,0.1);  color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
    .importance-bar { display: flex; align-items: center; gap: 8px; }
    .importance-label { font-size: 10px; color: #60607a; font-weight: 600; }
    .importance-score { font-size: 11px; font-weight: 700; color: #4f7cff; }
    .read-btn { display: inline-block; padding: 6px 14px; background: #4f7cff; color: #fff; border-radius: 7px; font-size: 12px; font-weight: 700; text-decoration: none; }
    .divider { height: 1px; background: #1e1e2a; margin: 20px 0; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #60607a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #1e1e2a; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat-box { flex: 1; background: #16161f; border: 1px solid #1e1e2a; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }
    .stat-label { font-size: 10px; font-weight: 600; color: #60607a; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px; }
    .footer { background: #111118; border-top: 1px solid #1e1e2a; padding: 24px 32px; text-align: center; }
    .footer p { font-size: 11px; color: #60607a; line-height: 1.8; }
    .footer a { color: #4f7cff; text-decoration: none; }
    .unsubscribe { margin-top: 10px; font-size: 11px; color: #60607a; }
    .highlight-box { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
    .highlight-box-blue { background: rgba(79,124,255,0.06); border: 1px solid rgba(79,124,255,0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
    .top-story-num { display: inline-block; width: 24px; height: 24px; background: #4f7cff; color: #fff; border-radius: 50%; font-size: 11px; font-weight: 800; text-align: center; line-height: 24px; margin-right: 8px; flex-shrink: 0; }
  </style>
`;

// ── Shared header/footer ──────────────────────────────────
function emailHeader(badgeClass, badgeText) {
  return `
    <div class="header">
      <div class="logo">News<span>Hub</span></div>
      <span class="badge ${badgeClass}">${badgeText}</span>
    </div>
  `;
}

function emailFooter(unsubscribeToken, trackingPixelUrl) {
  return `
    <div class="footer">
      <p>
        You're receiving this because you subscribed to NewsHub alerts.<br>
        <a href="${BASE_URL}">Visit NewsHub</a> &nbsp;·&nbsp;
        <a href="${API_URL}/api/newsletter/unsubscribe/${unsubscribeToken}">Unsubscribe</a> &nbsp;·&nbsp;
        <a href="${BASE_URL}/newsletter/preferences/${unsubscribeToken}">Manage Preferences</a>
      </p>
      <p class="unsubscribe">NewsHub Intelligence · AI-Powered News Analysis</p>
    </div>
    ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="">` : ''}
  `;
}

// ── Article card HTML ─────────────────────────────────────
function articleCard(article, rank) {
  const biasClass = (article.bias_label || 'low').toLowerCase() === 'low' ? 'bias-low'
    : (article.bias_label || '').toLowerCase() === 'medium' ? 'bias-medium' : 'bias-high';
  const score = Math.round((article.importance_score || 0.6) * 100);

  return `
    <div class="article-card">
      <div class="article-source">
        ${rank ? `<span class="top-story-num">${rank}</span>` : ''}
        <span class="source-name">${article.source || 'NewsHub'}</span>
        <span class="article-date">${new Date(article.date || article.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      <div class="article-title">
        <a href="${article.url || BASE_URL}" target="_blank">${article.title}</a>
      </div>
      ${article.summary ? `<div class="article-summary">${article.summary.slice(0, 160)}...</div>` : ''}
      <div class="article-footer">
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="bias-tag ${biasClass}">${article.bias_label || 'Low'} Bias</span>
          <span class="importance-score">⚡ ${score}% important</span>
        </div>
        <a href="${article.url || BASE_URL}" class="read-btn" target="_blank">Read →</a>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════
//  TEMPLATE 1: BREAKING NEWS
//  Sent immediately when importance_score > 0.8
// ══════════════════════════════════════════════════════════
function breakingNewsEmail({ subscriber, article, unsubscribeToken, trackingPixelUrl }) {
  const score = Math.round((article.importance_score || 0.85) * 100);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🔴 Breaking: ${article.title}</title>
      ${STYLES}
    </head>
    <body>
      <div class="wrapper">
        ${emailHeader('badge-breaking', '🔴 Breaking News')}

        <div class="hero">
          <div class="hero-label">⚡ High Importance Alert — ${score}% Score</div>
          <div class="hero-title">${article.title}</div>
          <div class="hero-meta">
            ${article.source || 'NewsHub'} &nbsp;·&nbsp;
            ${new Date(article.date || new Date()).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div class="content">

          <div class="highlight-box">
            <div style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">
              Why this matters
            </div>
            <div style="font-size:13px;color:#f0f0f5;line-height:1.6;">
              ${article.summary || 'This story has been flagged as high importance by our AI pipeline.'}
            </div>
          </div>

          ${articleCard(article, null)}

          <div style="text-align:center;padding:20px 0;">
            <a href="${article.url || BASE_URL}" class="read-btn" target="_blank"
               style="padding:12px 28px;font-size:14px;background:#ef4444;">
              Read Full Story →
            </a>
          </div>

          <div class="divider"></div>
          <p style="font-size:12px;color:#60607a;text-align:center;">
            This alert was sent because this story scored ${score}/100 on our importance scale.<br>
            You only receive breaking alerts for stories scoring above 80.
          </p>
        </div>

        ${emailFooter(unsubscribeToken, trackingPixelUrl)}
      </div>
    </body>
    </html>
  `;

  return {
    subject: `🔴 Breaking: ${article.title.slice(0, 60)}${article.title.length > 60 ? '...' : ''}`,
    html
  };
}

// ══════════════════════════════════════════════════════════
//  TEMPLATE 2: DAILY DIGEST
//  Sent at 7 AM with top 5 stories (importance > 0.6)
// ══════════════════════════════════════════════════════════
function dailyDigestEmail({ subscriber, articles, stats, date, unsubscribeToken, trackingPixelUrl }) {
  const dateStr   = new Date(date || new Date()).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const avgBias   = articles.length ? Math.round(articles.reduce((a, ar) => a + (ar.bias_score || 0), 0) / articles.length * 100) : 0;
  const topSource = stats?.topSource || articles[0]?.source || 'Multiple Sources';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>📰 Your Daily NewsHub Briefing — ${dateStr}</title>
      ${STYLES}
    </head>
    <body>
      <div class="wrapper">
        ${emailHeader('badge-daily', '📰 Daily Digest')}

        <div class="hero">
          <div class="hero-label">Good morning, ${subscriber.name || subscriber.email.split('@')[0]} 👋</div>
          <div class="hero-title">Your ${dateStr} Intelligence Briefing</div>
          <div class="hero-meta">
            ${articles.length} important stories · Avg bias: ${avgBias}% · Top source: ${topSource}
          </div>
        </div>

        <div class="content">

          <!-- Stats row -->
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-value">${articles.length}</div>
              <div class="stat-label">Stories Today</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${avgBias}%</div>
              <div class="stat-label">Avg Bias Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats?.totalArticles || '100+'}</div>
              <div class="stat-label">Analysed Today</div>
            </div>
          </div>

          <!-- Top stories -->
          <div class="section-title">🏆 Top ${articles.length} Stories Worth Your Attention</div>

          ${articles.map((article, i) => articleCard(article, i + 1)).join('')}

          <div class="divider"></div>

          <div class="highlight-box-blue">
            <div style="font-size:11px;font-weight:700;color:#4f7cff;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">
              💡 How we chose these stories
            </div>
            <div style="font-size:12px;color:#9090a8;line-height:1.65;">
              Our AI pipeline analysed ${stats?.totalArticles || 'hundreds of'} articles today and scored each one for
              importance based on topic relevance, source credibility, recency, and your preferences.
              Only stories scoring above 60/100 appear in your digest.
            </div>
          </div>

          <div style="text-align:center;padding:16px 0;">
            <a href="${BASE_URL}" class="read-btn" style="padding:12px 28px;font-size:14px;">
              Open NewsHub Dashboard →
            </a>
          </div>

        </div>

        ${emailFooter(unsubscribeToken, trackingPixelUrl)}
      </div>
    </body>
    </html>
  `;

  return {
    subject: `📰 Your Daily Briefing — ${articles.length} important stories for ${new Date(date || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    html
  };
}

// ══════════════════════════════════════════════════════════
//  TEMPLATE 3: WEEKLY ROUNDUP
//  Sent Sunday evening with week's best stories
// ══════════════════════════════════════════════════════════
function weeklyRoundupEmail({ subscriber, articles, weekStats, unsubscribeToken, trackingPixelUrl }) {
  const weekEnd   = new Date();
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 7);
  const weekRange = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Group articles by category
  const byCategory = {};
  articles.forEach(a => {
    const cat = a.category || 'General';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  });

  const categoryBlocks = Object.entries(byCategory).map(([cat, arts]) => `
    <div class="section-title">${cat} (${arts.length} stories)</div>
    ${arts.slice(0, 2).map(a => articleCard(a, null)).join('')}
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>📊 Weekly Intelligence Roundup — ${weekRange}</title>
      ${STYLES}
    </head>
    <body>
      <div class="wrapper">
        ${emailHeader('badge-weekly', '📊 Weekly Roundup')}

        <div class="hero">
          <div class="hero-label">Week in Review · ${weekRange}</div>
          <div class="hero-title">The ${articles.length} Stories That Defined This Week</div>
          <div class="hero-meta">
            ${subscriber.name || subscriber.email.split('@')[0]}'s personalised weekly intelligence report
          </div>
        </div>

        <div class="content">

          <!-- Week stats -->
          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-value">${weekStats?.articlesAnalysed || '700+'}</div>
              <div class="stat-label">Articles Analysed</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${articles.length}</div>
              <div class="stat-label">Worth Reading</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${weekStats?.avgBias || '34'}%</div>
              <div class="stat-label">Avg Bias This Week</div>
            </div>
          </div>

          <!-- Top story of the week -->
          ${articles[0] ? `
            <div class="section-title">⭐ Story of the Week</div>
            ${articleCard(articles[0], null)}
            <div class="divider"></div>
          ` : ''}

          <!-- By category -->
          ${categoryBlocks}

          <div class="divider"></div>

          <div style="text-align:center;padding:16px 0;">
            <a href="${BASE_URL}" class="read-btn" style="padding:12px 28px;font-size:14px;background:#a78bfa;">
              View Full NewsHub Dashboard →
            </a>
          </div>

        </div>

        ${emailFooter(unsubscribeToken, trackingPixelUrl)}
      </div>
    </body>
    </html>
  `;

  return {
    subject: `📊 Weekly Roundup: ${articles.length} stories from ${weekRange} worth your time`,
    html
  };
}

module.exports = { breakingNewsEmail, dailyDigestEmail, weeklyRoundupEmail };
