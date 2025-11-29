-- Create enum for media types
CREATE TYPE media_type AS ENUM ('movie', 'episode');

-- Create enum for holidays
CREATE TYPE holiday AS ENUM (
  'Christmas',
  'Thanksgiving',
  'Halloween',
  'New Years',
  'Hanukkah',
  'Kwanzaa',
  'Easter',
  'Valentine''s Day',
  'Independence Day',
  'St. Patrick''s Day',
  'April Fools',
  'Mother''s Day',
  'Father''s Day',
  'Labor Day',
  'Memorial Day',
  'Veterans Day',
  'Mardi Gras',
  'Dia de los Muertos',
  'Chinese New Year',
  'Diwali',
  'Ramadan',
  'Winter Holiday',
  'Generic Holiday'
);

-- Table to store media items from Plex
CREATE TABLE media_items (
    id SERIAL PRIMARY KEY,
    plex_key VARCHAR(255) UNIQUE NOT NULL,
    media_type media_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    year INTEGER,
    season INTEGER,
    episode INTEGER,
    grandparent_title VARCHAR(500),
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store AI classification results
CREATE TABLE ai_classifications (
    id SERIAL PRIMARY KEY,
    media_item_id INTEGER REFERENCES media_items(id) ON DELETE CASCADE,
    holiday holiday NOT NULL,
    confidence DECIMAL(5,2) CHECK (confidence >= 0 AND confidence <= 100),
    reason TEXT,
    classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_item_id, holiday)
);

-- Table to cache AI responses to avoid redundant API calls
CREATE TABLE ai_response_cache (
    id SERIAL PRIMARY KEY,
    media_item_id INTEGER REFERENCES media_items(id) ON DELETE CASCADE UNIQUE,
    request_payload JSONB NOT NULL,
    response_payload JSONB NOT NULL,
    model VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_media_items_plex_key ON media_items(plex_key);
CREATE INDEX idx_media_items_title ON media_items(title);
CREATE INDEX idx_media_items_type ON media_items(media_type);
CREATE INDEX idx_ai_classifications_media_item ON ai_classifications(media_item_id);
CREATE INDEX idx_ai_classifications_holiday ON ai_classifications(holiday);
CREATE INDEX idx_ai_response_cache_media_item ON ai_response_cache(media_item_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_media_items_updated_at BEFORE UPDATE ON media_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
