/**
 * Propaganda Technique Detection Agent
 * Identifies specific propaganda techniques in article text.
 * Stores results in the propaganda_techniques JSONB column.
 */

const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

const PROPAGANDA_TECHNIQUES = [
  'Emotional Appeal',
  'Loaded Language',
  'Whataboutism',
  'False Dichotomy',
  'Appeal to Authority',
  'Bandwagon',
  'Fear Mongering',
  'Scapegoating',
  'Cherry Picking',
  'Slippery Slope'
];

async function runPropagandaAgent(article, supabase) {
  const groq = getGroq();

  const textToAnalyze = article.full_text || article.content || article.summary || '';
  if (textToAnalyze.length < 50) {
    console.log('[PropagandaAgent] Article too short to analyze.');
    return;
  }

  const prompt = `
You are a media literacy AI specialized in detecting propaganda techniques.

Analyze this news article for the following propaganda techniques:
${PROPAGANDA_TECHNIQUES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

ARTICLE TITLE: ${article.title}
ARTICLE SOURCE: ${article.source}
ARTICLE TEXT: ${textToAnalyze.substring(0, 800)}

For each technique detected (only those clearly present), provide:
- technique name
- confidence score (0.0 to 1.0)
- a brief example from the text (max 20 words)

Respond ONLY with JSON:
{
  "techniques": [
    {
      "name": "<technique name>",
      "confidence": <0.0-1.0>,
      "example": "<brief example from text>"
    }
  ]
}

Only include techniques with confidence >= 0.4. Return empty array if none detected.
`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a precise media literacy analyst. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);

  const { error } = await supabase
    .from('articles')
    .update({ propaganda_techniques: result.techniques || [] })
    .eq('id', article.id);

  if (error) {
    console.error('[PropagandaAgent] Failed to save techniques:', error.message);
  } else {
    console.log(`[PropagandaAgent] Saved ${(result.techniques || []).length} techniques for article ${article.id}`);
  }
}

module.exports = { runPropagandaAgent };
