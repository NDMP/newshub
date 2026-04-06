// ═══════════════════════════════════════════════════════════════════════════
//  NewsHub — YouTube Video Search
//  COPY THIS FILE TO: newshub/newshub/backend/routes/videos.js
//
//  IMPORTANT: DO NOT add dotenv here. server.js already loads .env.
//  Just use process.env directly.
//
//  Debug endpoint: GET /api/videos/debug
//  Visit: http://localhost:3001/api/videos/debug
//  Shows exactly what's in process.env and why videos may not work.
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();

// Read directly from process.env — server.js loads .env before routes run
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ── 10-min cache ────────────────────────────────────────────────────────────
const cache = new Map();
const TTL   = 10 * 60 * 1000;
function getCached(k)   { const i=cache.get(k); if(!i||Date.now()-i.ts>TTL){cache.delete(k);return null;} return i.d; }
function setCache(k,d)  { cache.set(k,{ts:Date.now(),d}); }

// ══════════════════════════════════════════════════════════════════════════
//  DEBUG ENDPOINT — visit http://localhost:3001/api/videos/debug
//  Shows exactly what's happening with the API key
// ══════════════════════════════════════════════════════════════════════════
router.get('/debug', async (req, res) => {
  const keyPresent = !!YOUTUBE_API_KEY;
  const keyPreview = YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 12) + '...' : 'NOT SET';

  let apiTest = null;
  if (YOUTUBE_API_KEY) {
    try {
      const testUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&q=india+news&part=snippet&type=video&maxResults=1`;
      const r   = await fetch(testUrl);
      const txt = await r.text();
      if (r.ok) {
        const d = JSON.parse(txt);
        apiTest = { status: r.status, ok: true, resultCount: d.items?.length || 0 };
      } else {
        let reason = `HTTP ${r.status}`;
        try {
          const e = JSON.parse(txt);
          reason = e?.error?.message || reason;
        } catch {}
        apiTest = { status: r.status, ok: false, error: reason };
      }
    } catch (e) {
      apiTest = { ok: false, error: e.message };
    }
  }

  res.json({
    youtube_key_present: keyPresent,
    youtube_key_preview: keyPreview,
    api_test: apiTest,
    instruction: keyPresent ? 'Key is set. Check api_test for result.' : 'YOUTUBE_API_KEY is missing in .env — add it and restart server.',
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  CLEAN TITLE → SEARCH QUERY
// ══════════════════════════════════════════════════════════════════════════
function buildQuery(title, category) {
  if (!title) return 'India news today';

  let q = title;

  // Step 1: Strip source attribution suffix
  // Handles: " - OilPrice.com", " | Reuters", " - National Catholic Reporter"
  q = q.replace(/\s*[-–|]\s*[\w][\w\s.]{2,50}$/, '').trim();

  // Step 2: Strip all punctuation except spaces
  q = q.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // Step 3: Remove filler words that hurt YouTube search
  const filler = new Set(['says','told','report','reports','according','amid','over',
                          'after','before','as','by','on','in','at','to','for','of',
                          'and','or','but','the','a','an','is','are','was','were']);
  const words = q.split(' ').filter(w => w.length > 1 && !filler.has(w.toLowerCase()));

  // Step 4: Take first 6 meaningful words
  q = words.slice(0, 6).join(' ');

  const suffix = {
    Sports:        'highlights',
    Technology:    'news',
    Business:      'news',
    Health:        'news',
    Entertainment: 'latest',
    Science:       'explained',
  }[category] || 'news';

  const query = `${q} ${suffix}`;
  console.log(`[VIDEOS] title  : "${title.substring(0, 65)}"`);
  console.log(`[VIDEOS] query  : "${query}"`);
  return query;
}

// ══════════════════════════════════════════════════════════════════════════
//  RELEVANCE SCORE
// ══════════════════════════════════════════════════════════════════════════
function scoreVideo(vTitle, vDesc, articleTitle) {
  const vt  = (vTitle  || '').toLowerCase();
  const vd  = (vDesc   || '').toLowerCase();
  const at  = (articleTitle || '').toLowerCase();
  const stop = new Set(['the','a','an','is','in','on','at','to','for','of','and','or','but','with','by']);
  const kws  = at.split(/\W+/).filter(w => w.length > 3 && !stop.has(w));
  let score  = 0;
  kws.forEach(kw => { if (vt.includes(kw)) score+=3; if (vd.includes(kw)) score+=1; });
  const news = ['ndtv','bbc','cnn','times now','republic','wion','al jazeera','reuters','india today','abp','zee','news18'];
  if (news.some(ch => vt.includes(ch))) score += 2;
  return score;
}

// ══════════════════════════════════════════════════════════════════════════
//  POST /api/videos/search
// ══════════════════════════════════════════════════════════════════════════
router.post('/search', async (req, res) => {
  console.log(`\n[VIDEOS] === New search request ===`);
  console.log(`[VIDEOS] YOUTUBE_API_KEY: ${YOUTUBE_API_KEY ? '✓ (' + YOUTUBE_API_KEY.substring(0,10) + '...)' : '✗ MISSING'}`);

  if (!YOUTUBE_API_KEY) {
    console.error('[VIDEOS] YOUTUBE_API_KEY missing! Add it to .env and RESTART the server.');
    return res.json({ videos: [], reason: 'YOUTUBE_API_KEY not set — restart server after adding to .env' });
  }

  const { title, category } = req.body;
  if (!title?.trim()) return res.json({ videos: [] });

  console.log(`[VIDEOS] Article: "${title.substring(0, 65)}"`);

  // Cache check
  const ck = `${title}::${category}`;
  const cc = getCached(ck);
  if (cc) { console.log('[VIDEOS] Cache hit'); return res.json({ videos: cc, cached: true }); }

  const query = buildQuery(title, category);
  console.log(`[VIDEOS] Query: "${query}"`);

  try {
    const params = new URLSearchParams({
      key:        YOUTUBE_API_KEY,
      q:          query,
      part:       'snippet',
      type:       'video',
      maxResults: '8',
      order:      'relevance',
    });

    const url  = `https://www.googleapis.com/youtube/v3/search?${params}`;
    const resp = await fetch(url);
    const text = await resp.text();

    if (!resp.ok) {
      console.error(`[VIDEOS] YouTube API ${resp.status}:`, text.substring(0, 400));

      let userReason = `YouTube API error ${resp.status}`;
      try {
        const e = JSON.parse(text);
        const msg = e?.error?.message || '';
        const reason = e?.error?.errors?.[0]?.reason || '';
        console.error(`[VIDEOS] Error: ${msg} | Reason: ${reason}`);

        if (resp.status === 403) {
          if (reason === 'quotaExceeded') userReason = 'YouTube API daily quota exceeded (10,000 units/day). Try again tomorrow.';
          else if (reason === 'keyInvalid') userReason = 'YouTube API key is invalid. Check YOUTUBE_API_KEY in .env';
          else userReason = `YouTube API 403: ${reason}. Enable "YouTube Data API v3" at console.cloud.google.com`;
        }
      } catch {}

      return res.json({ videos: [], reason: userReason });
    }

    const data  = JSON.parse(text);
    const items = data.items || [];
    console.log(`[VIDEOS] YouTube returned ${items.length} results`);

    if (!items.length) return res.json({ videos: [], query });

    // Score + pick top 4
    const top = items
      .map(i => ({ i, s: scoreVideo(i.snippet?.title, i.snippet?.description, title) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map(x => x.i);

    // Fetch durations (best-effort)
    const ids = top.map(v => v.id?.videoId).filter(Boolean);
    let dm = {};
    if (ids.length) {
      try {
        const dp = new URLSearchParams({ key: YOUTUBE_API_KEY, id: ids.join(','), part: 'contentDetails,statistics' });
        const dr = await fetch(`https://www.googleapis.com/youtube/v3/videos?${dp}`);
        const dd = await dr.json();
        (dd.items || []).forEach(v => {
          dm[v.id] = { duration: parseDur(v.contentDetails?.duration), views: fmtViews(v.statistics?.viewCount) };
        });
      } catch(e) { console.warn('[VIDEOS] Duration fetch failed:', e.message); }
    }

    const videos = top.map(item => {
      const vid = item.id?.videoId;
      const sn  = item.snippet || {};
      const d   = dm[vid] || {};
      return {
        videoId:      vid,
        title:        sn.title || '',
        description:  (sn.description || '').substring(0, 100),
        thumbnail:    sn.thumbnails?.medium?.url
                      || `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
        channelTitle: sn.channelTitle || '',
        publishedAt:  sn.publishedAt  || '',
        duration:     d.duration || '',
        viewCount:    d.views    || '',
      };
    }).filter(v => v.videoId);

    console.log(`[VIDEOS] ✓ Returning ${videos.length} videos`);
    setCache(ck, videos);
    res.json({ videos, query });

  } catch(err) {
    console.error('[VIDEOS] Error:', err.message);
    res.json({ videos: [], error: err.message });
  }
});

// Helpers
function parseDur(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h=parseInt(m[1]||'0'), mn=parseInt(m[2]||'0'), s=parseInt(m[3]||'0');
  return h>0 ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}
function fmtViews(n) {
  if (!n) return '';
  const v=parseInt(n);
  if(v>=1e6) return `${(v/1e6).toFixed(1)}M views`;
  if(v>=1e3) return `${Math.round(v/1e3)}K views`;
  return `${v} views`;
}

router.get('/status', (_,res) => res.json({ configured: !!YOUTUBE_API_KEY }));

module.exports = router;
