const Groq = require('groq-sdk');
require('dotenv').config();

async function processArticle(article) {
  let GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('[Diagnostic] GROQ_API_KEY is missing!');
    return null;
  }
  GROQ_API_KEY = GROQ_API_KEY.trim(); // Handle accidental spaces

  const groq = new Groq({ apiKey: GROQ_API_KEY });
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
    let chatCompletion;
    let retries = 0;
    const maxRetries = 2;

    while (retries < maxRetries) {
      try {
        console.log(`[Groq] Call attempt ${retries + 1} for: ${article.title.substring(0, 30)}`);
        chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'system', content: 'You are a neutral news analyst.' }, { role: 'user', content: prompt }],
          model: 'llama3-8b-8192', // Using 8b for faster response and better stability on free tier
          response_format: { type: 'json_object' }
        });
        break;
      } catch (error) {
        if (error.status === 429) {
          console.log(`[Groq] Rate limit hit. Retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          retries++;
        } else {
          console.error('[Groq SDK Error]', {
            name: error.name,
            status: error.status,
            message: error.message,
            code: error.code,
            type: error.type
          });
          throw error;
        }
      }
    }

    if (!chatCompletion) return null;

    const result = JSON.parse(chatCompletion.choices[0].message.content);
    console.log(`Successfully processed: ${article.title.substring(0, 30)}`);
    return result;
  } catch (error) {
    console.error(`Error processing article "${article.title.substring(0, 30)}":`, error.message);
    return null;
  }
}

module.exports = { processArticle };
