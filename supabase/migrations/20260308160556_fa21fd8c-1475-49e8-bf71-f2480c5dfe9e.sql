-- Create connections table
CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mssql', 'mysql', 'postgresql', 'snowflake')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  ssl_enabled BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'testing')),
  last_tested_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- V1 open policies (will be tightened when auth is added)
CREATE POLICY "Allow read access to connections"
  ON public.connections FOR SELECT
  USING (true);

CREATE POLICY "Allow insert connections"
  ON public.connections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update connections"
  ON public.connections FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete connections"
  ON public.connections FOR DELETE
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();