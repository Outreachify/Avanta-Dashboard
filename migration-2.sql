-- Run this in Supabase SQL Editor
-- Adds api_token and client_status columns to workspaces table

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS client_status TEXT DEFAULT 'active';
