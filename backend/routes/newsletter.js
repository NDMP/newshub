// backend/routes/newsletter.js  — FULLY FIXED VERSION
// ═══════════════════════════════════════════════════════════════
//  Uses Nodemailer + Gmail (no domain needed, works for ALL emails)
//  Fixes:
//  1. Replaced Resend with Nodemailer — no recipient restrictions
//  2. Duplicate subscribe — properly detects existing subscribers
//  3. sent_at column on every insert
//  4. Daily send looks back 48hrs if no articles today
//  5. 500ms delay between sends — prevents Gmail rate limits
//  6. Weekly limit check uses correct sent_at column
// ═══════════════════════════════════════════════════════════════

const express      = require('express');
const router       = express.Router();
const { createClient } = require('@supabase/supabase-js');
const nodemailer   = require('nodemailer');
const { breakingNewsEmail, dailyDigestEmail, weeklyRoundupEmail } = require('../emailTemplates');
const path         = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Nodemailer transporter using Gmail ────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM_NAME  = 'NewsHub';
const FROM_EMAIL = `${FROM_NAME} <${process.env.EMAIL_USER}>`;
const API_URL    = process.env.API_URL    || 'http://localhost:3001';
const FRONT_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Delay helper — prevents Gmail rate limits ─────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Safe send with retry ──────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transporter.sendMail({
        from:    FROM_EMAIL,
        to,
        subject,
        html,
      });
      console.log(`[NEWSLETTER] ✅ Email sent to ${to}`);
      return true;
    } catch (err) {
      console.error(`[NEWSLETTER] Attempt ${attempt} failed for ${to}:`, err.message);
      if (attempt < 3) await delay(2000 * attempt);
    }
  }
  console.error(`[NEWSLETTER] ❌ All attempts failed for ${to}`);
  return false;
}

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

// ── Log email to newsletter_emails table ───────────────────────
async function logEmail(subscriberId, emailType, subject, articleIds, importanceAvg) {
  try {
    const { data, error } = await supabase
      .from('newsletter_emails')
      .insert({
        subscriber_id:   subscriberId,
        email_type:      emailType,
        subject:         subject,
        article_ids:     articleIds,
        importance_avg:  importanceAvg,
        sent_at:         new Date().toISOString(), // ✅ FIX: was missing before
      })
      .select()
      .single();
    if (error) console.error('[NEWSLETTER] Log email error:', error.message);
    return data;
  } catch (e) {
    console.error('[NEWSLETTER] Log email crash:', e.message);
    return null;
  }
}

// ── Check weekly limit ─────────────────────────────────────────
async function isOverWeeklyLimit(subscriberId, maxPerWeek) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const { count, error } = await supabase
      .from('newsletter_emails')
      .select('*', { count: 'exact', head: true })
      .eq('subscriber_id', subscriberId)
      .gte('sent_at', weekAgo); // ✅ FIX: now uses sent_at correctly
    if (error) return false;
    return (count || 0) >= maxPerWeek;
  } catch {
    return false;
  }
}

// ── Check already sent today ───────────────────────────────────
async function alreadySentToday(subscriberId, emailType) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from('newsletter_emails')
      .select('*', { count: 'exact', head: true })
      .eq('subscriber_id', subscriberId)
      .eq('email_type', emailType)
      .gte('sent_at', today.toISOString());
    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
//  POST /api/newsletter/subscribe
// ══════════════════════════════════════════════════════════════
router.post('/subscribe', async (req, res) => {
  try {
    const {
      email,
      name,
      frequency    = 'daily',
      topics       = ['General', 'Technology', 'Business'],
      max_per_week = 7,
    } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const emailLower = email.toLowerCase().trim();

    // ✅ FIX 1: Check if already subscribed BEFORE upsert
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, is_active, frequency, topics')
      .eq('email', emailLower)
      .single();

    if (existing) {
      if (existing.is_active) {
        // Already active — update preferences instead of re-subscribing
        await supabase
          .from('newsletter_subscribers')
          .update({ frequency, topics, max_per_week, updated_at: new Date().toISOString() })
          .eq('email', emailLower);

        return res.json({
          success:    true,
          already:    true,
          message:    'Your preferences have been updated.',
          subscriber: { email: emailLower, frequency, topics },
        });
      } else {
        // Was unsubscribed — reactivate them
        await supabase
          .from('newsletter_subscribers')
          .update({ is_active: true, frequency, topics, max_per_week, updated_at: new Date().toISOString() })
          .eq('email', emailLower);

        // Send reactivation welcome email
        await sendEmail({
          to:      emailLower,
          subject: '✅ Welcome back to NewsHub Newsletter',
          html: welcomeEmailHtml(name || emailLower.split('@')[0], frequency, topics, max_per_week, existing.id),
        });

        return res.json({
          success:    true,
          reactivated: true,
          message:    'Welcome back! Your subscription has been reactivated.',
          subscriber: { email: emailLower, frequency, topics },
        });
      }
    }

    // ✅ New subscriber — insert fresh
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email:        emailLower,
        name:         name || emailLower.split('@')[0],
        frequency,
        topics,
        max_per_week,
        is_active:    true,
        confirmed:    true,
        emails_sent:  0,
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send welcome email
    const emailSent = await sendEmail({
      to:      emailLower,
      subject: '🎉 Welcome to NewsHub Newsletter',
      html:    welcomeEmailHtml(name || emailLower.split('@')[0], frequency, topics, max_per_week, data.id),
    });

    if (!emailSent) {
      console.warn('[NEWSLETTER] Welcome email failed for:', emailLower);
    }

    console.log(`[NEWSLETTER] ✅ New subscriber: ${emailLower} (${frequency})`);
    res.json({
      success:    true,
      message:    'Subscribed successfully! Check your inbox for a welcome email.',
      subscriber: { id: data.id, email: data.email, frequency: data.frequency },
    });

  } catch (err) {
    console.error('[SUBSCRIBE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Welcome email HTML ─────────────────────────────────────────
function welcomeEmailHtml(name, frequency, topics, maxPerWeek, subscriberId) {
  const freqLabels = { breaking: '🔴 Breaking Alerts', daily: '📰 Daily Digest', weekly: '📅 Weekly Roundup' };
  return `
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',Arial,sans-serif;background:#0a0a0f;color:#f0f0f5}
  .wrap{max-width:560px;margin:0 auto;background:#0a0a0f}
  .hdr{background:#111118;border-bottom:1px solid #1e1e2a;padding:22px 32px;display:flex;align-items:center;justify-content:space-between}
  .logo{font-size:22px;font-weight:700;color:#fff;letter-spacing:-.02em}
  .logo span{color:#4f7cff}
  .badge{padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3)}
  .hero{padding:32px;background:linear-gradient(135deg,#111118,#16161f);border-bottom:1px solid #1e1e2a;text-align:center}
  .check{width:64px;height:64px;border-radius:50%;background:rgba(34,197,94,.1);border:2px solid rgba(34,197,94,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px}
  .hero h1{font-size:24px;font-weight:800;color:#fff;letter-spacing:-.02em;margin-bottom:8px}
  .hero p{font-size:14px;color:#9090a8;line-height:1.65}
  .body{padding:28px 32px}
  .card{background:#16161f;border:1px solid #1e1e2a;border-radius:12px;padding:20px;margin-bottom:16px}
  .card-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#60607a;margin-bottom:12px}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e1e2a;font-size:13px}
  .row:last-child{border-bottom:none}
  .row-key{color:#9090a8;font-weight:500}
  .row-val{color:#f0f0f5;font-weight:700;text-align:right;max-width:55%}
  .cta{display:block;text-align:center;padding:14px 28px;background:linear-gradient(135deg,#4f7cff,#7c5cfc);color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:700;margin:20px 0}
  .ftr{background:#111118;border-top:1px solid #1e1e2a;padding:22px 32px;text-align:center}
  .ftr p{font-size:11px;color:#60607a;line-height:1.8}
  .ftr a{color:#4f7cff;text-decoration:none}
</style>
</head>
<body><div class="wrap">
  <div class="hdr">
    <div class="logo">News<span>Hub</span></div>
    <span class="badge">✅ Subscribed</span>
  </div>
  <div class="hero">
    <div class="check">🎉</div>
    <h1>Welcome, ${name}!</h1>
    <p>You're now part of the NewsHub Intelligence network.<br>We'll only send you what matters — never spam.</p>
  </div>
  <div class="body">
    <div class="card">
      <div class="card-lbl">Your Subscription</div>
      <div class="row"><span class="row-key">Frequency</span><span class="row-val">${freqLabels[frequency] || frequency}</span></div>
      <div class="row"><span class="row-key">Topics</span><span class="row-val">${topics.join(', ')}</span></div>
      <div class="row"><span class="row-key">Max per week</span><span class="row-val">${maxPerWeek} emails</span></div>
    </div>
    <a href="${FRONT_URL}" class="cta">Open NewsHub →</a>
    <p style="font-size:12px;color:#60607a;text-align:center;line-height:1.7">
      Changed your mind? <a href="${API_URL}/api/newsletter/unsubscribe/${subscriberId}" style="color:#4f7cff;">Unsubscribe</a> anytime.
    </p>
  </div>
  <div class="ftr">
    <p>NewsHub Intelligence · AI-Powered News Analysis<br>
    <a href="${FRONT_URL}">Visit NewsHub</a></p>
  </div>
</div></body></html>`;
}

// ══════════════════════════════════════════════════════════════
//  GET /api/newsletter/unsubscribe/:token_or_id
// ══════════════════════════════════════════════════════════════
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Support both UUID token and numeric ID
    let query = supabase.from('newsletter_subscribers').update({
      is_active:  false,
      updated_at: new Date().toISOString(),
    });

    // Try as token first, fall back to ID
    if (isNaN(token)) {
      query = query.eq('unsubscribe_token', token);
    } else {
      query = query.eq('id', token);
    }

    const { data, error } = await query.select().single();

    if (error || !data) {
      return res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#0a0a0f;color:#f0f0f5;"><h2 style="color:#ef4444;">⚠️ Invalid or expired unsubscribe link.</h2><a href="${FRONT_URL}" style="color:#4f7cff;">Back to NewsHub</a></body></html>`);
    }

    res.send(`<html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#f0f0f5;max-width:500px;margin:0 auto;">
      <h2 style="color:#22c55e;">✅ Unsubscribed</h2>
      <p style="color:#9090a8;margin-top:12px;">You've been removed from NewsHub newsletters.</p>
      <p style="color:#60607a;font-size:13px;margin-top:8px;">${data.email}</p>
      <a href="${FRONT_URL}" style="display:inline-block;margin-top:24px;padding:10px 22px;background:#4f7cff;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Back to NewsHub</a>
    </body></html>`);
  } catch (err) {
    res.status(500).send('Error processing unsubscribe');
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/newsletter/send/daily
// ══════════════════════════════════════════════════════════════
router.post('/send/daily', async (req, res) => {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    // ✅ FIX: Look back 48hrs if no articles today
    let lookback = today.toISOString();
    const { count: todayCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', lookback);

    if ((todayCount || 0) < 3) {
      lookback = new Date(Date.now() - 48 * 3600000).toISOString();
      console.log('[DAILY] Not enough articles today — looking back 48hrs');
    }

    const { data: allArticles } = await supabase
      .from('articles')
      .select('*')
      .gte('timestamp', lookback)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!allArticles?.length) return res.json({ sent: 0, message: 'No articles found' });

    const scored = allArticles
      .map(a => ({ ...a, importance_score: scoreArticle(a) }))
      .filter(a => a.importance_score >= 0.55) // ✅ Slightly lowered threshold
      .sort((a, b) => b.importance_score - a.importance_score)
      .slice(0, 5);

    if (!scored.length) return res.json({ sent: 0, message: 'No articles above threshold' });

    const stats = { totalArticles: allArticles.length, topSource: scored[0]?.source };

    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('is_active', true)
      .in('frequency', ['daily', 'breaking']);

    if (!subscribers?.length) return res.json({ sent: 0, message: 'No active subscribers' });

    let sent = 0, skipped = 0, errors = 0;

    for (const sub of subscribers) {
      try {
        // Skip if over weekly limit
        if (await isOverWeeklyLimit(sub.id, sub.max_per_week || 7)) { skipped++; continue; }

        // Skip if already sent daily today
        if (await alreadySentToday(sub.id, 'daily')) { skipped++; continue; }

        // Filter by subscriber topics
        const subArticles = scored.filter(a =>
          !sub.topics?.length || sub.topics.includes(a.category) || sub.topics.includes('General')
        ).slice(0, 5);

        if (!subArticles.length) { skipped++; continue; }

        // Log first, then send
        const emailLog = await logEmail(
          sub.id, 'daily',
          `📰 Your Daily NewsHub Briefing`,
          subArticles.map(a => a.id),
          subArticles.reduce((acc, a) => acc + a.importance_score, 0) / subArticles.length
        );

        const trackingPixelUrl = emailLog?.open_token
          ? `${API_URL}/api/newsletter/track/open/${emailLog.open_token}` : null;

        const { subject, html } = dailyDigestEmail({
          subscriber: sub, articles: subArticles, stats,
          date: today, unsubscribeToken: sub.unsubscribe_token || sub.id,
          trackingPixelUrl,
        });

        const ok = await sendEmail({ to: sub.email, subject, html });

        if (ok) {
          await supabase.from('newsletter_subscribers')
            .update({ emails_sent: (sub.emails_sent || 0) + 1, last_sent_at: new Date().toISOString() })
            .eq('id', sub.id);
          sent++;
        } else {
          errors++;
        }

        // ✅ Rate limit between sends — prevents Gmail daily limit
        await delay(500);

      } catch (subErr) {
        console.error(`[DAILY] Error for ${sub.email}:`, subErr.message);
        errors++;
      }
    }

    console.log(`[DAILY] Done: sent=${sent} skipped=${skipped} errors=${errors}`);
    res.json({ success: true, sent, skipped, errors, articles_used: scored.length, total_subscribers: subscribers.length });

  } catch (err) {
    console.error('[DAILY]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/newsletter/send/weekly
// ══════════════════════════════════════════════════════════════
router.post('/send/weekly', async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

    const { data: allArticles } = await supabase
      .from('articles')
      .select('*')
      .gte('timestamp', weekAgo)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (!allArticles?.length) return res.json({ sent: 0, message: 'No articles this week' });

    const scored = allArticles
      .map(a => ({ ...a, importance_score: scoreArticle(a) }))
      .filter(a => a.importance_score >= 0.40)
      .sort((a, b) => b.importance_score - a.importance_score)
      .slice(0, 10);

    if (!scored.length) return res.json({ sent: 0, message: 'No articles above threshold' });

    const weekStats = {
      articlesAnalysed: allArticles.length,
      avgBias: Math.round(allArticles.reduce((a, art) => a + (art.bias_score || 0), 0) / allArticles.length * 100),
    };

    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('is_active', true)
      .eq('frequency', 'weekly');

    if (!subscribers?.length) return res.json({ sent: 0, message: 'No weekly subscribers' });

    let sent = 0, skipped = 0, errors = 0;

    for (const sub of subscribers) {
      try {
        if (await isOverWeeklyLimit(sub.id, sub.max_per_week || 7)) { skipped++; continue; }

        const subArticles = scored.filter(a =>
          !sub.topics?.length || sub.topics.includes(a.category) || sub.topics.includes('General')
        ).slice(0, 8);

        if (!subArticles.length) { skipped++; continue; }

        const emailLog = await logEmail(
          sub.id, 'weekly', `📅 Your Weekly NewsHub Roundup`,
          subArticles.map(a => a.id),
          subArticles.reduce((acc, a) => acc + a.importance_score, 0) / subArticles.length
        );

        const trackingPixelUrl = emailLog?.open_token
          ? `${API_URL}/api/newsletter/track/open/${emailLog.open_token}` : null;

        const { subject, html } = weeklyRoundupEmail({
          subscriber: sub, articles: subArticles, weekStats,
          unsubscribeToken: sub.unsubscribe_token || sub.id, trackingPixelUrl,
        });

        const ok = await sendEmail({ to: sub.email, subject, html });
        if (ok) {
          await supabase.from('newsletter_subscribers')
            .update({ emails_sent: (sub.emails_sent || 0) + 1, last_sent_at: new Date().toISOString() })
            .eq('id', sub.id);
          sent++;
        } else {
          errors++;
        }

        await delay(500);

      } catch (subErr) {
        console.error(`[WEEKLY] Error for ${sub.email}:`, subErr.message);
        errors++;
      }
    }

    console.log(`[WEEKLY] Done: sent=${sent} skipped=${skipped} errors=${errors}`);
    res.json({ success: true, sent, skipped, errors });

  } catch (err) {
    console.error('[WEEKLY]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/newsletter/send/breaking
// ══════════════════════════════════════════════════════════════
router.post('/send/breaking', async (req, res) => {
  try {
    const { article_id } = req.body;

    const { data: article } = await supabase
      .from('articles').select('*').eq('id', article_id).single();

    if (!article) return res.status(404).json({ error: 'Article not found' });

    const score = scoreArticle(article);
    if (score < 0.80) return res.json({ skipped: true, reason: `Score ${score.toFixed(2)} below 0.80 threshold` });

    article.importance_score = score;

    // Check already sent breaking for this article
    const { count: alreadySent } = await supabase
      .from('newsletter_emails')
      .select('*', { count: 'exact', head: true })
      .eq('email_type', 'breaking')
      .contains('article_ids', [article_id]);

    if ((alreadySent || 0) > 0) {
      return res.json({ skipped: true, reason: 'Breaking alert already sent for this article' });
    }

    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('is_active', true)
      .in('frequency', ['breaking', 'daily']); // both breaking + daily get breaking news

    if (!subscribers?.length) return res.json({ sent: 0, message: 'No subscribers' });

    let sent = 0, skipped = 0, errors = 0;

    for (const sub of subscribers) {
      try {
        // Check topic match
        if (sub.topics?.length && !sub.topics.includes(article.category) && !sub.topics.includes('General')) {
          skipped++; continue;
        }

        if (await isOverWeeklyLimit(sub.id, sub.max_per_week || 7)) { skipped++; continue; }

        const emailLog = await logEmail(
          sub.id, 'breaking', `🔴 Breaking: ${article.title.slice(0, 60)}`,
          [article.id], score
        );

        const trackingPixelUrl = emailLog?.open_token
          ? `${API_URL}/api/newsletter/track/open/${emailLog.open_token}` : null;

        const { subject, html } = breakingNewsEmail({
          subscriber: sub, article,
          unsubscribeToken: sub.unsubscribe_token || sub.id, trackingPixelUrl,
        });

        const ok = await sendEmail({ to: sub.email, subject, html });
        if (ok) {
          await supabase.from('newsletter_subscribers')
            .update({ emails_sent: (sub.emails_sent || 0) + 1, last_sent_at: new Date().toISOString() })
            .eq('id', sub.id);
          sent++;
        } else {
          errors++;
        }

        await delay(500);

      } catch (subErr) {
        console.error(`[BREAKING] Error for ${sub.email}:`, subErr.message);
        errors++;
      }
    }

    console.log(`[BREAKING] Done: sent=${sent} skipped=${skipped} errors=${errors}`);
    res.json({ success: true, sent, skipped, errors });

  } catch (err) {
    console.error('[BREAKING]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  GET /api/newsletter/check/:email  — check subscription status
// ══════════════════════════════════════════════════════════════
router.get('/check/:email', async (req, res) => {
  try {
    const { data } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, frequency, topics, is_active, created_at')
      .eq('email', req.params.email.toLowerCase())
      .single();

    res.json({ subscribed: !!(data && data.is_active), subscriber: data || null });
  } catch {
    res.json({ subscribed: false, subscriber: null });
  }
});

// ══════════════════════════════════════════════════════════════
//  GET /api/newsletter/track/open/:token
// ══════════════════════════════════════════════════════════════
router.get('/track/open/:token', async (req, res) => {
  try {
    await supabase.from('newsletter_emails')
      .update({ opened_at: new Date().toISOString() })
      .eq('open_token', req.params.token);
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store');
    res.send(pixel);
  } catch {
    res.status(200).send('');
  }
});

// ══════════════════════════════════════════════════════════════
//  GET /api/newsletter/stats
// ══════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const { count: total }    = await supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: daily }    = await supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('frequency', 'daily').eq('is_active', true);
    const { count: breaking } = await supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('frequency', 'breaking').eq('is_active', true);
    const { count: weekly }   = await supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('frequency', 'weekly').eq('is_active', true);
    const { count: sent }     = await supabase.from('newsletter_emails').select('*', { count: 'exact', head: true });
    const { count: opened }   = await supabase.from('newsletter_emails').select('*', { count: 'exact', head: true }).not('opened_at', 'is', null);

    res.json({
      subscribers: { total, daily, breaking, weekly },
      emails:      { sent, opened, open_rate: sent ? Math.round((opened / sent) * 100) : 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  PUT /api/newsletter/preferences/:token
// ══════════════════════════════════════════════════════════════
router.put('/preferences/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { frequency, topics, max_per_week } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (frequency)    updates.frequency    = frequency;
    if (topics)       updates.topics       = topics;
    if (max_per_week) updates.max_per_week = max_per_week;

    let query = supabase.from('newsletter_subscribers').update(updates);
    query = isNaN(token) ? query.eq('unsubscribe_token', token) : query.eq('id', token);
    const { data, error } = await query.select().single();

    if (error || !data) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ success: true, subscriber: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;