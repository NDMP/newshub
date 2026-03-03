const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { fetchNews } = require('./scraper');
const { processArticle } = require('./processor');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NewsHub API is running.' });
});

app.get('/', (req, res) => {
    res.send('NewsHub API is running.');
});

// AI Chatbot endpoint
app.post('/api/ask', async (req, res) => {
    const { question, articleContext } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return res.json({ answer: 'AI Key missing on server. Please check your .env file.' });
    }

    const sanitizedKey = GROQ_API_KEY.replace(/[^\x21-\x7E]/g, '');
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: sanitizedKey });

    const prompt = `
    Context: ${articleContext || 'General global news'}
    Question: ${question}
    
    Respond as an unbiased, highly intelligent news assistant. Keep it concise but insightful.
  `;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
        });
        res.json({ answer: chatCompletion.choices[0].message.content });
    } catch (error) {
        console.error('[Chatbot Error]', error.message);
        if (error.status === 403 || (error.message && error.message.includes('403'))) {
            res.json({ answer: "My connection to the Groq AI network is currently blocked by datacenter security policies (403 Access Denied). Groq restricts free-tier access from certain cloud regions and IPs. I'm currently stuck offline!" });
        } else {
            res.json({ answer: `I encountered an AI API Error: ${error.message}` });
        }
    }
});

// Ingest articles
app.post('/api/ingest', async (req, res) => {
    console.log('Manual ingestion triggered...');

    try {
        const rawArticles = await fetchNews();
        console.log(`Found ${rawArticles.length} articles from NewsAPI.`);

        res.json({ message: `Sync started for ${rawArticles.length} articles. Feed will update in background.` });

        (async () => {
            let count = 0;
            for (const article of rawArticles) {
                try {
                    const { data: existing } = await supabase
                        .from('articles')
                        .select('id')
                        .eq('url', article.url)
                        .single();

                    if (existing) {
                        console.log(`[Sync] Skipping existing: ${article.title.substring(0, 30)}`);
                        continue;
                    }

                    console.log(`[Sync] Processing with AI: ${article.title.substring(0, 30)}`);
                    const results = await processArticle(article);
                    if (!results) {
                        console.warn(`[Sync] AI Processing skipped for: ${article.title.substring(0, 30)}`);
                        continue;
                    }

                    const { error: insertError } = await supabase
                        .from('articles')
                        .insert({
                            title: article.title,
                            source: article.source,
                            date: article.date,
                            content: article.content,
                            full_text: article.full_text,
                            url: article.url,
                            image_url: article.image_url,
                            category_hint: article.category_hint,
                            raw_json: JSON.parse(article.raw_json),
                            summary: results.summary,
                            sentiment_label: results.sentiment_label,
                            sentiment_score: results.sentiment_score,
                            bias_label: results.bias_label,
                            bias_score: results.bias_score,
                            bias_breakdown: results.bias_breakdown,
                            reliability_score: results.reliability_score || 0.5,
                            category: results.category
                        });

                    if (insertError) {
                        console.error('[Sync] Insert error:', insertError.message);
                    } else {
                        count++;
                        if (count % 5 === 0) console.log(`[Sync] Progress: ${count} articles finished.`);
                    }
                } catch (innerError) {
                    console.error(`[Sync Loop Error]`, innerError.message);
                }
            }
            console.log(`Background sync finished. Added ${count} articles.`);
        })();

    } catch (error) {
        console.error('Ingestion error:', error.message);
        res.status(500).json({ error: 'Failed to start ingestion' });
    }
});

// Auth Endpoints handled by Supabase on frontend

app.get('/api/articles/:id', async (req, res) => {
    const { data: article, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', req.params.id)
        .single();

    if (error || !article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
});

// Get articles with Pagination
app.get('/api/articles', async (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const offset = parseInt(req.query.offset) || 0;
    const category = req.query.category || 'All';

    let query = supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

    if (category !== 'All') {
        query = query.eq('category', category);
    }

    const { data: articles, count, error } = await query;

    if (error) {
        console.error('Fetch articles error:', error.message);
        return res.status(500).json({ error: error.message });
    }

    res.json({ articles, total: count });
});

// Background Auto-Sync every 15 minutes
setInterval(async () => {
    console.log('Running background news sync...');
    try {
        const rawArticles = await fetchNews();
        let count = 0;
        for (const article of rawArticles) {
            const { data: existing } = await supabase
                .from('articles')
                .select('id')
                .eq('url', article.url)
                .single();

            if (existing) continue;

            const results = await processArticle(article);
            if (!results) continue;

            await supabase
                .from('articles')
                .insert({
                    title: article.title,
                    source: article.source,
                    date: article.date,
                    content: article.content,
                    full_text: article.full_text,
                    url: article.url,
                    image_url: article.image_url,
                    category_hint: article.category_hint,
                    raw_json: JSON.parse(article.raw_json),
                    summary: results.summary,
                    sentiment_label: results.sentiment_label,
                    sentiment_score: results.sentiment_score,
                    bias_label: results.bias_label,
                    bias_score: results.bias_score,
                    bias_breakdown: results.bias_breakdown,
                    reliability_score: results.reliability_score || 0.5,
                    category: results.category
                });
            count++;
        }
        console.log(`Auto-sync completed. Ingested ${count} articles.`);
    } catch (err) {
        console.error('Auto-sync error:', err.message);
    }
}, 15 * 60 * 1000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
