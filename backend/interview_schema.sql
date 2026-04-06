-- ═══════════════════════════════════════════════════════════
--  NewsHub Interview Mode — Schema
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Practice sessions tracker

CREATE TABLE IF NOT EXISTS practice_sessions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mode          TEXT NOT NULL,      -- 'quiz' | 'gd' | 'opinion'
    topic         TEXT,
    article_id    BIGINT REFERENCES articles(id) ON DELETE SET NULL,
    score         INT DEFAULT 0,      -- 0-100
    total_q       INT DEFAULT 0,
    correct_q     INT DEFAULT 0,
    time_spent    INT DEFAULT 0,      -- seconds
    feedback      TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own sessions"
    ON practice_sessions FOR ALL
    USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_ps_user_created
    ON practice_sessions(user_id, created_at DESC);

-- ── DONE ──────────────────────────────────────────────────
-- That's all you need. No complex tables.
-- AI generates everything else on the fly.
