-- WiseURL v1 - Supabase Schema (Privacy-Focused)
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Links table
CREATE TABLE IF NOT EXISTS links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  title VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Clicks table (analytics) - NO IP STORAGE for privacy
CREATE TABLE IF NOT EXISTS clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  original_referrer TEXT,
  country VARCHAR(100),           -- Country name only, no IP
  city VARCHAR(100),
  device_type VARCHAR(20),        -- desktop/mobile/tablet
  os_name VARCHAR(50),
  browser_name VARCHAR(50),
  is_bot BOOLEAN DEFAULT false,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  click_id UUID,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  sub_id1 VARCHAR(255),
  sub_id2 VARCHAR(255),
  sub_id3 VARCHAR(255),
  query_params JSONB,
  source_label VARCHAR(255),
  source_kind VARCHAR(20) CHECK (source_kind IS NULL OR source_kind IN ('explicit', 'referrer', 'unknown')),
  destination_url_snapshot TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
CREATE INDEX IF NOT EXISTS idx_links_active ON links(is_active);
CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country);
CREATE INDEX IF NOT EXISTS idx_clicks_is_bot ON clicks(is_bot);
CREATE INDEX IF NOT EXISTS idx_clicks_device ON clicks(device_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clicks_click_id ON clicks(click_id) WHERE click_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_utm_source ON clicks(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_utm_campaign ON clicks(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_sub_id1 ON clicks(sub_id1) WHERE sub_id1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_source_label ON clicks(source_label) WHERE source_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_link_time ON clicks(link_id, clicked_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for links updated_at
DROP TRIGGER IF EXISTS update_links_updated_at ON links;
CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own links
CREATE POLICY "Users can view own links" ON links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own links" ON links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own links" ON links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own links" ON links
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: Public can read active links (for redirect)
CREATE POLICY "Public can read active links" ON links
  FOR SELECT USING (is_active = true);

-- Policy: Anyone can insert clicks (public redirects)
CREATE POLICY "Public can insert clicks" ON clicks
  FOR INSERT WITH CHECK (true);

-- Policy: Users can view clicks for their links
CREATE POLICY "Users can view clicks for their links" ON clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM links 
      WHERE links.id = clicks.link_id 
      AND links.user_id = auth.uid()
    )
  );
-- WiseURL v1 - Link Groups Schema
-- WiseURL v1 - Link Groups Schema

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'gray',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add group_id to links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_links_group_id ON links(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);

-- RLS for groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Users can manage their own groups
DROP POLICY IF EXISTS "Users can view own groups" ON groups;
CREATE POLICY "Users can view own groups" ON groups
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own groups" ON groups;
CREATE POLICY "Users can insert own groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own groups" ON groups;
CREATE POLICY "Users can update own groups" ON groups
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own groups" ON groups;
CREATE POLICY "Users can delete own groups" ON groups
  FOR DELETE USING (auth.uid() = user_id);

-- 404 Error Logging (for missing referral tracking)
CREATE TABLE IF NOT EXISTS error_404_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    original_referrer TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    device_type VARCHAR(20),
    os_name VARCHAR(50),
    browser_name VARCHAR(50),
    is_bot BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for 404 logs
CREATE INDEX IF NOT EXISTS idx_error_404_logs_code ON error_404_logs(code);
CREATE INDEX IF NOT EXISTS idx_error_404_logs_created_at ON error_404_logs(created_at);

-- RLS for error_404_logs
ALTER TABLE error_404_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Public can insert logs (system level, but need public access for anonymous redirects)
CREATE POLICY "Public can insert 404 logs" ON error_404_logs
    FOR INSERT WITH CHECK (true);

-- Historical 404 rows have no reliable owner. They are intentionally not
-- selectable from the per-user dashboard.
