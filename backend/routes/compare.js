const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Language display names
const LANGUAGE_NAMES = {
  'en': 'English',
  'hi': 'हिन्दी (Hindi)',
  'ta': 'தமிழ் (Tamil)',
  'te': 'తెలుగు (Telugu)',
  'bn': 'বাংলা (Bengali)',
  'mr': 'मराठी (Marathi)',
  'gu': 'ગુજરાતી (Gujarati)',
  'kn': 'ಕನ್ನಡ (Kannada)',
  'ml': 'മലയാളം (Malayalam)',
  'pa': 'ਪੰਜਾਬੀ (Punjabi)',
  'ur': 'اردو (Urdu)',
  'or': 'ଓଡ଼ିଆ (Odia)',
  'as': 'অসমীয়া (Assamese)',
  'de': 'Deutsch (German)',
  'es': 'Español (Spanish)',
  'fr': 'Français (French)'
};

// Flag emojis for languages
const LANGUAGE_FLAGS = {
  'en': '🇬🇧',
  'hi': '🇮🇳',
  'ta': '🇮🇳',
  'te': '🇮🇳',
  'bn': '🇮🇳',
  'mr': '🇮🇳',
  'gu': '🇮🇳',
  'kn': '🇮🇳',
  'ml': '🇮🇳',
  'pa': '🇮🇳',
  'ur': '🇵🇰',
  'or': '🇮🇳',
  'as': '🇮🇳',
  'de': '🇩🇪',
  'es': '🇪🇸',
  'fr': '🇫🇷'
};

// Bias color mapping
const BIAS_COLORS = {
  'Low': '#22d3ee',
  'Medium': '#f59e0b',
  'High': '#ef4444'
};

// ===========================================
// POST /api/compare-narrative
// Compare news across languages
// ===========================================
router.post('/compare-narrative', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic || topic.trim() === '') {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`🔍 Comparing topic: "${topic}" across languages`);

    // Search for articles matching the topic
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        source,
        date,
        published_at,
        summary,
        content,
        bias_label,
        bias_score,
        sentiment_label,
        language,
        category,
        url,
        image_url
      `)
      .or(`title.ilike.%${topic}%,summary.ilike.%${topic}%,content.ilike.%${topic}%`)
      .order('published_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!articles || articles.length === 0) {
      return res.json({
        topic,
        groups: [],
        total: 0
      });
    }

    // Group articles by language
    const groups = {};
    articles.forEach(article => {
      const lang = article.language || 'en';
      if (!groups[lang]) {
        groups[lang] = {
          language: lang,
          articles: []
        };
      }
      
      // Extract key claims from content/summary
      const claims = extractClaims(article);
      
      groups[lang].articles.push({
        id: article.id,
        title: article.title,
        source: article.source || 'Unknown',
        date: article.published_at || article.date || new Date().toISOString(),
        summary: article.summary || '',
        bias_label: article.bias_label || 'Medium',
        sentiment_label: article.sentiment_label || 'Neutral',
        language: lang,
        claims: claims
      });
    });

    // Convert to array and sort by article count (most first)
    const groupsArray = Object.values(groups)
      .map(group => ({
        ...group,
        articles: group.articles.slice(0, 20) // Limit to 20 per language
      }))
      .sort((a, b) => b.articles.length - a.articles.length);

    console.log(`✅ Found ${articles.length} articles across ${groupsArray.length} languages`);

    res.json({
      topic,
      groups: groupsArray,
      total: articles.length
    });

  } catch (err) {
    console.error('❌ Compare error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// GET /api/compare-languages
// Get available languages with article counts
// ===========================================
router.get('/compare-languages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('language, count')
      .not('language', 'is', null)
      .group('language');

    if (error) throw error;

    const languages = (data || [])
      .filter(item => item.language) // Remove null/empty
      .map(item => ({
        code: item.language,
        name: LANGUAGE_NAMES[item.language] || `Language ${item.language}`,
        flag: LANGUAGE_FLAGS[item.language] || '🌐',
        count: item.count
      }))
      .sort((a, b) => b.count - a.count);

    res.json(languages);
  } catch (err) {
    console.error('❌ Languages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to extract claims from article
function extractClaims(article) {
  const claims = [];
  
  // Try to extract from summary
  if (article.summary) {
    const sentences = article.summary
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200);
    
    sentences.slice(0, 3).forEach(sentence => {
      claims.push({
        claim: sentence,
        confidence: 0.8
      });
    });
  }
  
  // If no summary or not enough claims, use title
  if (claims.length === 0 && article.title) {
    claims.push({
      claim: article.title,
      confidence: 0.9
    });
  }
  
  // If still no claims, create a generic one
  if (claims.length === 0) {
    claims.push({
      claim: `News article about ${article.category || 'current events'}`,
      confidence: 0.7
    });
  }
  
  return claims.slice(0, 3);
}

module.exports = router;