/**
 * Summarizer Agent
 * Generates a concise rolling summary for each narrative thread.
 */

const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

async function runSummarizerAgent(thread, supabase) {
  if (!thread || !thread.article_ids || thread.article_ids.length === 0) return;

  const groq = getGroq();

  // Fetch articles in thread
  const { data: articles, error } = await supabase
    .from('articles')
    .select('title, source, summary, date')
    .in('id', thread.article_ids)
    .order('date', { ascending: true })
    .limit(10);

  if (error || !articles || articles.length === 0) return;

  const articlesContext = articles.map(a =>
    `[${a.source}] ${a.title}: ${a.summary?.substring(0, 150) || ''}`
  ).join('\n');

  const prompt = `
You are an expert news editor. Write a concise, neutral rolling summary of this ongoing news narrative.

NARRATIVE THREAD: "${thread.title}"
ARTICLES (chronological order):
${articlesContext}

Write a 100-180 word factual summary that:
- Covers the key developments in chronological order
- Identifies the main actors/entities involved
- Remains neutral and objective
- Notes any important shifts or updates

Respond ONLY with JSON:
{
  "summary": "<your summary here>"
}
`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a neutral news editor. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);

  if (result.summary) {
    const { error: updateError } = await supabase
      .from('narrative_threads')
      .update({ summary: result.summary })
      .eq('id', thread.id);

    if (updateError) {
      console.error('[SummarizerAgent] Failed to update thread summary:', updateError.message);
    } else {
      console.log(`[SummarizerAgent] Updated summary for thread: "${thread.title}"`);
    }
  }
}

module.exports = { runSummarizerAgent };
