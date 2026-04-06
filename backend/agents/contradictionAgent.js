/**
 * Contradiction Agent
 * Identifies conflicting claims between articles in the same narrative thread.
 */

const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

async function runContradictionAgent(thread, supabase) {
  if (!thread || !thread.article_ids || thread.article_ids.length < 2) {
    console.log('[ContradictionAgent] Not enough articles in thread to compare.');
    return;
  }

  const groq = getGroq();

  // Fetch articles in this thread
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, source, summary, content, bias_breakdown')
    .in('id', thread.article_ids)
    .limit(8);

  if (error || !articles || articles.length < 2) {
    console.error('[ContradictionAgent] Could not fetch articles:', error?.message);
    return;
  }

  const articlesContext = articles.map(a =>
    `[Article ID: ${a.id}, Source: ${a.source}]\nTitle: ${a.title}\nSummary: ${a.summary || a.content?.substring(0, 200)}`
  ).join('\n\n---\n\n');

  const prompt = `
You are a fact-checking AI. Analyze the following news articles from the same narrative thread and identify contradictions or conflicting claims.

NARRATIVE THREAD: "${thread.title}"

ARTICLES:
${articlesContext}

Find up to 3 significant contradictions where different sources make conflicting factual claims about the same event or topic.

Respond ONLY with JSON:
{
  "contradictions": [
    {
      "claim": "<the disputed claim or topic>",
      "article_id_1": <number>,
      "article_id_2": <number>,
      "explanation": "<brief explanation of the contradiction, max 150 words>"
    }
  ]
}

If there are no contradictions, return: { "contradictions": [] }
`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a precise fact-checking assistant. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);

  if (!result.contradictions || result.contradictions.length === 0) {
    console.log('[ContradictionAgent] No contradictions found in thread:', thread.id);
    return;
  }

  // Check existing contradictions to avoid duplicates
  const { data: existing } = await supabase
    .from('contradictions')
    .select('article_id_1, article_id_2')
    .eq('thread_id', thread.id);

  const existingPairs = new Set(
    (existing || []).map(c => `${Math.min(c.article_id_1, c.article_id_2)}-${Math.max(c.article_id_1, c.article_id_2)}`)
  );

  for (const contradiction of result.contradictions) {
    const pairKey = `${Math.min(contradiction.article_id_1, contradiction.article_id_2)}-${Math.max(contradiction.article_id_1, contradiction.article_id_2)}`;
    if (existingPairs.has(pairKey)) continue;

    const { error: insertError } = await supabase
      .from('contradictions')
      .insert({
        thread_id: thread.id,
        claim: contradiction.claim,
        article_id_1: contradiction.article_id_1,
        article_id_2: contradiction.article_id_2,
        explanation: contradiction.explanation
      });

    if (insertError) {
      console.error('[ContradictionAgent] Insert error:', insertError.message);
    } else {
      console.log(`[ContradictionAgent] Saved contradiction: "${contradiction.claim}"`);
    }
  }
}

module.exports = { runContradictionAgent };
