import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ValidationError {
  node_id?: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  dag: { stages: string[]; node_count: number; edge_count: number } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    let claims: any;
    try {
      const result = await supabase.auth.getClaims(token);
      if (result.error || !result.data?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      claims = result.data.claims;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized - token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pipeline_id } = await req.json();
    if (!pipeline_id) {
      return new Response(JSON.stringify({ error: "pipeline_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pipeline, nodes, edges
    const [pipelineRes, nodesRes, edgesRes] = await Promise.all([
      adminClient.from("pipelines").select("*").eq("id", pipeline_id).single(),
      adminClient.from("pipeline_nodes").select("*").eq("pipeline_id", pipeline_id).order("order_index"),
      adminClient.from("pipeline_edges").select("*").eq("pipeline_id", pipeline_id),
    ]);

    if (pipelineRes.error || !pipelineRes.data) {
      return new Response(JSON.stringify({ error: "Pipeline not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pipeline = pipelineRes.data;
    const nodes = nodesRes.data || [];
    const edges = edgesRes.data || [];

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Rule 1: Pipeline must have a name
    if (!pipeline.name || pipeline.name.trim() === "" || pipeline.name === "Untitled Pipeline") {
      warnings.push({ field: "name", message: "Pipeline should have a descriptive name", severity: "warning" });
    }

    // Rule 2: Must have at least one source node
    const sourceNodes = nodes.filter((n: any) => n.node_type === "source");
    if (sourceNodes.length === 0) {
      errors.push({ field: "nodes", message: "Pipeline must have at least one source node", severity: "error" });
    }

    // Rule 3: Must have at least one load/destination node
    const loadNodes = nodes.filter((n: any) => ["load", "destination"].includes(n.node_type));
    if (loadNodes.length === 0) {
      errors.push({ field: "nodes", message: "Pipeline must have at least one destination/load node", severity: "error" });
    }

    // Rule 4: Must have at least 2 nodes
    if (nodes.length < 2) {
      errors.push({ field: "nodes", message: "Pipeline must have at least 2 nodes (source + destination)", severity: "error" });
    }

    // Rule 5: Check for disconnected nodes (nodes with no edges)
    if (nodes.length > 1) {
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.source_node_id);
        connectedNodeIds.add(edge.target_node_id);
      }
      for (const node of nodes) {
        if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
          warnings.push({
            node_id: node.id,
            field: "connectivity",
            message: `Node "${node.label || node.node_type}" is not connected to any other node`,
            severity: "warning",
          });
        }
      }
    }

    // Rule 6: Check for cycles (topological sort)
    const hasCycle = detectCycle(nodes, edges);
    if (hasCycle) {
      errors.push({ field: "dag", message: "Pipeline contains a cycle — DAG must be acyclic", severity: "error" });
    }

    // Rule 7: Validate node configs
    for (const node of nodes) {
      if (node.node_type === "source") {
        const config = node.config_json || {};
        if (!config.connection_id && !config.table) {
          warnings.push({
            node_id: node.id,
            field: "config",
            message: `Source node "${node.label}" has no connection or table configured`,
            severity: "warning",
          });
        }
      }
    }

    // Build DAG summary
    const stageTypes = [...new Set(nodes.map((n: any) => n.node_type))];
    const dag = errors.length === 0
      ? { stages: stageTypes, node_count: nodes.length, edge_count: edges.length }
      : null;

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      dag,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pipeline validation error:", err);
    return new Response(
      JSON.stringify({ valid: false, errors: [{ field: "system", message: (err as Error).message, severity: "error" }], warnings: [], dag: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectCycle(nodes: any[], edges: any[]): boolean {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adj.get(edge.source_node_id)?.push(edge.target_node_id);
    inDegree.set(edge.target_node_id, (inDegree.get(edge.target_node_id) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const neighbor of adj.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return visited !== nodes.length;
}
