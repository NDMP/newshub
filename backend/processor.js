const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Groq = require('groq-sdk');

async function processArticle(article) {
  const rawKey = process.env.GROQ_API_KEY || '';
  if (!rawKey) {
    console.error('[processor] GROQ_API_KEY missing!');
    return fallback(article);
  }

  const apiKey = rawKey.replace(/[^\x21-\x7E]/g, '');
  const groq   = new Groq({ apiKey });

  const prompt = `
Analyze this news article for bias and sentiment.
Category: ${article.category_hint || 'General'}

Article Title:   ${article.title}
Article Source:  ${article.source}
Article Content: ${(article.content || '').substring(0, 600)}

Respond ONLY with valid JSON:
{
  "summary":         "100-200 word factual summary",
  "sentiment_label": "Positive|Neutral|Negative",
  "sentiment_score": <number -1 to 1>,
  "bias_label":      "Low|Medium|High",
  "bias_score":      <number 0 to 1>,
  "bias_breakdown":  {
    "loaded_language": ["word1"],
    "framing":         "framing description",
    "omissions":       "omissions description"
  },
  "reliability_score": <number 0 to 1>,
  "category":          "Politics|Business|Technology|Sports|Health|Entertainment|General"
}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a neutral news analyst. Respond only with valid JSON.' },
          { role: 'user',   content: prompt }
        ],
        model:           'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        temperature:     0.2
      });

      const text = response?.choices?.[0]?.message?.content;
      if (!text) return fallback(article);

      const result = JSON.parse(text);
      console.log(`[processor] ✓ ${article.title.substring(0, 50)}`);
      return result;

    } catch (err) {
      if (err.status === 429) {
        console.log(`[processor] Rate limited. Waiting 8s... (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, 8000));
      } else {
        console.error(`[processor] Groq error: ${err.message}`);
        return fallback(article);
      }
    }
  }
  return fallback(article);
}

function fallback(article) {
  return {
    summary:           `${article.content || article.title}`.substring(0, 300),
    sentiment_label:   'Neutral',
    sentiment_score:   0,
    bias_label:        'Neutral',
    bias_score:        0.5,
    bias_breakdown:    { loaded_language: [], framing: 'N/A', omissions: 'N/A' },
    reliability_score: 0.5,
    category:          article.category_hint || 'General'
  };
}

module.exports = { processArticle };
