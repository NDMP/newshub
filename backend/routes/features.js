// ═══════════════════════════════════════════════════════════════════════════
//  NewsHub — Features Routes  v5
//  Fact Checker: Groq primary + Gemini second opinion for uncertain cases
// ═══════════════════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const Groq    = require('groq-sdk');
const crypto  = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const groq = new Groq({
  apiKey: (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '').trim()
});

// ── Gemini second-opinion for uncertain verdicts ──────────────────────────
async function geminiFactCheck(claim, groqVerdict, groqExplanation) {
  // Second focused Groq call — generates plain-English 3-line WHY explanation
  // Has its own retry + fallback so it NEVER returns null — UI always shows WHY box
  const shortClaim   = claim.slice(0, 200);
  const shortContext = groqExplanation.slice(0, 150);

  const FALLBACK_WHY = {
    false:      'This claim has been identified as fake or fabricated.',
    misleading: 'This claim is partially true but missing important context.',
    verified:   'This claim matches confirmed facts from reliable sources.',
    unverified: 'Not enough evidence available to confirm or deny this claim.',
  };

  try {
    const res = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a fact-checker. Explain verdicts in 3 simple lines. Return complete valid JSON always.'
        },
        {
          role: 'user',
          content: `CLAIM: "${shortClaim}"
VERDICT: ${groqVerdict}
CONTEXT: ${shortContext}

You must return this exact JSON with specific, factual content (max 15 words each value):
{"verdict":"${groqVerdict}","confidence":85,"reason":{"what":"<specific claim being made>","truth":"<specific real fact that contradicts or confirms>","why":"<precise reason: why fake, why true, or why unclear>"},"source_used":"ai_knowledge"}

INSTRUCTIONS based on verdict:
- false: what=the fake claim. truth=the real fact. why=exact proof it is fake (person denied it / debunked by fact-checkers / contradicts known facts).
- verified: what=the claim. truth=confirmed fact with detail. why=reliable source or evidence.
- misleading: what=the claim. truth=the fuller picture. why=what context is missing.
- unverified: what=the claim. truth=what is known so far. why=why we cannot confirm yet.
Be specific — mention names, facts, dates where possible. No generic answers.`
        }
      ],
      model:           'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      temperature:     0.1,
      max_tokens:      320,
    });

    const raw = (res.choices[0].message.content || '').replace(/```json|```/g, '').trim();

    let result = null;
    try {
      result = JSON.parse(raw);
    } catch {
      // Truncated JSON — try to recover partial object
      try {
        // Find last complete field and close the JSON
        const fixed = raw
          .replace(/,\s*"why":[^}]*$/, '"why":"' + FALLBACK_WHY[groqVerdict] + '"}}}')
          .replace(/,\s*"truth":[^}]*$/, '"truth":"See explanation above.","why":"' + FALLBACK_WHY[groqVerdict] + '"}}}');
        result = JSON.parse(fixed);
      } catch {
        result = null;
      }
    }

    // Ensure reason object always has all 3 fields
    if (!result || !result.reason || !result.reason.what || !result.reason.why) {
      result = {
        verdict:     groqVerdict,
        confidence:  82,
        reason: {
          what:  result?.reason?.what  || 'The claim: ' + shortClaim.slice(0, 60),
          truth: result?.reason?.truth || shortContext.slice(0, 80),
          why:   result?.reason?.why   || FALLBACK_WHY[groqVerdict],
        },
        source_used: 'ai_knowledge',
      };
    }

    console.log(`[EXPLAIN] WHY box ready for: ${groqVerdict}`);
    return result;

  } catch (e) {
    console.error('[EXPLAIN] Groq call failed:', e.message);
    // Always return a usable fallback — never null
    return {
      verdict:     groqVerdict,
      confidence:  80,
      reason: {
        what:  'The claim: ' + shortClaim.slice(0, 60),
        truth: shortContext.slice(0, 80) || 'See main explanation above.',
        why:   FALLBACK_WHY[groqVerdict],
      },
      source_used: 'ai_knowledge',
    };
  }
}
// ── Merge Groq + Gemini — Gemini reason always shown ────────────────────
function mergeVerdicts(groqResult, geminiResult) {
  if (!geminiResult) return { ...groqResult, gemini_used: false };

  const RANK = { false: 4, misleading: 3, verified: 2, unverified: 1 };
  const gqRank = RANK[groqResult.verdict]   || 1;
  const gmRank = RANK[geminiResult.verdict] || 1;

  // Pick winner verdict
  let winVerdict    = groqResult.verdict;
  let winConfidence = groqResult.confidence;

  if (groqResult.verdict === geminiResult.verdict) {
    // Both agree — boost confidence slightly
    winConfidence = Math.min(90, Math.round((groqResult.confidence + geminiResult.confidence) / 2) + 6);
  } else if (gmRank > gqRank || (gmRank === gqRank && geminiResult.confidence > groqResult.confidence)) {
    // Gemini has stronger/more decisive verdict
    winVerdict    = geminiResult.verdict;
    winConfidence = geminiResult.confidence;
  }

  // Always attach Gemini reason object for UI display
  const reason = geminiResult.reason || null;

  return {
    ...groqResult,
    verdict:      winVerdict,
    confidence:   winConfidence,
    gemini_used:  true,
    gemini_reason: reason,   // { what, truth, why } object
    source_used:  'both',
  };
}


function hashClaim(text) {
  return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

// ── Groq JSON call with automatic rate-limit retry ────────────────────────
async function groqJSON(messages, maxTokens = 400) {
  const MAX_RETRIES = 4;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        messages,
        model:           'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        temperature:     0.1,
        max_tokens:      maxTokens,
      });
      const raw = res.choices[0].message.content;
      try { return JSON.parse(raw); }
      catch (e) { console.error('[groqJSON] Parse failed:', raw.slice(0,200)); throw e; }
    } catch (err) {
      const is429 = err?.status === 429 ||
                    (err?.message || '').includes('429') ||
                    (err?.message || '').includes('rate_limit');
      if (is429 && attempt < MAX_RETRIES) {
        // Parse wait time from error message, default to 12s
        const match = (err.message || '').match(/try again in ([\d.]+)s/i);
        const wait  = match ? Math.ceil(parseFloat(match[1])) * 1000 + 1500 : 12000;
        console.log(`[groqJSON] Rate limit hit (attempt ${attempt}/${MAX_RETRIES}) — waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. SAVE ARTICLE — POST /api/features/save
// ═══════════════════════════════════════════════════════════════════════════
router.post('/save', async (req, res) => {
  const { user_id, article_id } = req.body;
  if (!user_id || !article_id) {
    return res.status(400).json({ error: 'user_id and article_id required' });
  }

  console.log(`[SAVE] user=${user_id} article=${article_id}`);

  // Step 1: delete any existing row (idempotent)
  const { error: delErr } = await supabase
    .from('saved_articles')
    .delete()
    .eq('user_id', user_id)
    .eq('article_id', article_id);

  if (delErr) console.warn('[SAVE] delete warn (ok if not found):', delErr.message);

  // Step 2: insert fresh
  const { data, error } = await supabase
    .from('saved_articles')
    .insert({ user_id, article_id, saved_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error('[SAVE] insert error:', error.message, error.details);
    return res.status(500).json({ error: error.message });
  }

  console.log('[SAVE] ✓ saved, row id:', data?.id);
  res.json({ saved: true, data });
});

// ═══════════════════════════════════════════════════════════════════════════
//  UNSAVE ARTICLE — DELETE /api/features/save
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/save', async (req, res) => {
  const { user_id, article_id } = req.body;
  if (!user_id || !article_id) return res.status(400).json({ error: 'missing fields' });

  const { error } = await supabase
    .from('saved_articles')
    .delete()
    .eq('user_id', user_id)
    .eq('article_id', article_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ saved: false });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET SAVED — GET /api/features/saved?user_id=xxx
// ═══════════════════════════════════════════════════════════════════════════
router.get('/saved', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const { data, error } = await supabase
    .from('saved_articles')
    .select(`
      id, saved_at,
      articles ( id, title, source, date, image_url, category, summary, url )
    `)
    .eq('user_id', user_id)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('[SAVED GET] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.json({ articles: data || [] });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. TRACK READ — POST /api/features/read
// ═══════════════════════════════════════════════════════════════════════════
router.post('/read', async (req, res) => {
  const { user_id, article_id, read_secs } = req.body;
  if (!user_id || !article_id) return res.json({ ok: false });

  try {
    // Check if row exists
    const { data: existing } = await supabase
      .from('reading_history')
      .select('id, read_secs')
      .eq('user_id', user_id)
      .eq('article_id', article_id)
      .maybeSingle();

    if (existing) {
      // Update time spent
      await supabase
        .from('reading_history')
        .update({
          read_at:  new Date().toISOString(),
          read_secs: (existing.read_secs || 0) + (read_secs || 60),
        })
        .eq('id', existing.id);
    } else {
      // New read
      const { error } = await supabase
        .from('reading_history')
        .insert({ user_id, article_id, read_secs: read_secs || 60, read_at: new Date().toISOString() });
      if (error) console.error('[READ] insert error:', error.message);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[READ]', err.message);
    res.json({ ok: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════
router.get('/prefs', async (req, res) => {
  const { user_id } = req.query;
  const { data } = await supabase
    .from('user_preferences').select('*').eq('user_id', user_id).maybeSingle();
  res.json(data || {
    fav_categories: ['General','Technology'], fav_sources: [],
    reading_time_goal: 10, notifications_on: true,
  });
});

router.post('/prefs', async (req, res) => {
  const { user_id, ...prefs } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  // Try update first, then insert
  const { data: existing } = await supabase
    .from('user_preferences').select('user_id').eq('user_id', user_id).maybeSingle();

  if (existing) {
    await supabase.from('user_preferences')
      .update({ ...prefs, updated_at: new Date().toISOString() }).eq('user_id', user_id);
  } else {
    await supabase.from('user_preferences')
      .insert({ user_id, ...prefs, updated_at: new Date().toISOString() });
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  4. DASHBOARD — GET /api/features/dashboard?user_id=xxx
// ═══════════════════════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Fetch reading history — join articles for metadata
    const { data: historyRaw, error: histErr } = await supabase
      .from('reading_history')
      .select('id, article_id, read_at, read_secs, articles(id, category, bias_label, source)')
      .eq('user_id', user_id)
      .gte('read_at', sevenDaysAgo)
      .order('read_at', { ascending: false });

    if (histErr) console.error('[DASH] history error:', histErr.message);
    const history = historyRaw || [];

    // Saved count
    const { count: savedCnt } = await supabase
      .from('saved_articles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id);

    // Prefs
    const { data: prefs } = await supabase
      .from('user_preferences').select('*').eq('user_id', user_id).maybeSingle();

    // Latest articles for recommendations
    const { data: latestArts } = await supabase
      .from('articles')
      .select('id, title, source, image_url, category, summary, date')
      .order('timestamp', { ascending: false })
      .limit(40);

    // ── compute stats ────────────────────────────────────────────
    const articlesRead = history.length;
    const totalMins    = Math.max(1, Math.round(
      history.reduce((s, h) => s + (h.read_secs || 60), 0) / 60
    ));

    // Category breakdown — articles.category comes from join
    const catMap = {};
    history.forEach(h => {
      const cat = (h.articles && h.articles.category)
        ? h.articles.category.split('|')[0].trim()
        : 'General';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const topCategories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Bias balance
    const biasMap = { Low: 0, Medium: 0, High: 0 };
    history.forEach(h => {
      const b = ((h.articles && h.articles.bias_label) || 'Low').toLowerCase();
      if (b.includes('low'))    biasMap.Low++;
      else if (b.includes('med')) biasMap.Medium++;
      else if (b.includes('high')) biasMap.High++;
      else biasMap.Low++;
    });

    // Top sources
    const srcMap = {};
    history.forEach(h => {
      const src = (h.articles && h.articles.source) || 'Unknown';
      srcMap[src] = (srcMap[src] || 0) + 1;
    });
    const topSources = Object.entries(srcMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    // Streak
    const readDays = new Set(history.map(h => (h.read_at || '').slice(0, 10)).filter(Boolean));
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (readDays.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }

    // Recommendations — unread articles from favourite categories
    const readIds  = new Set(history.map(h => h.article_id).filter(Boolean));
    const favCats  = prefs?.fav_categories || ['General', 'Technology'];
    const allArts  = latestArts || [];

    let recommended = allArts
      .filter(a => !readIds.has(a.id) && favCats.includes((a.category || '').split('|')[0]))
      .slice(0, 4);

    // Fallback: if nothing matches fav cats, just show latest unread
    if (recommended.length === 0) {
      recommended = allArts.filter(a => !readIds.has(a.id)).slice(0, 4);
    }
    // Last fallback: just show latest 4 articles
    if (recommended.length === 0) {
      recommended = allArts.slice(0, 4);
    }

    console.log(`[DASH] user=${user_id} reads=${articlesRead} saved=${savedCnt} streak=${streak}`);

    res.json({
      stats: {
        articles_read_week:  articlesRead,
        reading_mins_week:   totalMins,
        saved_count:         savedCnt || 0,
        reading_streak_days: streak,
        reading_goal_mins:   prefs?.reading_time_goal || 10,
      },
      top_categories: topCategories,
      top_sources:    topSources,
      bias_balance:   biasMap,
      recommended,
    });

  } catch (err) {
    console.error('[DASHBOARD] fatal:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  5. FACT CHECKER — POST /api/features/factcheck
//  Handles: plain claims, full sentences, AND news article URLs
// ═══════════════════════════════════════════════════════════════════════════
//  5. FACT CHECKER — POST /api/features/factcheck
//  Evidence-first: verdict ONLY based on matching articles in DB.
//  Verified = 2+ sources confirm. No articles = unverified.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/factcheck', async (req, res) => {
  const { claim } = req.body;
  if (!claim?.trim()) return res.status(400).json({ error: 'claim required' });

  const raw = claim.trim();

  // ── URL: extract searchable keywords from slug (do NOT auto-verify) ───
  const isUrl = /^https?:\/\//i.test(raw);
  let searchTerms  = raw;
  let displayClaim = raw;

  // ── Known dedicated fact-check domains ───────────────────────────────
  const FACTCHECK_DOMAINS = new Set([
    'boomlive.in', 'altnews.in', 'factcheck.afp.com', 'snopes.com',
    'fullfact.org', 'vishvasnews.com', 'factly.in', 'thequint.com',
    'hoax-slayer.net', 'logically.ai', 'misbar.com',
    'factcrescendo.com', 'newsmobile.in', 'thelogicalindian.com',
    'factcheck.org', 'politifact.com', 'leadstories.com',
    'checkyourfact.com', 'factchecker.in', 'newschecker.in',
  ]);

  // ── Known satire/fake news domains ────────────────────────────────────
  const SATIRE_DOMAINS = new Set([
    'theonion.com', 'fauxy.com', 'satiricalpost.com', 'worldnewsdailyreport.com',
    'nationalreport.net', 'empirenews.net', 'newsbiscuit.com',
  ]);

  // ── Slug patterns that signal a fact-check/debunking article ─────────
  // Covers: dedicated fact-check sites, denial articles, debunking stories
  // Works for ANY domain — NDTV, Al Jazeera, crictracker, etc.
  const FACTCHECK_SLUG_PATTERNS = [
    // Explicit fact-check words
    /fake[\s-]news/i,
    /fact[\s-]check/i,
    /debunked?/i,
    /hoax/i,
    /false[\s-]claim/i,
    /false[\s-]rumou?rs?/i,
    /misinformation/i,
    /not[\s-]true/i,
    /no[\s-]truth/i,
    /viral[\s-]false/i,
    /viral[\s-]claim/i,
    /spread[\s-]on[\s-]social/i,
    /how[\s-]false[\s-]rumou?rs?/i,
    /rumou?rs?[\s-].*false/i,
    // Denial / clarification words — person denying a fake story
    /quashes/i,
    /deni(?:es|ed)[\s-](?:report|rumou?r|claim|allegation)/i,
    /deni(?:es|ed)[\s-](?:fake|false)/i,
    /rubbishes/i,
    /dismisses[\s-](?:report|rumou?r|claim)/i,
    /refutes/i,
    /clarif(?:ies|ied|ication)[\s-](?:report|rumou?r|claim|fake|false)/i,
    /sets[\s-]record[\s-]straight/i,
    /puts[\s-]to[\s-]rest/i,
    /shuts[\s-]down[\s-](?:report|rumou?r|claim)/i,
    /slams[\s-](?:fake|false|report)/i,
    /responds[\s-]to[\s-](?:fake|false|rumou?r)/i,
    /clears[\s-](?:air|rumou?r)/i,
    /counters[\s-](?:claim|rumou?r|report)/i,
    /busts[\s-]myth/i,
    /death[\s-]hoax/i,
    /no[\s-](?:truth|evidence)[\s-]in/i,
  ];

  if (isUrl) {
    try {
      const u      = new URL(raw);
      const domain = u.hostname.replace(/^www\./, '');
      const decodedPath = (() => {
        try { return decodeURIComponent(u.pathname); } catch { return u.pathname; }
      })();
      const slug = decodedPath
        .replace(/\.(html?|aspx?|php)$/i, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Detect if slug pattern indicates this is a fact-check/debunking article
      const isFactCheckBySlug = FACTCHECK_SLUG_PATTERNS.some(p => p.test(slug));
      const isFactCheckDomain = FACTCHECK_DOMAINS.has(domain);
      const isSatireDomain    = SATIRE_DOMAINS.has(domain);

      // Clean slug — remove only generic noise, keep "false", "hoax", "rumour" as signal words
      const cleanSlug = slug
        .replace(/\bfact[\s-]?check\b/gi, '')
        .replace(/\bviral\b/gi, '')
        .replace(/\bexplained?\b/gi, '')
        .replace(/\bhow\b/gi, '')
        .replace(/\bspread\b/gi, '')
        .replace(/\bon social media\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      searchTerms = cleanSlug || slug || domain;

      if (isSatireDomain) {
        displayClaim = `[SATIRE SITE: ${domain}] "${cleanSlug || slug}"`;

      } else if (isFactCheckDomain || isFactCheckBySlug) {
        // Extract who/what the fake claim is about from the slug
        const subject = cleanSlug
          .replace(/\bfake[\s-]?news\b/gi, '')
          .replace(/\bdebunked?\b/gi, '')
          .replace(/\bfalse[\s-]?rumou?rs?\b/gi, '')
          .replace(/\bhoax\b/gi, '')
          .replace(/\bmisleading\b/gi, '')
          .replace(/\bclaim\b/gi, '')
          .replace(/\bmisinformation\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        displayClaim = `[FACT-CHECK ARTICLE from ${domain}] This article debunks a FALSE claim about: "${subject || cleanSlug}"`;
      } else {
        displayClaim = slug ? `Claim from ${domain}: "${slug}"` : `URL from ${domain}`;
      }

    } catch { /* malformed URL — use as-is */ }
  }

  const hash = hashClaim(raw);

  // ── Cache check — skip if recheck=true ───────────────────────────────
  const forceRecheck = req.body.recheck === true;

  if (!forceRecheck) {
    const { data: cached } = await supabase
      .from('fact_checks').select('*').eq('claim_hash', hash).maybeSingle();

    if (cached) {
      let kf = cached.key_facts;
      if (typeof kf === 'string') { try { kf = JSON.parse(kf); } catch { kf = []; } }
      if (!Array.isArray(kf)) kf = [];
      return res.json({ ...cached, key_facts: kf, tip: cached.tip || '', from_cache: true });
    }
  } else {
    // Delete old cached result so fresh result gets stored cleanly
    await supabase.from('fact_checks').delete().eq('claim_hash', hash);
    console.log(`[FACTCHECK] Force recheck — cleared cache for hash ${hash.slice(0,8)}`);
  }

  // ── Search DB for matching articles ──────────────────────────────────
  const STOPWORDS = new Set([
    'that','this','from','with','have','been','were','they','their','will',
    'would','could','should','about','which','when','what','where','into',
    'than','also','just','more','some','news','says','said','claim','claims',
    'article','after','before','while','since','under','over','between'
  ]);

  const words = searchTerms
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 7);

  let articles = [];

  if (words.length > 0) {
    const titleConds   = words.map(w => `title.ilike.%${w}%`).join(',');
    const summaryConds = words.map(w => `summary.ilike.%${w}%`).join(',');

    const { data } = await supabase
      .from('articles')
      .select('title, source, summary, bias_label, url, date, language')
      .or(`${titleConds},${summaryConds}`)
      .order('timestamp', { ascending: false })
      .limit(8);

    articles = data || [];
  }

  // ── Score by keyword overlap — keep only genuinely relevant articles ──
  const scored = articles
    .map(a => {
      const text    = ((a.title || '') + ' ' + (a.summary || '')).toLowerCase();
      const matches = words.filter(w => text.includes(w)).length;
      return { ...a, matches };
    })
    .filter(a => a.matches >= Math.max(1, Math.floor(words.length * 0.3)))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 5);

  // ── Evidence metadata ────────────────────────────────────────────────
  const uniqueSources   = new Set(scored.map(a => a.source)).size;
  const articleCount    = scored.length;
  const multiSrcConfirm = uniqueSources >= 2;
  const hasDbEvidence   = articleCount > 0;

  // ── Build context string from DB articles ────────────────────────────
  const contextStr = scored.length > 0
    ? scored.map((a, i) =>
        `[DB Article ${i+1}]\nTitle: "${a.title}"\nSource: ${a.source} | Date: ${a.date?.slice(0,10)||'recent'} | Bias: ${a.bias_label||'Unknown'}\nSummary: ${a.summary?.slice(0, 120) || ''}`
      ).join('\n\n')
    : 'NO MATCHING ARTICLES IN DATABASE.';

  // ── TWO-LAYER VERDICT STRATEGY ───────────────────────────────────────
  // Layer 1: DB articles (primary evidence)
  // Layer 2: Groq world knowledge (fallback if DB has nothing, or supplement)
  // This allows fact-checking ANY claim — not just what's been synced yet.
  // ─────────────────────────────────────────────────────────────────────

  let dbEvidenceNote = '';
  let knowledgeInstruction = '';

  if (articleCount === 0) {
    dbEvidenceNote = ` DB:0 articles.`;
    knowledgeInstruction = ` Use own knowledge. Death hoaxes/fake stats→false. No DB match+post-2024→unverified.`;
  } else if (articleCount === 1) {
    dbEvidenceNote = ` DB:1 article (${uniqueSources} src).`;
    knowledgeInstruction = ` Combine DB+knowledge. 1 source alone≠verified.`;
  } else {
    dbEvidenceNote = ` DB:${articleCount} articles, ${uniqueSources} sources.`;
    knowledgeInstruction = multiSrcConfirm
      ? ` Multiple sources match. Cross-check→verified if consistent.`
      : ` 1 source in DB. Cap confidence 65%.`;
  }

  // ── Groq: DB evidence + world knowledge combined ─────────────────────
  try {
    const result = await groqJSON([
      {
        role: 'system',
        content: `Fact-checker for Indian news. Use DB articles AND your own knowledge.
JSON only: {"verdict":"verified"|"false"|"misleading"|"unverified","confidence":0-100,"explanation":"2 sentences","key_facts":["f1","f2","f3"],"tip":"1 tip","source_used":"database"|"ai_knowledge"|"both"}
RULES: verified=2+ sources agree OR knowledge confident (max 88%). false=clearly wrong. misleading=partial truth. unverified=ONLY if post-cutoff AND no DB match.
SPECIAL RULES:
- If claim starts with [FACT-CHECK ARTICLE from ...]: the story being debunked is FALSE — return "false". High confidence 85-90%.
- If claim starts with [SATIRE SITE: ...]: content is fictional — return "false".
- If slug contains "quashes/denies/rubbishes/dismisses/clarifies rumours": the rumour is FALSE — person denied it, return "false".
- Celebrity death hoaxes→false. Fake WhatsApp forwards→false. Fake stats/quotes→false.
- For IPL/cricket/sports rumours denied by the player themselves→false.
- URL domain alone≠verified. Never >90%.${dbEvidenceNote}${knowledgeInstruction}`
      },
      {
        role: 'user',
        content: `CLAIM: "${displayClaim}"\nDB (${scored.length} articles, ${uniqueSources} sources): ${contextStr}\nVerdict:`
      }
    ], 380);


    const groqResult = {
      claim_text:  raw,
      claim_hash:  hash,
      verdict:     result.verdict     || 'unverified',
      confidence:  result.confidence  || 20,
      explanation: result.explanation || 'No matching articles found in the database for this claim.',
      key_facts:   result.key_facts   || [],
      tip:         result.tip         || '',
      sources:     scored.slice(0, 3),
    };

    // ── Gemini second opinion ─────────────────────────────────────────
    // Always call Gemini — it explains WHY for every verdict type.
    // This gives users a clear 3-line plain-English explanation every time.
    let finalResult = groqResult;

    console.log(`[FACTCHECK] Groq → ${groqResult.verdict} (${groqResult.confidence}%) — asking Gemini for explanation`);
    const geminiResult = await geminiFactCheck(displayClaim, groqResult.verdict, groqResult.explanation);
    finalResult = mergeVerdicts(groqResult, geminiResult);
    console.log(`[FACTCHECK] Final → ${finalResult.verdict} (${finalResult.confidence}%)`);

    const toStore = finalResult;

    // Cache the result
    try {
      await supabase.from('fact_checks').insert({
        ...toStore,
        key_facts: JSON.stringify(toStore.key_facts),
        sources:   JSON.stringify(toStore.sources),
      });
    } catch (_) { /* non-fatal */ }

    console.log(`[FACTCHECK] "${raw.slice(0,60)}" → ${toStore.verdict} (${toStore.confidence}%) | ${articleCount} articles, ${uniqueSources} sources`);
    res.json({ ...toStore, from_cache: false });

  } catch (err) {
    console.error('[FACTCHECK] Groq error:', err.message);
    res.status(500).json({ error: 'Fact check failed. Please try again.' });
  }
});

// ── Clear fact-check cache (admin use) ───────────────────────────────────
router.delete('/factcheck-cache', async (req, res) => {
  try {
    const { error } = await supabase.from('fact_checks').delete().neq('id', 0);
    if (error) throw error;
    console.log('[FACTCHECK] Cache cleared');
    res.json({ message: 'Fact-check cache cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  6. AUDIO BRIEFING — POST /api/features/audio-briefing
// ═══════════════════════════════════════════════════════════════════════════
router.post('/audio-briefing', async (req, res) => {
  const { user_id, categories, max_stories } = req.body;

  const cats  = Array.isArray(categories) && categories.length
    ? categories
    : ['General', 'Technology', 'Business', 'Sports', 'Health'];
  const limit = Math.min(parseInt(max_stories) || 5, 8);

  try {
    // Step 1: Try category + summary match
    let articles = [];
    const { data: catMatch } = await supabase
      .from('articles')
      .select('id, title, source, summary, category, date')
      .in('category', cats)
      .not('summary', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(limit + 6);

    if (catMatch && catMatch.length >= 2) {
      articles = catMatch.slice(0, limit);
      console.log('[AUDIO] category match:', articles.length);
    }

    // Step 2: Fallback — any articles with summaries
    if (articles.length < 2) {
      const { data: withSummary } = await supabase
        .from('articles')
        .select('id, title, source, summary, category, date')
        .not('summary', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (withSummary && withSummary.length >= 1) {
        articles = withSummary;
        console.log('[AUDIO] fallback with-summary:', articles.length);
      }
    }

    // Step 3: Last resort — any recent articles
    if (articles.length < 1) {
      const { data: lastResort } = await supabase
        .from('articles')
        .select('id, title, source, summary, category, date')
        .order('timestamp', { ascending: false })
        .limit(limit);
      articles = lastResort || [];
      console.log('[AUDIO] last-resort:', articles.length);
    }

    if (!articles.length) {
      return res.json({
        script: 'No news available. Please click Sync Feed in the sidebar first, then try again.',
        stories: []
      });
    }

    const articleList = articles.map((a, i) =>
      `Story ${i+1}: [${a.category || 'News'}] ${a.title} — ${a.source}. ${a.summary || ''}`
    ).join('\n\n');

    // Groq with rate-limit retry (up to 3 attempts)
    let script = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await groq.chat.completions.create({
          model:       'llama-3.1-8b-instant',
          temperature: 0.65,
          max_tokens:  900,
          messages: [
            {
              role: 'system',
              content: `You are Priya, a warm Indian English news radio presenter.
Write a natural 2-minute audio news briefing script.
Rules:
- Start: "Good morning! Welcome to your NewsHub briefing."
- Each story: 2-3 conversational sentences
- Transitions: "Moving on...", "In other news...", "Meanwhile..."
- End: "That's your update. Stay informed, stay ahead!"
- Plain text ONLY — no markdown, no bullets, no asterisks`
            },
            {
              role: 'user',
              content: `Write a radio briefing for these ${articles.length} stories:\n\n${articleList}`
            }
          ]
        });
        script = completion.choices[0].message.content.trim();
        break; // success
      } catch (groqErr) {
        const msg = String(groqErr.message || '');
        const isRate = msg.includes('429') || msg.includes('rate') || msg.includes('limit');
        if (isRate && attempt < 3) {
          console.warn('[AUDIO] Rate limit, retrying in', attempt * 3, 's');
          await new Promise(r => setTimeout(r, attempt * 3000));
        } else {
          throw groqErr;
        }
      }
    }

    if (!script) throw new Error('Groq returned empty script');

    // Track articles as read
    if (user_id) {
      for (const a of articles) {
        if (!a.id) continue;
        const { data: existing } = await supabase
          .from('reading_history')
          .select('id').eq('user_id', user_id).eq('article_id', a.id).maybeSingle();
        if (!existing) {
          try {
            await supabase.from('reading_history')
              .insert({ user_id, article_id: a.id, read_secs: 90, read_at: new Date().toISOString() });
          } catch (_) { /* non-fatal */ }
        }
      }
    }

    console.log(`[AUDIO] ✓ ${articles.length} stories, script ${script.length} chars`);
    res.json({
      script,
      stories: articles.map(a => ({
        title:    a.title,
        source:   a.source,
        category: a.category || 'News',
      }))
    });

  } catch (err) {
    console.error('[AUDIO] Error:', err.message);
    res.status(500).json({ error: err.message || 'Audio briefing failed. Please try again.' });
  }
});

//  7. BREAKING NEWS ALERTS — POST /api/features/check-alerts
// ═══════════════════════════════════════════════════════════════════════════
router.post('/check-alerts', async (req, res) => {
  const { keywords, last_checked } = req.body;
  if (!keywords?.length) return res.json({ alerts: [], checked_at: new Date().toISOString() });

  try {
    // Build OR filter — search only title (summary may be null)
    const titleOr = keywords.map(kw => `title.ilike.%${kw}%`).join(',');

    // Time window: 6 hours back for "Check Now", or since last_checked
    const since = last_checked
      ? new Date(new Date(last_checked).getTime() - 5 * 60000).toISOString() // 5 min buffer
      : new Date(Date.now() - 6 * 3600 * 1000).toISOString();

    // Primary search: with timestamp filter
    let articles = [];
    const { data: filtered, error: filterErr } = await supabase
      .from('articles')
      .select('id, title, source, category, image_url, date, url')
      .or(titleOr)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (!filterErr && filtered && filtered.length > 0) {
      articles = filtered;
    } else {
      // Fallback: no time filter — return any keyword matches
      console.log('[ALERTS] No recent matches, falling back to all-time search');
      const { data: allTime } = await supabase
        .from('articles')
        .select('id, title, source, category, image_url, date, url')
        .or(titleOr)
        .order('timestamp', { ascending: false })
        .limit(20);
      articles = allTime || [];
    }

    const alerts = articles.map(a => ({
      id:              a.id,
      title:           a.title,
      source:          a.source,
      category:        a.category,
      image_url:       a.image_url,
      date:            a.date,
      url:             a.url,
      matched_keyword: keywords.find(kw =>
        (a.title || '').toLowerCase().includes(kw.toLowerCase())
      ) || keywords[0],
    }));

    console.log(`[ALERTS] keywords=${keywords.join(',')} found=${alerts.length}`);
    res.json({ alerts, checked_at: new Date().toISOString() });

  } catch (err) {
    console.error('[ALERTS]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;