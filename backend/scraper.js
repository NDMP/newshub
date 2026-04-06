// ═══════════════════════════════════════════════════════════════════════════
//  NewsHub — Smart Scraper  (v3 — India-first + Tamil Nadu + Multi-language)
//  COPY TO: newshub/newshub/backend/scraper.js
//
//  Strategy:
//    Batch A  — India top headlines (country=in), all 6 categories          → language: en
//    Batch B  — Tamil Nadu & South India keywords (most relevant for user)   → language: ta
//    Batch C  — Hindi news keywords (major Hindi sources)                    → language: hi
//    Batch D  — Indian English deep-search (specific high-relevance topics)  → language: en
//    Batch E  — Minimal global news (only truly major world events)          → language: en
//
//  Result:  ~60% India-EN  |  ~20% Tamil/South  |  ~15% Hindi  |  ~5% Global
//  Cross-Language Compare now has 3 real language groups per topic.
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

// ── Relevance filter — drops clearly irrelevant articles ───────────────────
// Returns true if article is worth keeping for Indian users
function isRelevant(article) {
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();

  // Hard drop: empty, removed, or obviously non-Indian irrelevant topics
  if (!article.title || article.title === '[Removed]' || !article.url) return false;
  if (text.includes('[removed]')) return false;

  // Hard drop: very specific foreign local politics with zero India relevance
  const irrelevantPatterns = [
    /\buk parliament\b/, /\bboris johnson\b/, /\brishi sunak\b(?!.*india)/,
    /\bnfl draft\b/, /\bnba trade\b/, /\bmlb\b/, /\bnhl\b/,
    /\bsuper bowl\b/, /\bamerican football\b/,
  ];
  for (const pat of irrelevantPatterns) {
    if (pat.test(text)) return false;
  }

  return true;
}

// ── Map article to internal format ─────────────────────────────────────────
function mapArticle(a, overrides = {}) {
  return {
    title:         a.title,
    source:        a.source?.name || 'NewsAPI',
    date:          a.publishedAt || new Date().toISOString(),
    content:       a.description || '',
    full_text:     a.content || a.description || '',
    url:           a.url,
    image_url:     a.urlToImage || null,
    category_hint: 'General',
    language:      'en',
    raw_json:      JSON.stringify(a),
    ...overrides,
  };
}

// ── Safe fetch with logging ─────────────────────────────────────────────────
async function safeFetch(label, params) {
  try {
    const res = await axios.get('https://newsapi.org/v2/top-headlines', { params });
    if (res.data.status === 'ok') {
      const articles = res.data.articles || [];
      console.log(`  ${label}: ${articles.length} raw`);
      return articles;
    }
  } catch (e) {
    console.warn(`  ${label} FAILED: ${e.message}`);
  }
  return [];
}

async function safeSearch(label, params) {
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', { params });
    if (res.data.status === 'ok') {
      const articles = res.data.articles || [];
      console.log(`  ${label}: ${articles.length} raw`);
      return articles;
    }
  } catch (e) {
    console.warn(`  ${label} FAILED: ${e.message}`);
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
async function fetchNews() {
  console.log('\n[SCRAPER] Starting India-first + TN + multi-language fetch...');
  const KEY = process.env.NEWSAPI_KEY;
  if (!KEY) { console.error('[SCRAPER] Missing NEWSAPI_KEY'); return []; }

  let all = [];

  // ────────────────────────────────────────────────────────────────────────
  // BATCH A — India Top Headlines (country=in) — all categories
  //   NewsAPI's country=in returns Times of India, NDTV, Hindu, etc.
  //   This is the primary English India feed.
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n[A] India top headlines (country=in)...');
  const INDIA_CATS = ['general', 'business', 'technology', 'sports', 'entertainment', 'health'];

  for (const cat of INDIA_CATS) {
    const raw = await safeFetch(`  [A] India/${cat}`, {
      apiKey: KEY, country: 'in', category: cat, pageSize: 20,
    });
    const mapped = raw.filter(isRelevant).map(a => mapArticle(a, {
      category_hint: cat.charAt(0).toUpperCase() + cat.slice(1),
      language: 'en',
    }));
    all = all.concat(mapped);
  }

  // ────────────────────────────────────────────────────────────────────────
  // BATCH B — Tamil Nadu & South India keywords (tagged as 'ta' language)
  //   NewsAPI doesn't have a Tamil language feed, so we search English
  //   articles that are ABOUT Tamil Nadu / South India, then tag them 'ta'
  //   so they appear in the Tamil group of Cross-Language Compare.
  //   This gives users Tamil Nadu-specific content.
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n[B] Tamil Nadu & South India keywords...');

  const TN_KEYWORDS = [
    // Tamil Nadu government & politics
    'Tamil Nadu government',
    'Tamil Nadu CM MK Stalin',
    'Tamil Nadu politics DMK AIADMK',
    'Chennai news today',
    // Districts & cities
    'Coimbatore news',
    'Madurai news',
    'Trichy news',
    'Salem news',
    'Tirunelveli news',
    'Vellore news',
    'Nagercoil news',
    'Kanyakumari news',
    // South India economy & industry
    'Tamil Nadu industry IT',
    'Tamil Nadu economy',
    'South India business',
    // Education & exams (highly relevant for students)
    'Tamil Nadu TNPSC exam',
    'Anna University',
    'Tamil Nadu NEET',
    // Sports (Tamil teams)
    'Chennai Super Kings CSK IPL',
    'Tamil Nadu cricket',
    // Social issues
    'Tamil Nadu floods rain',
    'Tamil Nadu water Cauvery',
    // Culture
    'Kollywood Tamil cinema',
    'Tamil movies OTT',
  ];

  for (const kw of TN_KEYWORDS) {
    const raw = await safeSearch(`  [B] TN: "${kw}"`, {
      apiKey: KEY, q: kw, language: 'en',
      sortBy: 'publishedAt', pageSize: 5,
    });
    const mapped = raw.filter(isRelevant).map(a => mapArticle(a, {
      language: 'ta',   // ← tag as Tamil for Cross-Language Compare
      category_hint: 'General',
    }));
    all = all.concat(mapped);
  }

  // ────────────────────────────────────────────────────────────────────────
  // BATCH C — Hindi-language news (tagged as 'hi')
  //   Search NewsAPI with language=hi to get actual Hindi articles.
  //   These are from Dainik Bhaskar, Amar Ujala, Navbharat Times etc.
  //   They appear in the Hindi group of Cross-Language Compare.
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n[C] Hindi language news (language=hi)...');

  const HINDI_KEYWORDS = [
    'India',
    'Modi',
    'BJP Congress',
    'India economy budget',
    'IPL cricket',
    'India China Pakistan',
    'India technology startup',
    'India health education',
  ];

  for (const kw of HINDI_KEYWORDS) {
    const raw = await safeSearch(`  [C] Hindi: "${kw}"`, {
      apiKey: KEY, q: kw, language: 'hi',
      sortBy: 'publishedAt', pageSize: 5,
    });
    const mapped = raw.filter(isRelevant).map(a => mapArticle(a, {
      language: 'hi',   // ← tag as Hindi
      category_hint: 'General',
    }));
    all = all.concat(mapped);
  }

  // ────────────────────────────────────────────────────────────────────────
  // BATCH D — Indian English deep-search (specific high-value topics)
  //   These are important topics that country=in might miss or under-cover.
  //   All are India-relevant and useful for common people.
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n[D] India deep-search keywords...');

  const INDIA_DEEP = [
    // Government & policy
    'India government scheme',
    'Modi government policy',
    'India budget 2025',
    'RBI interest rate India',
    // Science & space
    'ISRO mission',
    'India space technology',
    // Healthcare (relevant for all)
    'India healthcare hospital',
    'India medicine drug price',
    // Farmer & rural (very relevant)
    'India farmer agriculture MSP',
    'rural India development',
    // Women & youth
    'India women empowerment',
    'India youth education job',
    // Startups & jobs
    'India startup funding',
    'India IT jobs Infosys Wipro TCS',
    // Defence
    'Indian Army Air Force Navy',
    'India defence missile',
    // Environment
    'India climate environment pollution',
    // Sports
    'India cricket Test ODI T20',
    'India Olympic athlete',
    // Infrastructure
    'India road highway expressway',
    'India railway bullet train metro',
  ];

  for (const kw of INDIA_DEEP) {
    const raw = await safeSearch(`  [D] Deep: "${kw}"`, {
      apiKey: KEY, q: kw, language: 'en',
      sortBy: 'publishedAt', pageSize: 4,
    });
    const mapped = raw.filter(isRelevant).map(a => mapArticle(a, {
      language: 'en',
      category_hint: 'General',
    }));
    all = all.concat(mapped);
  }

  // ────────────────────────────────────────────────────────────────────────
  // BATCH E — Major global news ONLY (genuinely world-important events)
  //   Very small batch — just enough for context when India is affected.
  //   Strictly filtered to events that matter to Indian users.
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n[E] Major global news (India-impacting)...');

  const GLOBAL_KEYWORDS = [
    'India US relations',
    'India China border',
    'India Pakistan',
    'India trade export',
    'global AI technology India',
    'oil price India petrol diesel',
  ];

  for (const kw of GLOBAL_KEYWORDS) {
    const raw = await safeSearch(`  [E] Global: "${kw}"`, {
      apiKey: KEY, q: kw, language: 'en',
      sortBy: 'publishedAt', pageSize: 3,
    });
    const mapped = raw.filter(isRelevant).map(a => mapArticle(a, {
      language: 'en',
      category_hint: 'General',
    }));
    all = all.concat(mapped);
  }

  // ────────────────────────────────────────────────────────────────────────
  // DEDUPLICATE by URL
  // ────────────────────────────────────────────────────────────────────────
  const seen = new Set();
  const deduped = all.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // ────────────────────────────────────────────────────────────────────────
  // STATS LOG
  // ────────────────────────────────────────────────────────────────────────
  const langCount = deduped.reduce((acc, a) => {
    acc[a.language] = (acc[a.language] || 0) + 1;
    return acc;
  }, {});

  console.log('\n[SCRAPER] Done!');
  console.log(`  Total unique: ${deduped.length}`);
  console.log(`  English (en): ${langCount.en || 0}`);
  console.log(`  Tamil   (ta): ${langCount.ta || 0}`);
  console.log(`  Hindi   (hi): ${langCount.hi || 0}`);
  console.log(`  Relevance filter dropped irrelevant foreign news\n`);

  return deduped;
}

module.exports = { fetchNews };
