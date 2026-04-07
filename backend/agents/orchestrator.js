// backend/agents/orchestrator.js
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const { RateLimiter } = require('../utils/rateLimiter');

// Rate limiter for GROQ API (50 requests per minute)
const groqLimiter = new RateLimiter(50);

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting wrapper for GROQ calls
let lastApiCall = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds minimum between calls

async function callWithRateLimit(fn) {
    const now = Date.now();
    const timeSinceLast = now - lastApiCall;
    
    if (timeSinceLast < MIN_API_INTERVAL) {
        console.log(`[RATE LIMIT] Waiting ${(MIN_API_INTERVAL - timeSinceLast)/1000}s before next API call...`);
        await delay(MIN_API_INTERVAL - timeSinceLast);
    }
    
    lastApiCall = Date.now();
    return fn();
}

/**
 * TrackerAgent – groups articles into narrative threads
 */
async function runTrackerAgent(articleId, title, content, category, date) {
    console.log(`[TrackerAgent] Processing article ${articleId}: "${title.substring(0, 50)}..."`);

    // 1. Extract keywords from title
    const words = title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(w => w.length > 3)
        .slice(0, 5);
    
    const keywords = [...new Set(words)]; // remove duplicates
    
    if (keywords.length === 0) {
        console.log(`[TrackerAgent] No significant keywords found`);
        return null;
    }

    // 2. Look for existing threads with similar keywords
    const { data: existingThreads } = await supabase
        .from('narrative_threads')
        .select('*')
        .contains('topic_keywords', keywords)
        .order('last_seen', { ascending: false });

    let threadId = null;

    if (existingThreads && existingThreads.length > 0) {
        // Use the most recent matching thread
        threadId = existingThreads[0].id;
        console.log(`[TrackerAgent] Found existing thread ${threadId} for keywords: ${keywords.join(', ')}`);
        
        // Update thread with new article
        const articleIds = [...new Set([...existingThreads[0].article_ids, articleId])];
        await supabase
            .from('narrative_threads')
            .update({
                article_ids: articleIds,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', threadId);
    } else {
        // Create new thread
        console.log(`[TrackerAgent] Creating new thread for keywords: ${keywords.join(', ')}`);
        
        const { data: newThread, error } = await supabase
            .from('narrative_threads')
            .insert({
                title: `${category}: ${keywords.join(' ')}`,
                topic_keywords: keywords,
                first_seen: date,
                last_seen: date,
                article_ids: [articleId],
                summary: `News about ${keywords.join(', ')}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (!error && newThread) {
            threadId = newThread.id;
        }
    }

    // Update article with thread ID
    if (threadId) {
        await supabase
            .from('articles')
            .update({ thread_id: threadId })
            .eq('id', articleId);
    }

    return threadId;
}

/**
 * PropagandaAgent – detects propaganda techniques in the article
 */
async function runPropagandaAgent(articleId, title, content) {
    console.log(`[PropagandaAgent] Analyzing article ${articleId} for propaganda...`);

    const textToAnalyze = `${title}\n\n${content?.substring(0, 1500) || ''}`;

    try {
        await groqLimiter.waitIfNeeded();
        
        const completion = await callWithRateLimit(() => 
            groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a propaganda detection expert. Analyze the text and identify any propaganda techniques used.
                        Return a JSON array of detected techniques. Each technique should have:
                        - name: the propaganda technique name
                        - confidence: number 0-1
                        - example: a short quote from the text showing the technique
                        
                        Possible techniques: Loaded Language, Name-Calling, Glittering Generalities, Transfer, Testimonial, Plain Folks, Bandwagon, Fear Appeal, Logical Fallacy, Emotional Appeal, etc.
                        
                        If no propaganda detected, return an empty array.`
                    },
                    {
                        role: 'user',
                        content: textToAnalyze
                    }
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        );

        const responseText = completion.choices[0].message.content;
        let techniques = [];
        
        try {
            const parsed = JSON.parse(responseText);
            techniques = parsed.techniques || parsed || [];
            console.log(`[PropagandaAgent] Found ${techniques.length} propaganda techniques`);
        } catch (e) {
            console.error('[PropagandaAgent] Failed to parse response:', e.message);
        }

        // Save to database
        await supabase
            .from('articles')
            .update({ propaganda_techniques: techniques })
            .eq('id', articleId);

        return techniques;

    } catch (error) {
        console.error('[PropagandaAgent] Error:', error.message);
        return [];
    }
}

/**
 * ClaimsAgent – extracts factual claims from the article
 */
async function runClaimsAgent(articleId, title, content) {
    console.log(`[ClaimsAgent] Extracting claims from article ${articleId}...`);

    const textToAnalyze = `${title}\n\n${content?.substring(0, 1500) || ''}`;

    try {
        await groqLimiter.waitIfNeeded();
        
        const completion = await callWithRateLimit(() => 
            groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a fact-checking assistant. Extract factual claims from the text.
                        Return a JSON array of claims. Each claim should have:
                        - claim: the factual statement
                        - confidence: number 0-1 (how confident you are this is a factual claim)
                        - category: "economic", "political", "scientific", "sports", "entertainment", etc.
                        
                        Focus on verifiable facts, not opinions. Return empty array if no clear facts.`
                    },
                    {
                        role: 'user',
                        content: textToAnalyze
                    }
                ],
                model: 'llama-3.1-8b-instant',
                temperature: 0.3,
                response_format: { type: 'json_object' }
            })
        );

        const responseText = completion.choices[0].message.content;
        let claims = [];
        
        try {
            const parsed = JSON.parse(responseText);
            claims = parsed.claims || parsed || [];
            console.log(`[ClaimsAgent] Extracted ${claims.length} claims`);
        } catch (e) {
            console.error('[ClaimsAgent] Failed to parse response:', e.message);
        }

        // Save claims to database
        for (const claim of claims) {
            await supabase
                .from('article_claims')
                .insert({
                    article_id: articleId,
                    claim: claim.claim,
                    confidence: claim.confidence || 0.5,
                    language: 'en'
                });
        }

        return claims;

    } catch (error) {
        console.error('[ClaimsAgent] Error:', error.message);
        return [];
    }
}

/**
 * Main orchestrator – runs all agents for an article
 */
async function runOrchestrator(articleId, supabase) {
    console.log(`[Orchestrator] Starting agents for article ID: ${articleId}`);

    try {
        // Get article data
        const { data: article, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();

        if (error || !article) {
            console.error(`[Orchestrator] Article ${articleId} not found`);
            return;
        }

        console.log(`[Orchestrator] Running TrackerAgent...`);
        const threadId = await runTrackerAgent(
            articleId,
            article.title,
            article.content,
            article.category,
            article.date
        );

        // Add delay between agents
        await delay(3000);

        console.log(`[Orchestrator] Running PropagandaAgent...`);
        const propaganda = await runPropagandaAgent(
            articleId,
            article.title,
            article.content
        );

        await delay(3000);

        console.log(`[Orchestrator] Running ClaimsAgent...`);
        const claims = await runClaimsAgent(
            articleId,
            article.title,
            article.content
        );

        console.log(`[Orchestrator] All agents completed for article ID: ${articleId}`);

        return {
            threadId,
            propagandaCount: propaganda?.length || 0,
            claimsCount: claims?.length || 0
        };

    } catch (error) {
        console.error(`[Orchestrator] Error for article ${articleId}:`, error.message);
    }
}

module.exports = { runOrchestrator };