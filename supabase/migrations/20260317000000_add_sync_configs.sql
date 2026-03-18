-- Phase 7: Sync Configuration Persistence
-- Creates the sync_configs table to store per-table synchronization settings.

CREATE TABLE IF NOT EXISTS public.sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    sync_mode TEXT NOT NULL DEFAULT 'full_refresh',
    cursor_field TEXT,
    primary_key TEXT,
    selected_columns JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, schema_name, table_name)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_sync_configs_updated_at ON public.sync_configs;
CREATE TRIGGER update_sync_configs_updated_at
    BEFORE UPDATE ON public.sync_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.sync_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select on sync_configs" ON public.sync_configs;
CREATE POLICY "Allow select on sync_configs" ON public.sync_configs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all on sync_configs (dev)" ON public.sync_configs;
CREATE POLICY "Allow all on sync_configs (dev)" ON public.sync_configs USING (true);
