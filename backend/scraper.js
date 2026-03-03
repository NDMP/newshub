const axios = require('axios');

async function fetchNews() {
    console.log('Fetching news via NewsAPI...');
    const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
    if (!NEWSAPI_KEY) {
        console.error('Missing NEWSAPI_KEY in .env');
        return [];
    }

    try {
        const categories = ['general', 'business', 'technology', 'sports', 'entertainment', 'health'];
        let allArticles = [];

        for (const cat of categories) {
            console.log(`Fetching ${cat} news...`);
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    apiKey: NEWSAPI_KEY,
                    language: 'en',
                    category: cat,
                    pageSize: 20
                }
            });

            if (response.data.status === 'ok') {
                const mapped = response.data.articles
                    .filter(item => item.title && item.title !== '[Removed]')
                    .map(item => ({
                        title: item.title,
                        source: item.source.name || 'NewsAPI',
                        date: item.publishedAt || new Date().toISOString(),
                        content: item.description || '',
                        full_text: item.content || item.description || '',
                        url: item.url,
                        image_url: item.urlToImage || null,
                        category_hint: cat.charAt(0).toUpperCase() + cat.slice(1),
                        raw_json: JSON.stringify(item)
                    }));
                allArticles = allArticles.concat(mapped);
            }
        }

        console.log(`Fetched ${allArticles.length} total articles across categories.`);
        return allArticles;
    } catch (error) {
        console.error('Error fetching NewsAPI:', error.message);
        return [];
    }
}

module.exports = { fetchNews };
