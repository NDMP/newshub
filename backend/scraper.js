const axios = require('axios');
require('dotenv').config();

const MEDIASTACK_API_KEY = process.env.MEDIASTACK_API_KEY;

async function fetchNews() {
    console.log(`[Diagnostic] MEDIASTACK_API_KEY present: ${!!MEDIASTACK_API_KEY}`);
    const allArticles = [];

    for (const category of CATEGORIES) {
        try {
            console.log(`Fetching category: ${category}...`);
            // Add a small delay to avoid 429 Rate Limits
            await new Promise(r => setTimeout(r, 1000));

            const response = await axios.get('http://api.mediastack.com/v1/news', {
                params: {
                    access_key: MEDIASTACK_API_KEY,
                    categories: category,
                    languages: 'en',
                    limit: 20
                }
            });

            if (response.data && response.data.data) {
                const categoryArticles = response.data.data.map(article => ({
                    title: article.title,
                    source: article.source,
                    date: article.published_at,
                    content: article.description,
                    full_text: article.description,
                    url: article.url,
                    image_url: article.image,
                    category_hint: category.charAt(0).toUpperCase() + category.slice(1),
                    raw_json: JSON.stringify(article)
                }));
                allArticles.push(...categoryArticles);
                console.log(`Fetched ${categoryArticles.length} articles for ${category}`);
            }
        } catch (error) {
            console.error(`Error fetching category ${category} from Mediastack:`, error.message);
        }
    }

    const uniqueArticles = Array.from(new Map(allArticles.map(a => [a.url, a])).values());
    return uniqueArticles;
}

module.exports = { fetchNews };
