-- Migration: Add cargoes_flow_shipment_users table
-- Purpose: Enable user assignment for Cargoes Flow shipments
-- Date: 2025-11-10

-- Create the cargoes_flow_shipment_users table
CREATE TABLE IF NOT EXISTS cargoes_flow_shipment_users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id VARCHAR NOT NULL REFERENCES cargoes_flow_shipments(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cargoes_flow_shipment_users_shipment_id ON cargoes_flow_shipment_users(shipment_id);
CREATE INDEX IF NOT EXISTS idx_cargoes_flow_shipment_users_user_id ON cargoes_flow_shipment_users(user_id);

-- Add unique constraint to prevent duplicate user assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_cargoes_flow_shipment_users_unique ON cargoes_flow_shipment_users(shipment_id, user_id);
