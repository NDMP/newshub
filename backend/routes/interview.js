// ═══════════════════════════════════════════════════════════════════════════
//  NewsHub — Interview Mode Routes
//  COPY THIS FILE TO: newshub/newshub/backend/routes/interview.js
//
//  FIX: Groq Rate Limit (429 TPM exceeded on free tier)
//    1. askGroq() retries automatically — reads "try again in Xs" from error
//    2. All max_tokens reduced (450-700 instead of 700-1000)
//    3. Feed fetches 15 articles instead of 40 (biggest token saving)
//    4. Prompts shortened — removes redundant words
//    5. 2-minute in-memory cache — same field+target skips Groq entirely
//    6. User-friendly error: "AI is busy, retry in 15s" instead of raw JSON
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

const groq = new Groq({
  apiKey: (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '')
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// ══════════════════════════════════════════════════════════════════════════
//  RATE-LIMIT-SAFE GROQ HELPER
//  Reads the wait time FROM the Groq error message and waits exactly that
//  long before retrying. Retries up to 3 times.
// ══════════════════════════════════════════════════════════════════════════
async function askGroq(prompt, maxTokens = 450, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview coach for Indian students. Respond with valid JSON only. Be concise.'
          },
          { role: 'user', content: prompt }
        ],
        model:           'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        temperature:     0.3,
        max_tokens:      maxTokens,
      });
      return JSON.parse(res.choices[0].message.content);

    } catch (err) {
      const isRateLimit = err?.status === 429 ||
                          (err?.message || '').includes('rate_limit') ||
                          (err?.message || '').includes('Rate limit');

      if (isRateLimit && attempt < retries) {
        // Groq error message says "Please try again in 15.12s" — parse that
        const match    = (err.message || '').match(/try again in ([\d.]+)s/);
        const waitSecs = match ? Math.ceil(parseFloat(match[1])) + 2 : attempt * 10;

        console.log(`[GROQ] Rate limited (attempt ${attempt}). Waiting ${waitSecs}s...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue; // retry
      }

      throw err; // not rate-limit, or retries exhausted
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  IN-MEMORY CACHE  — avoids re-calling Groq on every page load
//  Same field+target combo returns cached result for 2 minutes
// ══════════════════════════════════════════════════════════════════════════
const feedCache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCached(field, target) {
  const key  = `${field}:${target}`;
  const item = feedCache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) { feedCache.delete(key); return null; }
  return item.articles;
}

function setCache(field, target, articles) {
  feedCache.set(`${field}:${target}`, { ts: Date.now(), articles });
}

// ── Field config ───────────────────────────────────────────────────────────
const FIELD_CATEGORIES = {
  Engineering:  ['Technology', 'Business', 'Science', 'General'],
  Medical:      ['Health', 'Science', 'General'],
  Commerce:     ['Business', 'Economy', 'General', 'Technology'],
  Arts:         ['Entertainment', 'General', 'Politics'],
  Science:      ['Science', 'Technology', 'Health', 'General'],
  Management:   ['Business', 'General', 'Technology', 'Economy'],
};

const FIELD_EXCLUSIONS = {
  Engineering: {
    categories: ['Health', 'Sports', 'Entertainment'],
    keywords:   ['CA exam', 'ICAI', 'cricket', 'IPL', 'Bollywood', 'medicine', 'hospital'],
  },
  Medical: {
    categories: ['Sports', 'Entertainment', 'Business'],
    keywords:   ['CA exam', 'ICAI', 'cricket', 'IPL', 'Bollywood', 'merger'],
  },
  Commerce: {
    categories: ['Health', 'Sports', 'Entertainment'],
    keywords:   ['cricket', 'IPL', 'Bollywood', 'hospital'],
  },
  Arts: {
    categories: ['Technology', 'Health', 'Science'],
    keywords:   ['semiconductor', 'clinical trial', 'programming'],
  },
  Science: {
    categories: ['Sports', 'Entertainment'],
    keywords:   ['cricket', 'IPL', 'Bollywood', 'CA exam'],
  },
  Management: {
    categories: ['Sports', 'Entertainment'],
    keywords:   ['cricket', 'IPL', 'Bollywood'],
  },
};

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/interview/feed
// ══════════════════════════════════════════════════════════════════════════
router.get('/feed', async (req, res) => {
  try {
    const field  = req.query.field  || 'Engineering';
    const target = req.query.target || 'Placement';

    // Serve from cache to avoid Groq calls on every refresh
    const cached = getCached(field, target);
    if (cached) {
      return res.json({ articles: cached, field, target, cached: true });
    }

    const allowedCategories = FIELD_CATEGORIES[field] || FIELD_CATEGORIES.Engineering;
    const exclusions        = FIELD_EXCLUSIONS[field]  || FIELD_EXCLUSIONS.Engineering;

    // Fetch only 15 articles (saves ~60% of input tokens vs 40)
    const { data: rawArticles } = await supabase
      .from('articles')
      .select('id,title,source,summary,category,bias_label,sentiment_label,date')
      .in('category', allowedCategories)
      .order('timestamp', { ascending: false })
      .limit(15);

    if (!rawArticles?.length) return res.json({ articles: [], field, target });

    // JS keyword exclusion
    const kwRegex = exclusions.keywords.length
      ? new RegExp(
          exclusions.keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i'
        )
      : null;

    const filtered = rawArticles.filter(a =>
      !exclusions.categories.includes(a.category) &&
      (!kwRegex || (!kwRegex.test(a.title || '') && !kwRegex.test(a.summary || '')))
    );

    if (!filtered.length) return res.json({ articles: [], field, target });

    // Short prompt — title only, no summary, pick 6 max
    const articleList = filtered.map((a, i) => `${i}. [${a.category}] ${a.title}`).join('\n');

    const result = await askGroq(
`Rank for ${field} student, ${target} interview. Top 6 only. Exclude: ${exclusions.keywords.slice(0, 3).join(', ')}.

Articles:
${articleList}

JSON: {"ranked":[{"index":0,"priority":"high","why_relevant":"1 sentence","likely_question":"1 question","key_fact":"1 fact","ai_ranking_reason":"1 sentence"}]}`,
      400  // output tokens
    );

    const ranked = (result.ranked || []).slice(0, 6).map(r => ({
      ...filtered[r.index],
      priority:          r.priority          || 'medium',
      why_relevant:      r.why_relevant      || '',
      likely_question:   r.likely_question   || '',
      key_fact:          r.key_fact          || '',
      ai_ranking_reason: r.ai_ranking_reason || '',
    })).filter(a => a && a.id);

    setCache(field, target, ranked);
    res.json({ articles: ranked, field, target });

  } catch (err) {
    console.error('[INTERVIEW FEED]', err.message);
    // Fallback: return DB articles without AI ranking
    try {
      const field = req.query.field || 'Engineering';
      const cats  = FIELD_CATEGORIES[field] || FIELD_CATEGORIES.Engineering;
      const { data: fallback } = await supabase
        .from('articles')
        .select('id,title,source,summary,category,bias_label,sentiment_label,date')
        .in('category', cats)
        .order('timestamp', { ascending: false })
        .limit(6);
      res.json({
        articles: (fallback || []).map(a => ({
          ...a,
          priority:          'medium',
          why_relevant:      'Relevant for your field',
          likely_question:   `What do you know about: ${a.title}?`,
          key_fact:          (a.summary || '').substring(0, 100),
          ai_ranking_reason: 'AI busy — showing recent articles',
        })),
        field, target: req.query.target || 'Placement', fallback: true,
      });
    } catch {
      res.status(500).json({ error: err.message });
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/interview/quiz
// ══════════════════════════════════════════════════════════════════════════
router.post('/quiz', async (req, res) => {
  try {
    const { title, summary, category, article_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const result = await askGroq(
`News: ${title}
Category: ${category || 'General'}
Context: ${(summary || '').substring(0, 150)}

5 MCQ questions for interview prep. JSON:
{"topic":"short topic","questions":[{"id":1,"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"1-2 sentences","difficulty":"easy"}]}
Mix: 2 factual, 2 conceptual, 1 application. correct=index 0-3.`,
      500
    );

    res.json({ article_id, ...result });
  } catch (err) {
    console.error('[QUIZ]', err.message);
    res.status(500).json({ error: 'AI is busy — please wait 15 seconds and try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/interview/gd
// ══════════════════════════════════════════════════════════════════════════
router.post('/gd', async (req, res) => {
  try {
    const { title, summary, category } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const result = await askGroq(
`News: ${title}
Context: ${(summary || '').substring(0, 150)}
Category: ${category || 'General'}

GD prep kit JSON:
{"gd_topic":"debatable statement","background":"2 sentences","opening_line":"impressive opener","for_points":[{"point":"...","data":"..."},{"point":"...","data":"..."},{"point":"...","data":"..."}],"against_points":[{"point":"...","data":"..."},{"point":"...","data":"..."},{"point":"...","data":"..."}],"key_facts":["fact1","fact2","fact3"],"expert_view":"1 sentence","india_angle":"1 sentence","how_to_conclude":"strong closer"}`,
      650
    );

    res.json(result);
  } catch (err) {
    console.error('[GD]', err.message);
    res.status(500).json({ error: 'AI is busy — please wait 15 seconds and try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/interview/opinion
// ══════════════════════════════════════════════════════════════════════════
router.post('/opinion', async (req, res) => {
  try {
    const { title, summary, user_answer, category } = req.body;
    if (!title || !user_answer) return res.status(400).json({ error: 'title and user_answer required' });

    const result = await askGroq(
`Topic: ${title}
Category: ${category || 'General'}
Student answer: "${user_answer.substring(0, 350)}"

Evaluate. JSON:
{"score":75,"grade":"B","verdict":"1 line","strengths":["...","..."],"improvements":["...","..."],"missing_points":["...","..."],"better_answer":"3-4 sentences","key_phrases":["...","...","..."]}
Score: accuracy 30%, analysis 30%, structure 20%, India angle 20%.`,
      500
    );

    res.json(result);
  } catch (err) {
    console.error('[OPINION]', err.message);
    res.status(500).json({ error: 'AI is busy — please wait 15 seconds and try again.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/interview/save-session
// ══════════════════════════════════════════════════════════════════════════
router.post('/save-session', async (req, res) => {
  try {
    const { user_id, mode, topic, article_id, score, total_q, correct_q, time_spent, feedback } = req.body;
    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({ user_id, mode, topic, article_id, score, total_q, correct_q, time_spent, feedback })
      .select().single();
    if (error) throw error;
    res.json({ success: true, session: data });
  } catch (err) {
    console.error('[SAVE SESSION]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET /api/interview/stats/:user_id
// ══════════════════════════════════════════════════════════════════════════
router.get('/stats/:user_id', async (req, res) => {
  try {
    const { data: sessions } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', req.params.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!sessions?.length) {
      return res.json({ total_sessions: 0, avg_score: 0, streak: 0, by_mode: { quiz: 0, gd: 0, opinion: 0 }, recent: [] });
    }

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    let streak     = 0;
    let checkDate  = new Date(today);
    const datesSeen = new Set(sessions.map(s => new Date(s.created_at).toDateString()));
    while (datesSeen.has(checkDate.toDateString())) { streak++; checkDate.setDate(checkDate.getDate() - 1); }

    res.json({
      total_sessions: sessions.length,
      avg_score:      Math.round(sessions.reduce((a, s) => a + (s.score || 0), 0) / sessions.length),
      streak,
      by_mode:        sessions.reduce((acc, s) => { acc[s.mode] = (acc[s.mode] || 0) + 1; return acc; }, { quiz: 0, gd: 0, opinion: 0 }),
      recent:         sessions.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
