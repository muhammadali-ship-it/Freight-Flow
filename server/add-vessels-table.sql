-- Migration: Add vessels table for Vessel Dashboard
-- Created: 2025-11-25

CREATE TABLE IF NOT EXISTS vessels (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  trip_number TEXT,
  destination TEXT,
  eta TEXT,
  atd TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_vessels_name ON vessels(name);

-- Create index on destination for filtering
CREATE INDEX IF NOT EXISTS idx_vessels_destination ON vessels(destination);
