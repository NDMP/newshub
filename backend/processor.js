const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function processArticle(article) {
  if (!process.env.GROQ_API_KEY) {
    console.error('[Diagnostic] GROQ_API_KEY is missing!');
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
      "sentiment_label": "Positive/Neutral/Negative",
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
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'system', content: 'You are a neutral news analyst.' }, { role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' }
        });
        break;
      } catch (error) {
        if (error.status === 429) {
          console.log(`Rate limit hit. Retrying in 5s... (Attempt ${retries + 1})`);
          await new Promise(r => setTimeout(r, 5000));
          retries++;
        } else {
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
