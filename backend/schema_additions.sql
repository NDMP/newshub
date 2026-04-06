-- ============================================================
-- NewsHub Advanced Features — Run in Supabase SQL Editor
-- ============================================================

-- Add new columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS propaganda_techniques JSONB;

-- Narrative threads
CREATE TABLE IF NOT EXISTS narrative_threads (
    id BIGSERIAL PRIMARY KEY,
    title TEXT,
    topic_keywords TEXT[],
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    article_ids BIGINT[],
    summary TEXT,
    alert JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contradictions
CREATE TABLE IF NOT EXISTS contradictions (
    id BIGSERIAL PRIMARY KEY,
    thread_id BIGINT REFERENCES narrative_threads(id) ON DELETE CASCADE,
    claim TEXT,
    article_id_1 BIGINT REFERENCES articles(id) ON DELETE CASCADE,
    article_id_2 BIGINT REFERENCES articles(id) ON DELETE CASCADE,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article claims (for cross-language comparison)
CREATE TABLE IF NOT EXISTS article_claims (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT REFERENCES articles(id) ON DELETE CASCADE,
    claim TEXT,
    confidence FLOAT,
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE narrative_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_claims ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Allow public read narrative_threads" ON narrative_threads FOR SELECT USING (true);
CREATE POLICY "Allow public read contradictions" ON contradictions FOR SELECT USING (true);
CREATE POLICY "Allow public read article_claims" ON article_claims FOR SELECT USING (true);

-- Insert policies (service role / anon for backend)
CREATE POLICY "Allow anon insert narrative_threads" ON narrative_threads
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow anon insert contradictions" ON contradictions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY "Allow anon insert article_claims" ON article_claims
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Update policies
CREATE POLICY "Allow anon update narrative_threads" ON narrative_threads
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_narrative_threads_last_seen ON narrative_threads(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_contradictions_thread_id ON contradictions(thread_id);
CREATE INDEX IF NOT EXISTS idx_article_claims_article_id ON article_claims(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
