// backend/routes/user.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// ROBUST SUPABASE INITIALIZATION
// ==========================================
let supabase;
try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.warn('[USER] ⚠️ Supabase credentials missing - user features limited');
        // Create a dummy client that won't crash
        supabase = {
            from: () => ({
                select: () => Promise.resolve({ data: null, error: null }),
                insert: () => Promise.resolve({ data: null, error: null }),
                update: () => Promise.resolve({ data: null, error: null }),
                delete: () => Promise.resolve({ data: null, error: null }),
                eq: () => ({ 
                    select: () => Promise.resolve({ data: null, error: null }),
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                order: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }),
                range: () => Promise.resolve({ data: null, error: null }),
                textSearch: () => Promise.resolve({ data: null, error: null }),
                not: () => ({ select: () => Promise.resolve({ data: null, error: null }) }),
                in: () => ({ select: () => Promise.resolve({ data: null, error: null }) })
            })
        };
    } else {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[USER] ✅ Supabase connected');
    }
} catch (error) {
    console.error('[USER] ❌ Supabase init error:', error.message);
    // Fallback dummy client
    supabase = {
        from: () => ({
            select: () => Promise.resolve({ data: null, error: null }),
            insert: () => Promise.resolve({ data: null, error: null }),
            update: () => Promise.resolve({ data: null, error: null }),
            delete: () => Promise.resolve({ data: null, error: null }),
            eq: () => ({ 
                select: () => Promise.resolve({ data: null, error: null }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            order: () => ({ limit: () => Promise.resolve({ data: null, error: null }) }),
            range: () => Promise.resolve({ data: null, error: null }),
            textSearch: () => Promise.resolve({ data: null, error: null }),
            not: () => ({ select: () => Promise.resolve({ data: null, error: null }) }),
            in: () => ({ select: () => Promise.resolve({ data: null, error: null }) })
        })
    };
}

// ==========================================
// FEATURE 1: Personalized Feed
// ==========================================

// Save user interests
router.post('/interests', async (req, res) => {
    try {
        const { userId, categories, sources, topics } = req.body;
        
        const { data, error } = await supabase
            .from('user_interests')
            .upsert({
                user_id: userId,
                categories: categories || [],
                preferred_sources: sources || [],
                followed_topics: topics || [],
                updated_at: new Date()
            })
            .select();
            
        if (error) throw error;
        res.json({ success: true, interests: data?.[0] || null });
    } catch (error) {
        console.error('[USER] Interests error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get personalized feed
router.post('/feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 0, limit = 12 } = req.body;
        
        // Get user interests
        const { data: interests } = await supabase
            .from('user_interests')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        // Get reading history
        const { data: history } = await supabase
            .from('reading_history')
            .select('article_id')
            .eq('user_id', userId)
            .order('read_at', { ascending: false })
            .limit(20);
            
        const readArticleIds = history?.map(h => h.article_id) || [];
        
        // Build query
        let query = supabase
            .from('articles')
            .select('*', { count: 'exact' });
            
        if (interests?.categories?.length) {
            query = query.in('category', interests.categories);
        }
        
        if (readArticleIds.length > 0) {
            query = query.not('id', 'in', `(${readArticleIds.join(',')})`);
        }
        
        const { data, count, error } = await query
            .order('timestamp', { ascending: false })
            .range(page * limit, (page + 1) * limit - 1);
            
        if (error) throw error;
            
        res.json({
            articles: data || [],
            total: count || 0,
            personalized: true,
            basedOn: interests?.categories || ['General']
        });
    } catch (error) {
        console.error('[USER] Feed error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Track reading
router.post('/track-read', async (req, res) => {
    try {
        const { userId, articleId, duration, completed } = req.body;
        
        await supabase
            .from('reading_history')
            .insert({
                user_id: userId,
                article_id: articleId,
                read_duration: duration || 0,
                completed: completed || false,
                read_at: new Date()
            });
            
        // Increment view count
        await supabase
            .from('articles')
            .update({ view_count: supabase.raw('COALESCE(view_count, 0) + 1') })
            .eq('id', articleId);
            
        res.json({ success: true });
    } catch (error) {
        console.error('[USER] Track read error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// FEATURE 2: Save/Bookmark Articles
// ==========================================

// Save article
router.post('/save', async (req, res) => {
    try {
        const { userId, articleId, tags, notes } = req.body;
        
        const { data, error } = await supabase
            .from('saved_articles')
            .upsert({
                user_id: userId,
                article_id: articleId,
                tags: tags || [],
                notes: notes || '',
                saved_at: new Date()
            })
            .select();
            
        if (error) throw error;
        
        // Increment save count
        await supabase
            .from('articles')
            .update({ save_count: supabase.raw('COALESCE(save_count, 0) + 1') })
            .eq('id', articleId);
            
        res.json({ success: true, saved: data?.[0] || null });
    } catch (error) {
        console.error('[USER] Save error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get saved articles
router.get('/saved/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 0, limit = 20 } = req.query;
        
        const { data, count, error } = await supabase
            .from('saved_articles')
            .select(`
                *,
                article:articles(*)
            `, { count: 'exact' })
            .eq('user_id', userId)
            .order('saved_at', { ascending: false })
            .range(parseInt(page) * parseInt(limit), (parseInt(page) + 1) * parseInt(limit) - 1);
            
        if (error) throw error;
            
        res.json({
            saved: data || [],
            total: count || 0
        });
    } catch (error) {
        console.error('[USER] Get saved error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Remove saved article
router.delete('/save/:userId/:articleId', async (req, res) => {
    try {
        const { userId, articleId } = req.params;
        
        await supabase
            .from('saved_articles')
            .delete()
            .eq('user_id', userId)
            .eq('article_id', articleId);
            
        res.json({ success: true });
    } catch (error) {
        console.error('[USER] Delete saved error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Create collection
router.post('/collection', async (req, res) => {
    try {
        const { userId, name, description } = req.body;
        
        const { data, error } = await supabase
            .from('collections')
            .insert({
                user_id: userId,
                name,
                description: description || ''
            })
            .select();
            
        if (error) throw error;
        res.json({ success: true, collection: data?.[0] || null });
    } catch (error) {
        console.error('[USER] Create collection error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get collections
router.get('/collections/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', userId);
            
        if (error) throw error;
        
        // Get count for each collection
        const collectionsWithCount = await Promise.all(
            (data || []).map(async (collection) => {
                const { count } = await supabase
                    .from('collection_articles')
                    .select('*', { count: 'exact', head: true })
                    .eq('collection_id', collection.id);
                    
                return {
                    ...collection,
                    count: count || 0
                };
            })
        );
            
        res.json({ collections: collectionsWithCount });
    } catch (error) {
        console.error('[USER] Get collections error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Add to collection
router.post('/collection/add', async (req, res) => {
    try {
        const { collectionId, articleId } = req.body;
        
        await supabase
            .from('collection_articles')
            .insert({
                collection_id: collectionId,
                article_id: articleId
            });
            
        res.json({ success: true });
    } catch (error) {
        console.error('[USER] Add to collection error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// FEATURE 3: Trending/Popular
// ==========================================

// Get trending articles
router.get('/trending', async (req, res) => {
    try {
        const { period = 'day', category } = req.query;
        
        let timeFilter;
        const now = new Date();
        
        if (period === 'hour') {
            timeFilter = new Date(now - 60 * 60 * 1000);
        } else if (period === 'day') {
            timeFilter = new Date(now - 24 * 60 * 60 * 1000);
        } else {
            timeFilter = new Date(now - 7 * 24 * 60 * 60 * 1000);
        }
        
        let query = supabase
            .from('articles')
            .select('*')
            .gte('timestamp', timeFilter.toISOString())
            .order('view_count', { ascending: false })
            .limit(10);
            
        if (category && category !== 'All') {
            query = query.eq('category', category);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Calculate trending score
        const trending = (data || []).map(article => ({
            ...article,
            trending_score: calculateTrendingScore(article)
        }));
        
        res.json({ trending });
    } catch (error) {
        console.error('[USER] Trending error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

function calculateTrendingScore(article) {
    const views = article.view_count || 0;
    const saves = article.save_count || 0;
    const shares = article.share_count || 0;
    const age = (Date.now() - new Date(article.timestamp).getTime()) / (1000 * 3600);
    
    // Weighted score: views (1x), saves (3x), shares (5x), recency boost
    return (views + saves * 3 + shares * 5) / Math.max(1, age / 24);
}

// Track share
router.post('/track-share', async (req, res) => {
    try {
        const { articleId } = req.body;
        
        await supabase
            .from('articles')
            .update({ share_count: supabase.raw('COALESCE(share_count, 0) + 1') })
            .eq('id', articleId);
            
        res.json({ success: true });
    } catch (error) {
        console.error('[USER] Track share error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// FEATURE 4: Breaking News Alerts
// ==========================================

// Save alert preferences
router.post('/alert-preferences', async (req, res) => {
    try {
        const { userId, breaking, categories, cities, keywords, methods, quietStart, quietEnd } = req.body;
        
        const { data, error } = await supabase
            .from('alert_preferences')
            .upsert({
                user_id: userId,
                breaking_news: breaking !== undefined ? breaking : true,
                categories: categories || [],
                cities: cities || [],
                keywords: keywords || [],
                alert_methods: methods || ['push'],
                quiet_hours_start: quietStart || null,
                quiet_hours_end: quietEnd || null,
                updated_at: new Date()
            })
            .select();
            
        if (error) throw error;
        res.json({ success: true, preferences: data?.[0] || null });
    } catch (error) {
        console.error('[USER] Alert preferences error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Check for breaking news (called by cron)
router.post('/check-breaking', async (req, res) => {
    try {
        // Get recent high-importance articles
        const { data: articles } = await supabase
            .from('articles')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .gte('importance_score', 0.8)
            .limit(5);
            
        if (!articles?.length) {
            return res.json({ message: 'No breaking news' });
        }
        
        // Get users who want alerts
        const { data: users } = await supabase
            .from('alert_preferences')
            .select('*')
            .eq('breaking_news', true);
            
        for (const article of articles) {
            for (const user of users || []) {
                // Check quiet hours
                if (user.quiet_hours_start && user.quiet_hours_end) {
                    const now = new Date();
                    const currentHour = now.getHours();
                    const startHour = parseInt(user.quiet_hours_start.split(':')[0]);
                    const endHour = parseInt(user.quiet_hours_end.split(':')[0]);
                    
                    if (currentHour >= startHour && currentHour <= endHour) {
                        continue; // Quiet hours
                    }
                }
                
                // Check if article matches user categories
                if (user.categories?.length && !user.categories.includes(article.category)) {
                    continue;
                }
                
                // Send alerts based on user preferences
                if (user.alert_methods?.includes('push')) {
                    // await sendPushNotification(user.user_id, article);
                }
                if (user.alert_methods?.includes('email')) {
                    // await sendEmailAlert(user.user_id, article);
                }
                
                // Log alert
                await supabase
                    .from('alert_history')
                    .insert({
                        user_id: user.user_id,
                        article_id: article.id,
                        alert_type: 'breaking',
                        sent_at: new Date()
                    });
            }
        }
        
        res.json({ 
            success: true, 
            articles: articles.length,
            users: users?.length 
        });
    } catch (error) {
        console.error('[USER] Check breaking error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// FEATURE 5: News Verification Score
// ==========================================

// Calculate verification score for an article
router.post('/verify/:articleId', async (req, res) => {
    try {
        const { articleId } = req.params;
        
        // Get article
        const { data: article } = await supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();
            
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        // Calculate verification score
        let score = 50; // Base score
        const verifiedClaims = [];
        const disputedClaims = [];
        const conflictingSources = [];
        
        // 1. Source reliability
        const sourceReliability = article.reliability_score || 0.5;
        score += sourceReliability * 20;
        
        // 2. Find matching articles on same topic
        const searchTerms = article.title.split(' ').slice(0, 3).join(' ');
        const { data: similar } = await supabase
            .from('articles')
            .select('*')
            .textSearch('title', searchTerms)
            .neq('id', articleId)
            .limit(5);
            
        if (similar?.length) {
            // Check if sources agree
            const agreements = similar.filter(a => 
                Math.abs((a.bias_score || 0.5) - (article.bias_score || 0.5)) < 0.2
            );
            score += agreements.length * 5;
            
            // Check for contradictions
            const contradictions = similar.filter(a => 
                Math.abs((a.bias_score || 0.5) - (article.bias_score || 0.5)) > 0.6
            );
            if (contradictions.length) {
                score -= contradictions.length * 10;
                // FIXED: Removed TypeScript syntax
                contradictions.forEach(c => {
                    conflictingSources.push(c.source);
                });
            }
        }
        
        // 3. Check for official sources
        const officialDomains = ['.gov', '.edu', '.int', 'who.int', 'un.org'];
        if (officialDomains.some(domain => article.url?.includes(domain))) {
            score += 15;
            verifiedClaims.push({
                claim: 'Source is official',
                confidence: 'high'
            });
        }
        
        // 4. Sentiment analysis for bias
        if (Math.abs(article.sentiment_score || 0) > 0.7) {
            score -= 10;
            disputedClaims.push({
                claim: 'Emotionally charged language',
                confidence: 'medium'
            });
        }
        
        // 5. Check for quotes and attributions
        const content = article.content || '';
        const hasQuotes = content.includes('"') || 
                          content.includes('said') ||
                          content.includes('according to');
        if (hasQuotes) score += 10;
        
        // 6. Check for data/statistics
        const hasNumbers = /\d+%|\d+ crore|\d+ lakh|\d+ million/.test(content);
        if (hasNumbers) score += 10;
        
        // Normalize score
        score = Math.min(100, Math.max(0, Math.round(score)));
        
        // Update article
        await supabase
            .from('articles')
            .update({
                verification_score: score,
                conflicting_sources: conflictingSources,
                verified_claims: verifiedClaims,
                disputed_claims: disputedClaims
            })
            .eq('id', articleId);
            
        res.json({
            verification_score: score,
            verified_claims: verifiedClaims,
            disputed_claims: disputedClaims,
            conflicting_sources: conflictingSources,
            factors: {
                source_reliability: Math.round(sourceReliability * 100),
                corroborating_sources: similar?.length || 0,
                has_official_source: officialDomains.some(domain => article.url?.includes(domain)),
                has_quotes: hasQuotes,
                has_statistics: hasNumbers
            }
        });
    } catch (error) {
        console.error('[USER] Verify error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get verification badge for article
router.get('/verification/:articleId', async (req, res) => {
    try {
        const { articleId } = req.params;
        
        const { data: article } = await supabase
            .from('articles')
            .select('verification_score, verified_claims, disputed_claims, conflicting_sources')
            .eq('id', articleId)
            .single();
            
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        const score = article.verification_score || 50;
        let badge = {
            score: score,
            level: 'medium',
            color: '#f59e0b',
            icon: '⚠️'
        };
        
        if (score >= 80) {
            badge = { score: score, level: 'high', color: '#10b981', icon: '✅' };
        } else if (score >= 60) {
            badge = { score: score, level: 'good', color: '#3b82f6', icon: '✓' };
        } else if (score <= 30) {
            badge = { score: score, level: 'low', color: '#ef4444', icon: '❌' };
        }
        
        res.json({
            ...badge,
            verified_claims: article.verified_claims || [],
            disputed_claims: article.disputed_claims || [],
            conflicting_sources: article.conflicting_sources || []
        });
    } catch (error) {
        console.error('[USER] Get verification error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;