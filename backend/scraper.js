const Parser = require('rss-parser');
const parser = new Parser();

const RSS_FEEDS = [
    { url: 'http://feeds.bbci.co.uk/news/rss.xml', category: 'General' },
    { url: 'http://rss.cnn.com/rss/cnn_topstories.rss', category: 'General' },
    { url: 'http://feeds.reuters.com/reuters/topNews', category: 'General' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'General' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'General' }
];

async function fetchNews() {
    console.log('Fetching news via RSS...');
    let allArticles = [];

    for (const feed of RSS_FEEDS) {
        try {
            console.log(`Fetching feed: ${feed.url}`);
            const feedData = await parser.parseURL(feed.url);

            const articles = feedData.items.map(item => ({
                title: item.title,
                source: feedData.title || 'RSS News',
                date: item.pubDate || new Date().toISOString(),
                content: item.contentSnippet || item.content || '',
                full_text: item.content || item.description || '',
                url: item.link,
                image_url: item.enclosure?.url || (item.content?.match(/src="([^"]+)"/)?.[1]) || null,
                category_hint: feed.category,
                raw_json: JSON.stringify(item)
            }));

            allArticles = [...allArticles, ...articles];
        } catch (error) {
            console.error(`Error fetching RSS feed ${feed.url}:`, error.message);
        }
    }

    // Shuffle and limit
    return allArticles.sort(() => Math.random() - 0.5).slice(0, 50);
}

module.exports = { fetchNews };
