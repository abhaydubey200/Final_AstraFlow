-- Create pipeline_runs table
CREATE TABLE public.pipeline_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('running', 'success', 'failed', 'pending', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  rows_processed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create execution_logs table
CREATE TABLE public.execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('extract', 'transform', 'load')),
  log_level TEXT NOT NULL DEFAULT 'INFO' CHECK (log_level IN ('INFO', 'WARN', 'ERROR', 'DEBUG')),
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pipeline_checkpoints table
CREATE TABLE public.pipeline_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  last_processed_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_checkpoints ENABLE ROW LEVEL SECURITY;

-- V1 open policies
CREATE POLICY "Allow all select on pipeline_runs" ON public.pipeline_runs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on pipeline_runs" ON public.pipeline_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on pipeline_runs" ON public.pipeline_runs FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on pipeline_runs" ON public.pipeline_runs FOR DELETE USING (true);

CREATE POLICY "Allow all select on execution_logs" ON public.execution_logs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on execution_logs" ON public.execution_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on execution_logs" ON public.execution_logs FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on execution_logs" ON public.execution_logs FOR DELETE USING (true);

CREATE POLICY "Allow all select on pipeline_checkpoints" ON public.pipeline_checkpoints FOR SELECT USING (true);
CREATE POLICY "Allow all insert on pipeline_checkpoints" ON public.pipeline_checkpoints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on pipeline_checkpoints" ON public.pipeline_checkpoints FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on pipeline_checkpoints" ON public.pipeline_checkpoints FOR DELETE USING (true);

-- Indexes
CREATE INDEX idx_pipeline_runs_pipeline_id ON public.pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_status ON public.pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_start_time ON public.pipeline_runs(start_time);
CREATE INDEX idx_execution_logs_run_id ON public.execution_logs(run_id);
CREATE INDEX idx_execution_logs_stage ON public.execution_logs(stage);
CREATE INDEX idx_pipeline_checkpoints_pipeline_id ON public.pipeline_checkpoints(pipeline_id);