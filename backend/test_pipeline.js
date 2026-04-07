const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
const { fetchNews } = require('./scraper');

const supabaseUrl = process.env.SUPABASE_URL_URL;
const supabaseKey = process.env.SUPABASE_URL_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        console.log('Testing news fetch...');
        const articles = await fetchNews();
        if (articles.length === 0) {
            console.log('No articles fetched.');
            return;
        }
        const article = articles[0];
        console.log('Attempting to insert article:', article.title);

        // Map article to schema
        const toInsert = {
            title: article.title,
            source: article.source,
            date: article.date,
            content: article.content,
            full_text: article.full_text,
            url: article.url,
            image_url: article.image_url,
            category_hint: article.category_hint,
            raw_json: JSON.parse(article.raw_json),
            summary: "Test Summary",
            sentiment_label: "Neutral",
            sentiment_score: 0,
            bias_label: "Neutral",
            bias_score: 0.5,
            bias_breakdown: {},
            reliability_score: 0.5,
            category: "General"
        };

        const { data, error } = await supabase.from('articles').insert(toInsert);
        if (error) {
            console.error('Insert Error:', error);
        } else {
            console.log('Insert Success:', data);
        }
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

test();
