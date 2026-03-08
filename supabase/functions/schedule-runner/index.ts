import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();

    // Fetch pipelines that are active and have a non-manual schedule with next_run_at <= now
    const { data: duePipelines, error: fetchErr } = await supabase
      .from("pipelines")
      .select("id, name, schedule_type, schedule_config, next_run_at")
      .eq("status", "active")
      .neq("schedule_type", "manual")
      .lte("next_run_at", now.toISOString());

    if (fetchErr) throw fetchErr;

    const triggered: string[] = [];

    for (const pipeline of duePipelines ?? []) {
      // Create a new run
      const { error: runErr } = await supabase
        .from("pipeline_runs")
        .insert({
          pipeline_id: pipeline.id,
          status: "running",
          start_time: now.toISOString(),
          rows_processed: 0,
          triggered_by: "scheduler",
        });

      if (runErr) {
        console.error(`Failed to trigger run for ${pipeline.id}:`, runErr);
        continue;
      }

      // Compute next_run_at based on schedule_type
      const nextRun = computeNextRun(pipeline.schedule_type, pipeline.schedule_config);

      await supabase
        .from("pipelines")
        .update({ last_run_at: now.toISOString(), next_run_at: nextRun })
        .eq("id", pipeline.id);

      triggered.push(pipeline.name);
    }

    return new Response(
      JSON.stringify({ triggered, count: triggered.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Schedule runner error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function computeNextRun(
  scheduleType: string,
  scheduleConfig: Record<string, unknown> | null
): string {
  const now = new Date();

  switch (scheduleType) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "cron": {
      // For cron, approximate next run as 1 hour from now
      // A full cron parser could be added later
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
}
