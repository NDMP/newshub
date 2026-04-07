// backend/newsletterCron.js — FIXED
// ═══════════════════════════════════════════════════════════════
//  Cron jobs for newsletter sending
//  Add to server.js: require('./newsletterCron');
// ═══════════════════════════════════════════════════════════════

const cron = require('node-cron');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const API = process.env.API_URL || 'http://localhost:3001';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
console.log('[CRON] ✅ Newsletter scheduler started (IST timezone)');

// ── Importance scoring ─────────────────────────────────────────
function scoreArticle(article) {
  let score = 0.5;
  const ageHours = (Date.now() - new Date(article.timestamp || article.date).getTime()) / 3600000;
  if      (ageHours < 2)  score += 0.20;
  else if (ageHours < 6)  score += 0.15;
  else if (ageHours < 12) score += 0.10;
  else if (ageHours < 24) score += 0.05;
  else                    score -= 0.10;

  score += (article.reliability_score || 0.5) * 0.15;
  score += (1 - (article.bias_score || 0.5)) * 0.10;
  score += Math.abs(article.sentiment_score || 0) * 0.05;

  const catWeights = { Business: 0.10, Technology: 0.08, General: 0.07, Health: 0.07, Sports: 0.03, Entertainment: 0.01 };
  score += (catWeights[article.category] || 0.05);

  const importantKW = /breaking|urgent|emergency|crisis|war|attack|earthquake|flood|election|budget|rbi|supreme court|parliament|president|prime minister|death|killed|arrested|launch|record|historic/i;
  if (importantKW.test(article.title || '')) score += 0.15;

  return Math.min(Math.max(score, 0), 1);
}

// ── Internal helper — call our own API routes ──────────────────
async function callRoute(path, body = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`[CRON] Failed to call ${path}:`, err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  1. Daily Digest — every day at 7:00 AM IST
// ══════════════════════════════════════════════════════════════
cron.schedule('0 7 * * *', async () => {
  console.log('[CRON] 📰 Sending daily digest...');
  const result = await callRoute('/api/newsletter/send/daily');
  if (result) console.log(`[CRON] Daily result: sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`);
}, { timezone: 'Asia/Kolkata' });

// ══════════════════════════════════════════════════════════════
//  2. Weekly Roundup — every Sunday at 6:00 PM IST
// ══════════════════════════════════════════════════════════════
cron.schedule('0 18 * * 0', async () => {
  console.log('[CRON] 📅 Sending weekly roundup...');
  const result = await callRoute('/api/newsletter/send/weekly');
  if (result) console.log(`[CRON] Weekly result: sent=${result.sent} skipped=${result.skipped}`);
}, { timezone: 'Asia/Kolkata' });

// ══════════════════════════════════════════════════════════════
//  3. Breaking News — every 30 minutes, checks new articles
// ══════════════════════════════════════════════════════════════
cron.schedule('*/30 * * * *', async () => {
  try {
    const thirtyMinsAgo = new Date(Date.now() - 31 * 60000).toISOString();

    const { data: recentArticles } = await supabase
      .from('articles')
      .select('*')
      .gte('timestamp', thirtyMinsAgo)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (!recentArticles?.length) return;

    for (const article of recentArticles) {
      const score = scoreArticle(article);
      if (score < 0.80) continue;

      // Check if already sent breaking for this article
      const { count } = await supabase
        .from('newsletter_emails')
        .select('*', { count: 'exact', head: true })
        .eq('email_type', 'breaking')
        .contains('article_ids', [article.id]);

      if ((count || 0) > 0) continue;

      console.log(`[CRON] 🔴 Breaking alert: "${article.title.substring(0, 60)}" (score: ${score.toFixed(2)})`);
      const result = await callRoute('/api/newsletter/send/breaking', { article_id: article.id });
      if (result) console.log(`[CRON] Breaking result: sent=${result.sent}`);
    }
  } catch (err) {
    console.error('[CRON] Breaking check failed:', err.message);
  }
});

module.exports = {};