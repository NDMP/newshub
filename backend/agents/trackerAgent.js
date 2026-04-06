/**
 * Tracker Agent
 * Groups related articles into narrative threads over time.
 * Uses Groq to determine which thread (if any) an article belongs to,
 * or creates a new thread.
 */

const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function getGroq() {
  const key = (process.env.GROQ_API_KEY || '').replace(/[^\x21-\x7E]/g, '');
  return new Groq({ apiKey: key });
}

async function runTrackerAgent(article, supabase) {
  const groq = getGroq();

  // Fetch recent threads (last 7 days) to check for matches
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existingThreads } = await supabase
    .from('narrative_threads')
    .select('id, title, topic_keywords, summary')
    .gte('last_seen', sevenDaysAgo)
    .order('last_seen', { ascending: false })
    .limit(20);

  const threadsContext = existingThreads && existingThreads.length > 0
    ? existingThreads.map(t => `Thread ID ${t.id}: "${t.title}" | Keywords: ${(t.topic_keywords || []).join(', ')}`).join('\n')
    : 'No existing threads.';

  const prompt = `
You are a news narrative tracker AI. Your job is to determine if a new article belongs to an existing narrative thread or starts a new one.

EXISTING THREADS:
${threadsContext}

NEW ARTICLE:
Title: ${article.title}
Source: ${article.source}
Category: ${article.category || article.category_hint}
Summary: ${article.summary || article.content?.substring(0, 300)}

Instructions:
- If this article clearly relates to an existing thread (same ongoing event/story), return that thread's ID.
- If this is a new story/narrative, return null for thread_id.
- Extract 3-6 topic keywords from the article.
- Generate a short thread title (5-8 words) if creating a new thread.

Respond ONLY with JSON:
{
  "thread_id": <number or null>,
  "is_new_thread": <boolean>,
  "thread_title": "<title if new thread>",
  "topic_keywords": ["keyword1", "keyword2", "keyword3"]
}
`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a precise news narrative tracking assistant. Respond only with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: 'llama-3.1-8b-instant',
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);
  const now = new Date().toISOString();

  if (result.is_new_thread || !result.thread_id) {
    // Create a new narrative thread
    const { data: newThread, error } = await supabase
      .from('narrative_threads')
      .insert({
        title: result.thread_title || article.title.substring(0, 80),
        topic_keywords: result.topic_keywords || [],
        first_seen: article.date || now,
        last_seen: now,
        article_ids: [article.id],
        summary: article.summary || ''
      })
      .select()
      .single();

    if (error) {
      console.error('[TrackerAgent] Failed to create thread:', error.message);
    } else {
      console.log(`[TrackerAgent] Created new thread: "${newThread.title}" (ID: ${newThread.id})`);
    }
  } else {
    // Update existing thread
    const { data: existingThread } = await supabase
      .from('narrative_threads')
      .select('article_ids, topic_keywords')
      .eq('id', result.thread_id)
      .single();

    if (existingThread) {
      const updatedArticleIds = [...new Set([...(existingThread.article_ids || []), article.id])];
      const updatedKeywords = [...new Set([...(existingThread.topic_keywords || []), ...(result.topic_keywords || [])])].slice(0, 10);

      const { error } = await supabase
        .from('narrative_threads')
        .update({
          article_ids: updatedArticleIds,
          topic_keywords: updatedKeywords,
          last_seen: now
        })
        .eq('id', result.thread_id);

      if (error) {
        console.error('[TrackerAgent] Failed to update thread:', error.message);
      } else {
        console.log(`[TrackerAgent] Updated thread ID ${result.thread_id} with article ${article.id}`);
      }
    }
  }
}

module.exports = { runTrackerAgent };
