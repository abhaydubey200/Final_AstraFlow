-- Trigger function to create notifications when pipeline_runs change to failed/success
CREATE OR REPLACE FUNCTION public.notify_on_run_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_name text;
  v_rule record;
  v_user_id uuid;
  v_title text;
  v_message text;
  v_severity text;
BEGIN
  -- Only fire on status changes to terminal states
  IF NEW.status NOT IN ('success', 'failed') THEN
    RETURN NEW;
  END IF;

  IF OLD IS NOT NULL AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_pipeline_name FROM public.pipelines WHERE id = NEW.pipeline_id;

  -- Check alert rules for this pipeline (or global rules with null pipeline_id)
  FOR v_rule IN
    SELECT * FROM public.alert_rules
    WHERE enabled = true
      AND (pipeline_id IS NULL OR pipeline_id = NEW.pipeline_id)
      AND (
        (rule_type = 'pipeline_failure' AND NEW.status = 'failed')
        OR (rule_type = 'pipeline_success' AND NEW.status = 'success')
        OR (rule_type = 'any_completion')
      )
  LOOP
    IF NEW.status = 'failed' THEN
      v_title := 'Pipeline Failed: ' || COALESCE(v_pipeline_name, 'Unknown');
      v_message := COALESCE(NEW.error_message, 'Pipeline run failed without error details.');
      v_severity := 'error';
    ELSE
      v_title := 'Pipeline Completed: ' || COALESCE(v_pipeline_name, 'Unknown');
      v_message := 'Processed ' || NEW.rows_processed || ' rows successfully.';
      v_severity := 'success';
    END IF;

    -- Notify the rule creator; if null, notify all authenticated users with 'user' role
    IF v_rule.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, alert_rule_id, pipeline_id, run_id, title, message, severity)
      VALUES (v_rule.created_by, v_rule.id, NEW.pipeline_id, NEW.id, v_title, v_message, v_severity);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_pipeline_run_status_change
  AFTER INSERT OR UPDATE OF status ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_run_status_change();