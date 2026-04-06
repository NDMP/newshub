/**
 * Alert Agent
 * Flags emerging narratives or sudden shifts in coverage.
 * Writes alerts to a narrative_alerts JSONB column in narrative_threads.
 */

const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

async function runAlertAgent(thread, supabase) {
  if (!thread || !thread.article_ids || thread.article_ids.length < 3) return;

  const groq = getGroq();

  // Fetch articles sorted by date for trend analysis
  const { data: articles, error } = await supabase
    .from('articles')
    .select('title, source, date, sentiment_label, sentiment_score, bias_label, bias_score')
    .in('id', thread.article_ids)
    .order('date', { ascending: true })
    .limit(10);

  if (error || !articles || articles.length < 3) return;

  const articlesContext = articles.map(a =>
    `Date: ${a.date} | Source: ${a.source} | Sentiment: ${a.sentiment_label}(${a.sentiment_score?.toFixed(2)}) | Bias: ${a.bias_label}(${a.bias_score?.toFixed(2)}) | "${a.title}"`
  ).join('\n');

  const prompt = `
You are a news trend analyst. Analyze the progression of this narrative thread and identify any significant alerts.

THREAD: "${thread.title}"
ARTICLES OVER TIME:
${articlesContext}

Identify if any of these alerts apply:
1. EMERGING: Narrative is gaining rapid momentum (3+ articles in 24h)
2. SENTIMENT_SHIFT: Significant change in sentiment over time
3. BIAS_ESCALATION: Bias scores increasing across articles
4. COVERAGE_SURGE: Sudden spike in number of sources covering this
5. NONE: No notable alerts

Respond ONLY with JSON:
{
  "alert_type": "<EMERGING|SENTIMENT_SHIFT|BIAS_ESCALATION|COVERAGE_SURGE|NONE>",
  "alert_message": "<brief explanation, max 80 words, or null if NONE>",
  "severity": "<low|medium|high|null>"
}
`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a news trend analyst. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);

  if (result.alert_type && result.alert_type !== 'NONE') {
    const alert = {
      type: result.alert_type,
      message: result.alert_message,
      severity: result.severity,
      triggered_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('narrative_threads')
      .update({ alert })
      .eq('id', thread.id);

    if (updateError) {
      console.error('[AlertAgent] Failed to save alert:', updateError.message);
    } else {
      console.log(`[AlertAgent] Alert triggered for thread "${thread.title}": ${result.alert_type}`);
    }
  } else {
    console.log(`[AlertAgent] No alerts for thread: "${thread.title}"`);
  }
}

module.exports = { runAlertAgent };
