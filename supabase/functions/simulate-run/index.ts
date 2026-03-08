import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipeline_id, user_id } = await req.json();
    if (!pipeline_id) {
      return new Response(JSON.stringify({ error: "pipeline_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get pipeline name
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("name")
      .eq("id", pipeline_id)
      .single();

    const pipelineName = pipeline?.name ?? "Unknown Pipeline";

    // Create the run
    const { data: run, error: runErr } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id,
        status: "running",
        start_time: new Date().toISOString(),
        rows_processed: 0,
        triggered_by: "manual",
      })
      .select()
      .single();

    if (runErr) throw runErr;
    const runId = run.id;

    // Simulate stages with delays
    const stages = [
      { stage: "extract", messages: [
        { level: "INFO", msg: "Connecting to source database..." },
        { level: "INFO", msg: "Connection established (PostgreSQL 15.4)" },
        { level: "INFO", msg: "Executing extraction query on 3 tables..." },
        { level: "DEBUG", msg: "Scanning table: orders (est. 125K rows)" },
        { level: "DEBUG", msg: "Scanning table: customers (est. 45K rows)" },
        { level: "DEBUG", msg: "Scanning table: products (est. 8K rows)" },
        { level: "INFO", msg: "Extraction complete: 178,432 rows fetched in 12.4s" },
      ]},
      { stage: "transform", messages: [
        { level: "INFO", msg: "Starting transformation pipeline..." },
        { level: "INFO", msg: "Applying schema mapping (3 tables → unified model)" },
        { level: "DEBUG", msg: "Deduplicating customer records..." },
        { level: "WARN", msg: "142 records with null email — applying fallback rule" },
        { level: "INFO", msg: "Running data quality checks..." },
        { level: "DEBUG", msg: "Enriching with currency conversion rates (USD base)" },
        { level: "INFO", msg: "Transformation complete: 176,891 clean rows produced" },
      ]},
      { stage: "load", messages: [
        { level: "INFO", msg: "Connecting to destination warehouse..." },
        { level: "INFO", msg: "Connection established (Snowflake, us-east-1)" },
        { level: "INFO", msg: "Staging data to S3 in Parquet format..." },
        { level: "DEBUG", msg: "Uploading 3 partitioned files (284 MB total)" },
        { level: "INFO", msg: "Executing COPY INTO target tables..." },
        { level: "INFO", msg: "Load complete: 176,891 rows written to 3 tables" },
        { level: "INFO", msg: "Post-load validation passed ✓" },
      ]},
    ];

    let totalRows = 0;
    const rowCounts = [178432, 176891, 176891];

    for (let si = 0; si < stages.length; si++) {
      const { stage, messages } = stages[si];

      // Update status with progress
      await supabase
        .from("pipeline_runs")
        .update({ rows_processed: totalRows })
        .eq("id", runId);

      for (const msg of messages) {
        await supabase.from("execution_logs").insert({
          run_id: runId,
          stage,
          log_level: msg.level,
          message: msg.msg,
        });

        // Small delay between log entries to simulate real work
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
      }

      totalRows = rowCounts[si];

      // Brief pause between stages
      await new Promise((r) => setTimeout(r, 500));
    }

    // Mark as success
    await supabase
      .from("pipeline_runs")
      .update({
        status: "success",
        end_time: new Date().toISOString(),
        rows_processed: totalRows,
      })
      .eq("id", runId);

    // Update pipeline last_run_at
    await supabase
      .from("pipelines")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", pipeline_id);

    // Send notification if user_id provided
    if (user_id) {
      await supabase.from("notifications").insert({
        user_id,
        pipeline_id,
        run_id: runId,
        title: `Pipeline Completed: ${pipelineName}`,
        message: `Processed ${totalRows.toLocaleString()} rows successfully across 3 stages.`,
        severity: "success",
      });
    }

    return new Response(
      JSON.stringify({ run_id: runId, status: "success", rows_processed: totalRows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Simulate run error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
