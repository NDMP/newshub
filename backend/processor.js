const axios = require('axios');
require('dotenv').config();

async function processArticle(article) {
  let GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error('[Diagnostic] GROQ_API_KEY is missing!');
    return null;
  }

  // Aggressive Sanitization: Keep only standard printable ASCII (alphanumeric and some symbols)
  // This explicitly removes spaces, newlines, and hidden Unicode garbage.
  const sanitizedKey = GROQ_API_KEY.replace(/[^\x21-\x7E]/g, '');

  if (sanitizedKey.length !== GROQ_API_KEY.length) {
    console.log(`[Sanitization] Cleaned ${GROQ_API_KEY.length - sanitizedKey.length} hidden characters from key.`);
  }

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
        console.log(`[Groq Direct] Call attempt ${retries + 1} for: ${article.title.substring(0, 30)}`);
        response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          messages: [
            { role: 'system', content: 'You are a neutral news analyst.' },
            { role: 'user', content: prompt }
          ],
          model: 'llama3-8b-8192',
          response_format: { type: 'json_object' }
        }, {
          headers: {
            'Authorization': 'Bearer ' + sanitizedKey, // Explicit concatenation for robustness
            'Content-Type': 'application/json'
          },
          timeout: 45000
        });
        break;
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.log(`[Groq Direct] Rate limit hit. Retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
          retries++;
        } else {
          console.error('[Groq Direct Error]', {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
          });
          throw error;
        }
      }
    }

    if (!response || !response.data || !response.data.choices) return null;

    const result = JSON.parse(response.data.choices[0].message.content);
    console.log(`Successfully processed: ${article.title.substring(0, 30)}`);
    return result;
  } catch (error) {
    console.error(`Error processing article "${article.title.substring(0, 30)}":`, error.message);
    return null;
  }
}

module.exports = { processArticle };
