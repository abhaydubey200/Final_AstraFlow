-- Fix missing ON DELETE CASCADE for pipeline connection references
-- This ensures that deleting a connection doesn't fail if it's referenced by a pipeline.

-- 1. Add cascades to pipelines table
DO $$ 
BEGIN
    -- Check if constraint exists and drop it before re-adding with CASCADE
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pipelines_source_connection_id_fkey') THEN
        ALTER TABLE public.pipelines DROP CONSTRAINT pipelines_source_connection_id_fkey;
    END IF;
    
    ALTER TABLE public.pipelines 
    ADD CONSTRAINT pipelines_source_connection_id_fkey 
    FOREIGN KEY (source_connection_id) 
    REFERENCES public.connections(id) 
    ON DELETE CASCADE;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pipelines_destination_connection_id_fkey') THEN
        ALTER TABLE public.pipelines DROP CONSTRAINT pipelines_destination_connection_id_fkey;
    END IF;

    ALTER TABLE public.pipelines 
    ADD CONSTRAINT pipelines_destination_connection_id_fkey 
    FOREIGN KEY (destination_connection_id) 
    REFERENCES public.connections(id) 
    ON DELETE CASCADE;
END $$;
