const Groq = require('groq-sdk');
require('dotenv').config();

async function processArticle(article) {
  let GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('[Diagnostic] GROQ_API_KEY is missing!');
    return null;
  }

  // Aggressive Sanitization: Keep only standard printable ASCII
  const sanitizedKey = GROQ_API_KEY.replace(/[^\x21-\x7E]/g, '');

  if (sanitizedKey.length !== GROQ_API_KEY.length) {
    console.log(`[Sanitization] Cleaned ${GROQ_API_KEY.length - sanitizedKey.length} hidden characters from key.`);
  }

  const groq = new Groq({ apiKey: sanitizedKey });

  console.log(`Processing article: ${article.title.substring(0, 50)}...`);

  const prompt = `
    Analyze this news article for deep bias and sentiment. 
    Category Hint: ${article.category_hint || 'General'}

    Provide a "Bias Breakdown" which identifies:
    - Loaded Language: specific words used to evoke emotion.
    - Framing: how the story is positioned.
    - Omitted Perspectives: what might be missing.

    Article Title: ${article.title}
    Article Source: ${article.source}
    Article Content: ${article.content}

    Respond ONLY with a JSON object. The "reliability_score" MUST be a float between 0 and 1.
    {
      "summary": "Factual 150-250 word summary...",
      "sentiment_label": "Positive/Neutral/Neutral",
      "sentiment_score": -1 to 1,
      "bias_label": "Low/Medium/High",
      "bias_score": 0 to 1,
      "bias_breakdown": {
        "loaded_language": ["word1", "word2"],
        "framing": "Description of framing...",
        "omissions": "Potential omissions..."
      },
      "reliability_score": 0.85, 
      "category": "Politics" 
    }
  `;

  try {
    let response;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        console.log(`[Groq SDK] Call attempt ${retries + 1} for: ${article.title.substring(0, 30)}`);

        response = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a neutral news analyst.' },
            { role: 'user', content: prompt }
          ],
          model: 'llama-3.1-8b-instant',
          response_format: { type: 'json_object' }
        });

        break; // Success
      } catch (error) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.log(`[Groq SDK] Rate limit hit. Retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          retries++;
        } else {
          console.error('[Groq SDK Error]', error.message);
          throw error;
        }
      }
    }

    if (!response || !response.choices || !response.choices[0]) return null;

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`Successfully processed: ${article.title.substring(0, 30)}`);
    return result;
  } catch (error) {
    console.error(`Error processing article "${article.title.substring(0, 30)}":`, error.message);
    // Fallback object to ensure article is still saved
    return {
      summary: article.content ? `[Offline/Fallback Summary]: ${article.content.replace(/<[^>]+>/g, '')}` : "[Offline/Fallback]: Summary unavailable. AI analysis skipped due to Groq datacenter security policy (403 Access Denied) blocking the API connection.",
      sentiment_label: "Neutral",
      sentiment_score: 0,
      bias_label: "Neutral",
      bias_score: 0.5,
      bias_breakdown: {
        loaded_language: [],
        framing: "Framing analysis unavailable.",
        omissions: "Omission analysis unavailable."
      },
      reliability_score: 0.5,
      category: article.category_hint || "General"
    };
  }
}

module.exports = { processArticle };
