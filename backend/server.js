const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load from process.env or local .env
const db = require('./db');
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
        return res.status(500).json({ error: 'AI Key missing on server' });
    }

    // Aggressive Sanitization: ASCII only
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
            model: 'llama3-70b-8192', // Using 70b here as it's a single request, usually more stable than 3.3-70b
        });
        res.json({ answer: chatCompletion.choices[0].message.content });
    } catch (error) {
        console.error('[Chatbot Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Ingest articles
app.post('/api/ingest', async (req, res) => {
    console.log('Manual ingestion triggered...');

    try {
        const rawArticles = await fetchNews();
        console.log(`Found ${rawArticles.length} articles from Mediastack.`);

        // Respond immediately with success message
        res.json({ message: `Sync started for ${rawArticles.length} articles. Feed will update in background.` });

        // Run processing in background
        (async () => {
            let count = 0;
            for (const article of rawArticles.slice(0, 30)) {
                try {
                    const existing = db.prepare('SELECT id FROM articles WHERE url = ?').get(article.url);
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

                    db.prepare(`
                        INSERT INTO articles (
                            title, source, date, content, full_text, url, image_url, category_hint, raw_json, 
                            summary, sentiment_label, sentiment_score, 
                            bias_label, bias_score, bias_breakdown, reliability_score, category
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        article.title, article.source, article.date, article.content, article.full_text, article.url, article.image_url, article.category_hint, article.raw_json,
                        results.summary, results.sentiment_label, results.sentiment_score,
                        results.bias_label, results.bias_score, JSON.stringify(results.bias_breakdown), results.reliability_score || 0.5, results.category
                    );
                    count++;
                    if (count % 5 === 0) console.log(`[Sync] Progress: ${count} articles finished.`);
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

// Auth Endpoints (Simple)
app.post('/api/signup', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth] Signup attempt for: ${email}`);
    try {
        const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        const result = stmt.run(email, password);
        console.log(`[Auth] Signup successful: ${email}`);
        res.json({ id: result.lastInsertRowid, email });
    } catch (err) {
        console.error(`[Auth] Signup failed for ${email}:`, err.message);
        res.status(400).json({ error: 'User already exists' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth] Login attempt for: ${email}`);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?').get(email, password);
    if (user) {
        console.log(`[Auth] Login successful: ${email}`);
        res.json({ id: user.id, email: user.email });
    } else {
        console.warn(`[Auth] Login failed (401) for: ${email}`);
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/articles/:id', (req, res) => {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
});

// Get articles with Pagination
app.get('/api/articles', (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const offset = parseInt(req.query.offset) || 0;
    const category = req.query.category || 'All';

    let query = 'SELECT * FROM articles';
    let params = [];

    if (category !== 'All') {
        query += ' WHERE category = ?';
        params.push(category);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const articles = db.prepare(query).all(...params);

    // Also get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM articles';
    let countParams = [];
    if (category !== 'All') {
        countQuery += ' WHERE category = ?';
        countParams.push(category);
    }
    const total = db.prepare(countQuery).get(...countParams).total;

    res.json({ articles, total });
});

// Background Auto-Sync every 15 minutes
setInterval(async () => {
    console.log('Running background news sync...');
    try {
        const rawArticles = await fetchNews();
        let count = 0;
        for (const article of rawArticles.slice(0, 50)) {
            const existing = db.prepare('SELECT id FROM articles WHERE url = ?').get(article.url);
            if (existing) continue;

            const results = await processArticle(article);
            if (!results) continue;

            db.prepare(`
        INSERT INTO articles (
          title, source, date, content, full_text, url, image_url, category_hint, raw_json, 
          summary, sentiment_label, sentiment_score, 
          bias_label, bias_score, bias_breakdown, reliability_score, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                article.title, article.source, article.date, article.content, article.full_text, article.url, article.image_url, article.category_hint, article.raw_json,
                results.summary, results.sentiment_label, results.sentiment_score,
                results.bias_label, results.bias_score, JSON.stringify(results.bias_breakdown), results.reliability_score || 0.5, results.category
            );
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
