// ═══════════════════════════════════════════════════════════════════════════
//  NewsHub — Main Server
//  COPY THIS FILE TO: newshub/newshub/backend/server.js
// ═══════════════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Groq    = require('groq-sdk');

// ── Verify env loaded ──────────────────────────────────────────────────────
console.log('[ENV CHECK] SUPABASE URL:', process.env.VITE_SUPABASE_URL ? '✓ loaded' : '✗ MISSING');
console.log('[ENV CHECK] GROQ KEY    :', process.env.GROQ_API_KEY     ? '✓ loaded' : '✗ MISSING');
console.log('[ENV CHECK] NEWSAPI KEY :', process.env.NEWSAPI_KEY       ? '✓ loaded' : '✗ MISSING');

const userRoutes         = require('./routes/user');
const { fetchNews }      = require('./scraper');
const { processArticle } = require('./processor');

// ── Agent imports (safe – won't crash if folder missing) ──────────────────
let runOrchestrator = null;
try {
  ({ runOrchestrator } = require('./agents/orchestrator'));
  console.log('[AGENTS] Orchestrator loaded ✓');
} catch (e) {
  console.warn('[AGENTS] Orchestrator not found – running without agents:', e.message);
}

// ── Supabase ───────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// ── Groq ───────────────────────────────────────────────────────────────────
const groq = new Groq({
  apiKey: (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '')
});

const app = express();
app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════════════════════════════════════
//  HEALTH
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/',           (_req, res) => res.send('NewsHub API running.'));

// ══════════════════════════════════════════════════════════════════════════
//  AI CHATBOT
// ══════════════════════════════════════════════════════════════════════════
// ── In-memory conversation store (per session cookie / IP) ──────────────
const convStore = new Map();

function getHistory(id) {
  if (!convStore.has(id)) {
    convStore.set(id, []);
  }
  return convStore.get(id);
}

app.post('/api/ask', async (req, res) => {
  const { question, history: clientHistory } = req.body;
  if (!question?.trim()) return res.status(400).json({ answer: 'No question provided.' });

  // ── Fetch relevant live news as extra context ──────────────────────────
  let newsContext = '';
  try {
    const r = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(question)}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${process.env.NEWSAPI_KEY}`
    );
    const d = await r.json();
    const articles = (d.articles || []).filter(a => a.title && a.title !== '[Removed]');
    if (articles.length > 0) {
      newsContext = articles.map((a, i) =>
        `${i + 1}. ${a.title} (${a.source?.name}, ${new Date(a.publishedAt).toDateString()})\n   ${a.description || ''}`
      ).join('\n\n');
    }
  } catch { /* skip if news fetch fails */ }

  // ── Build conversation messages (multi-turn) ───────────────────────────
  const systemPrompt = `You are NewsHub AI — a smart, friendly, and helpful assistant built into a news platform.

Your personality:
- Explain things simply, like talking to a friend
- Be conversational, warm, and clear — NOT robotic or overly formal
- Use simple English. Avoid jargon unless the user clearly wants technical depth
- Keep responses concise but complete (3-6 sentences for most answers)
- Use bullet points or numbered lists only when listing multiple things
- Add relevant emojis occasionally to make responses feel natural (not excessive)

What you can do:
- Answer ANY question the user asks — news, general knowledge, explanations, opinions, advice, math, coding, etc.
- When relevant, enrich answers with the live news context provided below
- Summarize, explain, or analyze news articles
- Discuss current events, politics, sports, tech, business, health, entertainment
- Explain complex concepts in simple terms (like "explain like I'm 12")
- Have a real conversation — remember context from earlier messages in this chat

Live news context (use this to enrich your answers when relevant):
${newsContext || 'No live news fetched for this query.'}

IMPORTANT: You are NOT limited to only the news above. Use your full knowledge to answer any question. The news is supplementary context, not a restriction.`;

  // Rebuild messages from client-provided history (for multi-turn)
  const messages = [{ role: 'system', content: systemPrompt }];

  if (clientHistory && Array.isArray(clientHistory)) {
    for (const msg of clientHistory.slice(-10)) { // last 10 turns max
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: 'user', content: question });

  try {
    const completion = await groq.chat.completions.create({
      messages,
      model:       'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens:  600,
    });
    const answer = completion.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error('[ASK] Groq error:', err.message);
    res.json({ answer: 'Sorry, I\'m having a moment. Please try again!' });
  }
});

// backward-compat alias
app.post('/api/chat', (req, res, next) => { req.url = '/api/ask'; next(); });

// ══════════════════════════════════════════════════════════════════════════
//  CORE INGEST HELPER
// ══════════════════════════════════════════════════════════════════════════
async function insertArticle(article) {
  const { data: existing } = await supabase
    .from('articles').select('id').eq('url', article.url).maybeSingle();
  if (existing) return null;

  const result = await processArticle(article);
  if (!result) return null;

  const { data: inserted, error } = await supabase
    .from('articles')
    .insert({
      title:             article.title,
      source:            article.source,
      date:              article.date,
      content:           article.content,
      full_text:         article.full_text,
      url:               article.url,
      image_url:         article.image_url,
      category_hint:     article.category_hint,
      raw_json:          JSON.parse(article.raw_json || '{}'),
      summary:           result.summary,
      sentiment_label:   result.sentiment_label,
      sentiment_score:   result.sentiment_score,
      bias_label:        result.bias_label,
      bias_score:        result.bias_score,
      bias_breakdown:    result.bias_breakdown,
      reliability_score: result.reliability_score || 0.5,
      category:          result.category,
      language:          article.language || 'en'
    })
    .select().single();

  if (error) { console.error('[INSERT]', error.message); return null; }

  if (runOrchestrator) {
    setImmediate(() => runOrchestrator(inserted.id, supabase).catch(e =>
      console.error('[ORCHESTRATOR]', e.message)
    ));
  }

  return inserted;
}

// ══════════════════════════════════════════════════════════════════════════
//  INGEST – MANUAL TRIGGER
// ══════════════════════════════════════════════════════════════════════════
app.post('/api/ingest', async (req, res) => {
  console.log('[INGEST] Manual trigger...');
  try {
    const rawArticles = await fetchNews();
    res.json({ message: `Sync started for ${rawArticles.length} articles` });

    (async () => {
      let count = 0;
      for (const article of rawArticles) {
        const ins = await insertArticle(article);
        if (ins) { count++; console.log(`[INGEST] +${count} "${ins.title.substring(0, 50)}"`); }
      }
      console.log(`[INGEST] Done. Added ${count} new articles.`);
    })();
  } catch (err) {
    console.error('[INGEST ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  FORCE REFRESH – wipes DB and re-fetches everything fresh
// ══════════════════════════════════════════════════════════════════════════
app.post('/api/force-refresh', async (req, res) => {
  console.log('[FORCE REFRESH] Wiping all articles and re-syncing...');
  try {
    const { error: delErr } = await supabase.from('articles').delete().neq('id', 0);
    if (delErr) throw delErr;
    console.log('[FORCE REFRESH] Wiped articles table.');

    const rawArticles = await fetchNews();
    res.json({ message: `Force refresh started. Wiped old articles. Syncing ${rawArticles.length} fresh articles.` });

    (async () => {
      let count = 0;
      for (const article of rawArticles) {
        const ins = await insertArticle(article);
        if (ins) count++;
      }
      console.log(`[FORCE REFRESH] Done. Inserted ${count} fresh articles.`);
    })();
  } catch (err) {
    console.error('[FORCE REFRESH ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  GET ARTICLES
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/articles', async (req, res) => {
  const limit    = parseInt(req.query.limit)  || 12;
  const offset   = parseInt(req.query.offset) || 0;
  const category = req.query.category || 'All';

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category !== 'All') query = query.eq('category', category);

  const { data: articles, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ articles, total: count });
});

app.get('/api/articles/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('articles').select('*').eq('id', req.params.id).single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.get('/api/bias-comparison/:id', async (req, res) => {
  const { data: article } = await supabase
    .from('articles').select('*').eq('id', req.params.id).single();
  if (!article) return res.status(404).json({ error: 'Not found' });

  const { data: similar } = await supabase
    .from('articles')
    .select('title,source,bias_label,bias_score,sentiment_label,reliability_score')
    .eq('category', article.category).neq('id', article.id).limit(5);

  res.json({ base_article: article.title, comparisons: similar });
});

// ══════════════════════════════════════════════════════════════════════════
//  NARRATIVE THREADS
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/narratives', async (req, res) => {
  try {
    const { data: threads, error } = await supabase
      .from('narrative_threads')
      .select('id,title,topic_keywords,first_seen,last_seen,summary,alert,article_ids')
      .order('last_seen', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({
      threads: (threads || []).map(t => ({ ...t, article_count: (t.article_ids || []).length }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/narratives/:id', async (req, res) => {
  try {
    const { data: thread, error } = await supabase
      .from('narrative_threads').select('*').eq('id', req.params.id).single();
    if (error || !thread) return res.status(404).json({ error: 'Thread not found' });

    let articles = [];
    if (thread.article_ids?.length) {
      const { data } = await supabase
        .from('articles')
        .select('id,title,source,date,summary,bias_label,bias_score,sentiment_label,image_url,url,language,propaganda_techniques')
        .in('id', thread.article_ids).order('date', { ascending: false });
      articles = data || [];
    }

    const { data: contradictions } = await supabase
      .from('contradictions').select('*').eq('thread_id', thread.id);

    res.json({ thread, articles, contradictions: contradictions || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
//  NARRATIVE GRAPH
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/narrative-graph', async (req, res) => {
  try {
    const [{ data: threads }, { data: articles }, { data: contradictions }] = await Promise.all([
      supabase.from('narrative_threads').select('id,title,article_ids,topic_keywords,last_seen').order('last_seen', { ascending: false }).limit(30),
      supabase.from('articles').select('id,title,source,bias_label,bias_score,sentiment_label,date,category').order('timestamp', { ascending: false }).limit(100),
      supabase.from('contradictions').select('article_id_1,article_id_2,thread_id,claim')
    ]);

    const nodes = [], edges = [];
    const articleSet = new Set((articles || []).map(a => a.id));

    (threads || []).forEach(t => {
      nodes.push({
        id: `thread_${t.id}`, type: 'thread', label: t.title,
        article_count: (t.article_ids || []).length,
        keywords: t.topic_keywords || [], last_seen: t.last_seen
      });
      (t.article_ids || []).forEach(aid => {
        if (articleSet.has(aid))
          edges.push({ source: `article_${aid}`, target: `thread_${t.id}`, type: 'belongs_to' });
      });
    });

    (articles || []).forEach(a => nodes.push({
      id: `article_${a.id}`, type: 'article', label: a.title,
      source: a.source, bias_label: a.bias_label, bias_score: a.bias_score,
      sentiment: a.sentiment_label, date: a.date, category: a.category
    }));

    (contradictions || []).forEach(c => {
      if (articleSet.has(c.article_id_1) && articleSet.has(c.article_id_2))
        edges.push({
          source: `article_${c.article_id_1}`,
          target: `article_${c.article_id_2}`,
          type: 'contradicts',
          label: c.claim?.substring(0, 40)
        });
    });

    res.json({ nodes, edges });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════
//  CROSS-LANGUAGE COMPARE  ← FIXED
//  Old bug: .ilike('%AI%') matched "ICAI", "email", etc.
//  Fix: word-boundary JS filter + AI relevance scoring to drop junk results
// ══════════════════════════════════════════════════════════════════════════

// Normalise all bias labels to Low / Medium / High
function normaliseBias(raw) {
  if (!raw) return 'Low';
  const r = raw.toString().toLowerCase();
  if (r.includes('high')) return 'High';
  if (r.includes('med'))  return 'Medium';
  return 'Low';
}

// Rate-limit-safe Groq call with automatic retry
async function groqWithRetry(messages, maxTokens = 300, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await groq.chat.completions.create({
        messages,
        model:           'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        temperature:     0.1,
        max_tokens:      maxTokens,
      });
      return JSON.parse(res.choices[0].message.content);
    } catch (err) {
      const isRate = err?.status === 429 || (err?.message || '').includes('rate_limit');
      if (isRate && attempt < retries) {
        const match    = (err.message || '').match(/try again in ([\d.]+)s/);
        const waitSecs = match ? Math.ceil(parseFloat(match[1])) + 2 : attempt * 10;
        console.log(`[GROQ] Rate limited. Waiting ${waitSecs}s (attempt ${attempt})...`);
        await new Promise(r => setTimeout(r, waitSecs * 1000));
        continue;
      }
      throw err;
    }
  }
}

// Score articles for relevance — cap at 20 articles to save tokens
async function scoreRelevance(topic, articles) {
  if (!articles.length) return [];
  // Cap at 20 to keep under token limits
  const capped = articles.slice(0, 20);
  const list   = capped.map((a, i) => `${i}. ${a.title}`).join('\n');
  try {
    const result = await groqWithRetry([
      { role: 'system', content: 'News relevance classifier. JSON only.' },
      { role: 'user',   content:
`Rate relevance to "${topic}" 0-100. 0=unrelated, 100=directly about it.
${list}
JSON: {"scores":[{"index":0,"score":85}]}`
      }
    ], 250);  // reduced from 400
    return result.scores || [];
  } catch {
    return capped.map((_, i) => ({ index: i, score: 60 }));
  }
}

app.post('/api/compare-narrative', async (req, res) => {
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic required' });

  try {
    const topicClean = topic.trim();

    // ── Step 1: Broad DB fetch — no language filter, catch ALL languages ──
    // Use %word% wildcard (not word-boundary) so "Tamil Nadu" matches
    // articles stored with either English title or Tamil-tagged content.
    const orConditions = [
      `title.ilike.%${topicClean}%`,
      `summary.ilike.%${topicClean}%`,
      `content.ilike.%${topicClean}%`,
    ];

    const { data: rawArticles, error } = await supabase
      .from('articles')
      .select('id,title,source,language,summary,date,bias_label,bias_score,sentiment_label,content')
      .or(orConditions.join(','))
      .order('date', { ascending: false })
      .limit(120);   // ← increased from 80 so we catch more ta/hi articles

    if (error) throw error;

    // ── Step 2: Soft JS filter — keep if ANY word from topic appears ──────
    // Less strict than word-boundary so short Indian proper nouns (e.g.
    // "Modi", "ISRO", "CSK") match even inside compound sentences.
    const topicWords = topicClean.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const candidates = (rawArticles || []).filter(a => {
      const haystack = ((a.title || '') + ' ' + (a.summary || '') + ' ' + (a.content || '')).toLowerCase();
      return topicWords.some(w => haystack.includes(w));
    });

    if (!candidates.length) {
      return res.json({ topic: topicClean, groups: [], total: 0 });
    }

    // ── Step 3: AI relevance scoring — lower threshold for ta/hi articles ─
    // Hindi/Tamil articles often have less English text so we're more lenient.
    const scores   = await scoreRelevance(topicClean, candidates);
    const scoreMap = new Map(scores.map(s => [s.index, s.score]));

    const relevant = candidates.filter((a, i) => {
      const score     = scoreMap.get(i) ?? 60;
      const threshold = (a.language === 'ta' || a.language === 'hi') ? 30 : 40;
      return score >= threshold;
    });

    // Safety fallback: if everything got filtered, keep top 8
    const finalArticles = relevant.length > 0 ? relevant : candidates.slice(0, 8);

    // ── Step 4: Fetch associated claims ───────────────────────────────────
    const ids = finalArticles.map(a => a.id);
    const { data: claims } = await supabase
      .from('article_claims')
      .select('article_id,claim,confidence')
      .in('article_id', ids);

    const claimMap = {};
    (claims || []).forEach(c => {
      if (!claimMap[c.article_id]) claimMap[c.article_id] = [];
      claimMap[c.article_id].push(c);
    });

    // ── Step 5: Group by language ──────────────────────────────────────────
    // Language priority order for display: en → hi → ta → others
    const LANG_ORDER = ['en', 'hi', 'ta', 'es', 'ar', 'fr', 'de', 'zh'];
    const grouped = {};
    finalArticles.forEach(a => {
      const lang = a.language || 'en';
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push({
        ...a,
        bias_label: normaliseBias(a.bias_label),
        claims:     claimMap[a.id] || [],
      });
    });

    // Sort groups: en first, then hi, then ta, then rest
    const sortedGroups = Object.entries(grouped)
      .sort(([la], [lb]) => {
        const ia = LANG_ORDER.indexOf(la);
        const ib = LANG_ORDER.indexOf(lb);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([language, articles]) => ({ language, articles }));

    console.log(`[COMPARE] "${topicClean}" → ${finalArticles.length} articles across ${sortedGroups.length} language(s): ${sortedGroups.map(g => `${g.language}(${g.articles.length})`).join(', ')}`);

    res.json({
      topic: topicClean,
      total: finalArticles.length,
      groups: sortedGroups,
    });

  } catch (err) {
    console.error('[COMPARE] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  INTERVIEW MODE ROUTES
//  File: backend/routes/interview.js  (see that file for full code)
// ══════════════════════════════════════════════════════════════════════════
const interviewRoutes = require('./routes/interview');
app.use('/api/interview', interviewRoutes);

// ══════════════════════════════════════════════════════════════════════════
//  AI IMAGE GENERATION ROUTES
//  File: backend/routes/images.js
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  NEWSLETTER ROUTES
//  File: backend/routes/newsletter.js  (see that file for full code)
// ══════════════════════════════════════════════════════════════════════════
const newsletterRoutes = require('./routes/newsletter');
app.use('/api/newsletter', newsletterRoutes);
require('./newsletterCron');

// ══════════════════════════════════════════════════════════════════════════
//  VIDEO ROUTES
// ══════════════════════════════════════════════════════════════════════════
const videoRoutes = require('./routes/videos');
app.use('/api/videos', videoRoutes);

// ══════════════════════════════════════════════════════════════════════════
//  USER ROUTES
// ══════════════════════════════════════════════════════════════════════════
app.use('/api/user', userRoutes);

// ══════════════════════════════════════════════════════════════════════════
//  NEW FEATURES ROUTES (Save, Dashboard, FactCheck, Audio, Alerts, Prefs)
// ══════════════════════════════════════════════════════════════════════════
const featureRoutes = require('./routes/features');
app.use('/api/features', featureRoutes);

// ══════════════════════════════════════════════════════════════════════════
//  AUTO SYNC EVERY 15 MIN
// ══════════════════════════════════════════════════════════════════════════
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);


const lawyerRoutes = require('./routes/lawyer');
app.use('/api/lawyer', lawyerRoutes);

setInterval(async () => {
  try {
    const rawArticles = await fetchNews();
    let count = 0;
    for (const article of rawArticles) {
      const ins = await insertArticle(article);
      if (ins) count++;
    }
    if (count > 0) console.log(`[AUTO-SYNC] Added ${count} new articles.`);
    else           console.log('[AUTO-SYNC] No new articles.');
  } catch (err) { console.error('[AUTO-SYNC ERROR]', err.message); }
}, 15 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`\n🚀 NewsHub server running on http://localhost:${PORT}\n`));
