-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Now tighten RLS on all existing tables to require authentication
-- Pipelines
DROP POLICY IF EXISTS "Allow read access to pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow insert pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow update pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow delete pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow all select on pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow all insert on pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow all update on pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Allow all delete on pipelines" ON public.pipelines;

CREATE POLICY "Authenticated read pipelines" ON public.pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipelines" ON public.pipelines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipelines" ON public.pipelines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipelines" ON public.pipelines FOR DELETE TO authenticated USING (true);

-- Pipeline nodes
DROP POLICY IF EXISTS "Allow all select on pipeline_nodes" ON public.pipeline_nodes;
DROP POLICY IF EXISTS "Allow all insert on pipeline_nodes" ON public.pipeline_nodes;
DROP POLICY IF EXISTS "Allow all update on pipeline_nodes" ON public.pipeline_nodes;
DROP POLICY IF EXISTS "Allow all delete on pipeline_nodes" ON public.pipeline_nodes;

CREATE POLICY "Authenticated read pipeline_nodes" ON public.pipeline_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_nodes" ON public.pipeline_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_nodes" ON public.pipeline_nodes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipeline_nodes" ON public.pipeline_nodes FOR DELETE TO authenticated USING (true);

-- Pipeline edges
DROP POLICY IF EXISTS "Allow all select on pipeline_edges" ON public.pipeline_edges;
DROP POLICY IF EXISTS "Allow all insert on pipeline_edges" ON public.pipeline_edges;
DROP POLICY IF EXISTS "Allow all update on pipeline_edges" ON public.pipeline_edges;
DROP POLICY IF EXISTS "Allow all delete on pipeline_edges" ON public.pipeline_edges;

CREATE POLICY "Authenticated read pipeline_edges" ON public.pipeline_edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_edges" ON public.pipeline_edges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_edges" ON public.pipeline_edges FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipeline_edges" ON public.pipeline_edges FOR DELETE TO authenticated USING (true);

-- Pipeline runs
DROP POLICY IF EXISTS "Allow all select on pipeline_runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Allow all insert on pipeline_runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Allow all update on pipeline_runs" ON public.pipeline_runs;
DROP POLICY IF EXISTS "Allow all delete on pipeline_runs" ON public.pipeline_runs;

CREATE POLICY "Authenticated read pipeline_runs" ON public.pipeline_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_runs" ON public.pipeline_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_runs" ON public.pipeline_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipeline_runs" ON public.pipeline_runs FOR DELETE TO authenticated USING (true);

-- Execution logs
DROP POLICY IF EXISTS "Allow all select on execution_logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Allow all insert on execution_logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Allow all update on execution_logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Allow all delete on execution_logs" ON public.execution_logs;

CREATE POLICY "Authenticated read execution_logs" ON public.execution_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert execution_logs" ON public.execution_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update execution_logs" ON public.execution_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete execution_logs" ON public.execution_logs FOR DELETE TO authenticated USING (true);

-- Pipeline checkpoints
DROP POLICY IF EXISTS "Allow all select on pipeline_checkpoints" ON public.pipeline_checkpoints;
DROP POLICY IF EXISTS "Allow all insert on pipeline_checkpoints" ON public.pipeline_checkpoints;
DROP POLICY IF EXISTS "Allow all update on pipeline_checkpoints" ON public.pipeline_checkpoints;
DROP POLICY IF EXISTS "Allow all delete on pipeline_checkpoints" ON public.pipeline_checkpoints;

CREATE POLICY "Authenticated read pipeline_checkpoints" ON public.pipeline_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert pipeline_checkpoints" ON public.pipeline_checkpoints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update pipeline_checkpoints" ON public.pipeline_checkpoints FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete pipeline_checkpoints" ON public.pipeline_checkpoints FOR DELETE TO authenticated USING (true);

-- Connections
DROP POLICY IF EXISTS "Allow read access to connections" ON public.connections;
DROP POLICY IF EXISTS "Allow insert connections" ON public.connections;
DROP POLICY IF EXISTS "Allow update connections" ON public.connections;
DROP POLICY IF EXISTS "Allow delete connections" ON public.connections;

CREATE POLICY "Authenticated read connections" ON public.connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert connections" ON public.connections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update connections" ON public.connections FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete connections" ON public.connections FOR DELETE TO authenticated USING (true);