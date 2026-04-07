const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const parser = new Parser();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_URL_ANON_KEY
);

// Language-specific RSS feeds
const INTERNATIONAL_FEEDS = {
  // Hindi News
  hi: [
    { url: 'https://aajtak.intoday.in/rssfeed.xml', source: 'Aaj Tak' },
    { url: 'https://khabar.ndtv.com/rss', source: 'NDTV India' },
    { url: 'https://www.bbc.com/hindi/index.xml', source: 'BBC Hindi' },
    { url: 'https://www.jagran.com/rss', source: 'Dainik Jagran' },
    { url: 'https://navbharattimes.indiatimes.com/rss', source: 'Navbharat Times' }
  ],
  
  // Tamil News
  ta: [
    { url: 'https://www.dinamalar.com/rss.aspx', source: 'Dinamalar' },
    { url: 'https://tamil.thehindu.com/?service=rss', source: 'The Hindu Tamil' },
    { url: 'https://www.dinathanthi.com/rss', source: 'Dinathanthi' },
    { url: 'https://www.vikatan.com/rss', source: 'Vikatan' }
  ],
  
  // Telugu News
  te: [
    { url: 'https://www.eenadu.net/rss', source: 'Eenadu' },
    { url: 'https://www.sakshi.com/rss', source: 'Sakshi' },
    { url: 'https://www.andhrajyothy.com/rss', source: 'Andhra Jyothy' }
  ],
  
  // Bengali News
  bn: [
    { url: 'https://www.anandabazar.com/rss', source: 'Anandabazar Patrika' },
    { url: 'https://www.bartamanpatrika.com/rss', source: 'Bartaman' },
    { url: 'https://eisamay.indiatimes.com/rss', source: 'Ei Samay' }
  ],
  
  // Marathi News
  mr: [
    { url: 'https://www.lokmat.com/rss', source: 'Lokmat' },
    { url: 'https://maharashtratimes.com/rss', source: 'Maharashtra Times' },
    { url: 'https://www.saamana.com/rss', source: 'Saamana' }
  ],
  
  // German News
  de: [
    { url: 'https://www.spiegel.de/international/index.rss', source: 'Der Spiegel' },
    { url: 'https://www.welt.de/feeds/latest.rss', source: 'Die Welt' },
    { url: 'https://www.faz.net/rss/aktuell', source: 'FAZ' },
    { url: 'https://www.zeit.de/index.rss', source: 'Die Zeit' }
  ],
  
  // French News
  fr: [
    { url: 'https://www.lemonde.fr/rss/une.xml', source: 'Le Monde' },
    { url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml', source: 'Le Figaro' },
    { url: 'https://www.france24.com/fr/rss', source: 'France 24' },
    { url: 'https://www.leparisien.fr/rss', source: 'Le Parisien' }
  ],
  
  // Spanish News
  es: [
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', source: 'El País' },
    { url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', source: 'El Mundo' },
    { url: 'https://www.lavanguardia.com/rss', source: 'La Vanguardia' },
    { url: 'https://feeds.abc.es/abc-espana', source: 'ABC España' }
  ]
};

async function fetchInternationalFeeds() {
  console.log('🌍 Fetching international news feeds...');
  
  for (const [language, feeds] of Object.entries(INTERNATIONAL_FEEDS)) {
    console.log(`\n📰 Fetching ${language} feeds...`);
    
    for (const feed of feeds) {
      try {
        console.log(`  → ${feed.source}...`);
        
        const response = await fetch(feed.url, {
          headers: { 'User-Agent': 'NewsHub/1.0' }
        });
        
        if (!response.ok) {
          console.log(`  ❌ Failed: ${response.status}`);
          continue;
        }
        
        const xml = await response.text();
        const parsed = await parser.parseString(xml);
        
        console.log(`  ✅ Found ${parsed.items.length} articles`);
        
        // Process each article
        for (const item of parsed.items.slice(0, 20)) { // Limit to 20 per feed
          const article = {
            title: item.title || '',
            source: feed.source,
            content: item.content || item['content:encoded'] || item.description || '',
            summary: item.contentSnippet || item.description || '',
            url: item.link || '',
            image_url: extractImage(item),
            published_at: item.isoDate || item.pubDate || new Date().toISOString(),
            language: language,
            category: detectCategory(item.categories || []),
            created_at: new Date().toISOString()
          };
          
          // Check if article already exists
          const { data: existing } = await supabase
            .from('articles')
            .select('id')
            .eq('url', article.url)
            .maybeSingle();
          
          if (!existing) {
            const { error } = await supabase
              .from('articles')
              .insert([article]);
              
            if (error) {
              console.error(`    ❌ Error saving: ${error.message}`);
            } else {
              console.log(`    ✅ Saved: ${article.title.substring(0, 50)}...`);
            }
          }
        }
        
        // Wait a bit between feeds to be polite
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (err) {
        console.error(`  ❌ Error with ${feed.source}:`, err.message);
      }
    }
  }
  
  console.log('\n✅ International feed fetching complete!');
}

function extractImage(item) {
  // Try to extract image from various places
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item['media:content'] && item['media:content'].url) return item['media:content'].url;
  
  // Try to find image in content
  const content = item.content || item.description || '';
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) return imgMatch[1];
  
  return null;
}

function detectCategory(categories) {
  const categoryMap = {
    'politics': 'Politics',
    'business': 'Business',
    'economy': 'Business',
    'tech': 'Technology',
    'technology': 'Technology',
    'sports': 'Sports',
    'cricket': 'Sports',
    'football': 'Sports',
    'health': 'Health',
    'science': 'Science',
    'entertainment': 'Entertainment',
    'bollywood': 'Entertainment',
    'world': 'World',
    'international': 'World',
    'india': 'India'
  };
  
  for (const cat of categories) {
    const lower = cat.toLowerCase();
    for (const [key, value] of Object.entries(categoryMap)) {
      if (lower.includes(key)) return value;
    }
  }
  
  return 'General';
}

// Run if called directly
if (require.main === module) {
  fetchInternationalFeeds()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { fetchInternationalFeeds };