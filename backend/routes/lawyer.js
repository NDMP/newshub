// backend/routes/lawyer.js
// ═══════════════════════════════════════════════════════════════
//  "Your News Lawyer" — Personal AI advocate for every article
//  Tells the user exactly how they are being manipulated and
//  what the article is hiding — in plain language.
//
//  Register in server.js:
//    const lawyerRoutes = require('./routes/lawyer');
//    app.use('/api/lawyer', lawyerRoutes);
// ═══════════════════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const Groq     = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const path     = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

// ── In-memory cache — 30 min per article ──────────────────────
const cache    = new Map();
const CACHE_MS = 30 * 60 * 1000;

// ══════════════════════════════════════════════════════════════
//  POST /api/lawyer/analyze
//  body: { article_id }
// ══════════════════════════════════════════════════════════════
router.post('/analyze', async (req, res) => {
  try {
    const { article_id } = req.body;
    if (!article_id) return res.status(400).json({ error: 'article_id required' });

    // Cache check
    const cached = cache.get(article_id);
    if (cached && Date.now() - cached.ts < CACHE_MS) {
      return res.json({ ...cached.data, cached: true });
    }

    // Fetch article from Supabase
    const { data: article, error } = await supabase
      .from('articles')
      .select('id, title, source, content, summary, bias_label, bias_score, sentiment_label, sentiment_score, reliability_score, propaganda_techniques, category, date')
      .eq('id', article_id)
      .single();

    if (error || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const groq = getGroq();

    const propagandaList = Array.isArray(article.propaganda_techniques)
      ? article.propaganda_techniques.map(t => `${t.name} (confidence: ${Math.round((t.confidence || 0) * 100)}%)`).join(', ')
      : 'None detected';

    const biasScore       = Math.round((article.bias_score || 0.5) * 100);
    const reliabilityScore = Math.round((article.reliability_score || 0.5) * 100);
    const articleText     = (article.content || article.summary || '').substring(0, 2000);

    const prompt = `
You are "The News Lawyer" — an AI that fights FOR the reader against news manipulation.
Your job: analyze this article and tell the reader EXACTLY what is being hidden, exaggerated, or engineered to manipulate them.
Be specific, be sharp, be plain-spoken. You are their advocate, not a journalist.

ARTICLE DATA:
Title: ${article.title}
Source: ${article.source}
Category: ${article.category}
Date: ${article.date}
Bias Label: ${article.bias_label} (Score: ${biasScore}%)
Sentiment: ${article.sentiment_label} (Score: ${article.sentiment_score?.toFixed(2)})
Source Reliability: ${reliabilityScore}%
Propaganda Techniques Found: ${propagandaList}

ARTICLE CONTENT:
${articleText}

YOUR TASK — Respond ONLY with this exact JSON structure. Be specific to THIS article, not generic.
Every field must reference actual content from the article above.

{
  "verdict": "<1 sentence plain-English verdict — what is really going on here>",
  "manipulation_score": <0-100, how engineered this article is to manipulate>,
  "who_benefits": [
    "<specific entity/group that benefits from you believing this story>",
    "<second beneficiary>",
    "<third beneficiary if applicable>"
  ],
  "what_they_buried": [
    "<specific fact, number, or perspective this article omitted or buried>",
    "<second buried fact>",
    "<third buried fact>"
  ],
  "real_impact_on_you": "<2 sentences — concrete, personal impact on an ordinary Indian reader that the article never calculated>",
  "question_nobody_is_asking": "<the single most important question this article should have answered but didn't>",
  "emotional_engineering": {
    "primary_emotion": "<the main emotion this article is designed to trigger: fear/anger/pride/anxiety/hope>",
    "technique": "<how they trigger it — specific to this article>",
    "trigger_words": ["<word or phrase from article>", "<word or phrase>", "<word or phrase>"]
  },
  "what_changed_vs_what_stayed": "<what is actually new in this story vs what is recycled outrage or recycled narrative>",
  "trust_verdict": {
    "label": "<TRUSTED / CAUTION / SKEPTICAL / MANIPULATIVE>",
    "reason": "<1 sentence specific reason based on this article>"
  }
}
`;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are The News Lawyer — a sharp, plain-spoken AI advocate for the reader. You analyze news articles to expose manipulation, hidden agendas, and buried facts. Respond only with valid JSON. Be specific to the article provided, never generic.'
        },
        { role: 'user', content: prompt }
      ],
      model:           'llama-3.3-70b-versatile',
      temperature:     0.4,
      max_tokens:      1200,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate and fill missing fields
    const data = {
      verdict:                    result.verdict                    || 'Analysis unavailable.',
      manipulation_score:         result.manipulation_score         || 50,
      who_benefits:               result.who_benefits               || [],
      what_they_buried:           result.what_they_buried           || [],
      real_impact_on_you:         result.real_impact_on_you         || '',
      question_nobody_is_asking:  result.question_nobody_is_asking  || '',
      emotional_engineering:      result.emotional_engineering      || { primary_emotion: 'neutral', technique: '', trigger_words: [] },
      what_changed_vs_what_stayed: result.what_changed_vs_what_stayed || '',
      trust_verdict:              result.trust_verdict              || { label: 'CAUTION', reason: '' },
      article_id,
      source:  article.source,
      analyzed_at: new Date().toISOString(),
    };

    cache.set(article_id, { ts: Date.now(), data });
    console.log(`[NewsLawyer] ✅ Analyzed article ${article_id}: "${article.title.substring(0, 50)}..."`);

    res.json(data);

  } catch (err) {
    console.error('[NewsLawyer] Error:', err.message);
    res.status(500).json({ error: 'Analysis failed. AI is busy — try again in 15 seconds.' });
  }
});

module.exports = router;