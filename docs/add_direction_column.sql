-- Add direction column to trips table for return journey support
-- Run this in Supabase SQL Editor
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'onward';
-- direction can be 'onward' or 'return'
