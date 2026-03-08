import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SchemaTable {
  table_name: string;
  schema_name: string;
  row_count_estimate: number;
  columns: SchemaColumn[];
}

interface SchemaColumn {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value: string | null;
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
    try {
      const result = await supabase.auth.getClaims(token);
      if (result.error || !result.data?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized - token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { connection_id, password } = await req.json();
    if (!connection_id) {
      return new Response(JSON.stringify({ error: "connection_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn, error: connErr } = await adminClient
      .from("connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tables: SchemaTable[] = [];

    if (conn.type === "postgresql") {
      tables = await discoverPostgres({
        host: conn.host,
        port: conn.port,
        database_name: conn.database_name,
        username: conn.username,
        password: password || "",
        ssl_enabled: conn.ssl_enabled,
      });
    } else {
      // For non-PostgreSQL, return a helpful message
      return new Response(
        JSON.stringify({
          tables: [],
          message: `Schema discovery for ${conn.type} requires a dedicated connector proxy. PostgreSQL is fully supported.`,
          supported: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ tables, supported: true, count: tables.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Schema discovery error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, tables: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function discoverPostgres(params: {
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl_enabled: boolean;
}): Promise<SchemaTable[]> {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client({
    hostname: params.host,
    port: params.port,
    database: params.database_name,
    user: params.username,
    password: params.password,
    tls: { enabled: params.ssl_enabled },
    connection: { attempts: 1 },
  });

  await client.connect();

  // Get tables with row estimates
  const tablesResult = await client.queryObject<{
    table_name: string;
    table_schema: string;
    row_estimate: number;
  }>(`
    SELECT 
      t.table_name,
      t.table_schema,
      COALESCE(c.reltuples::bigint, 0) as row_estimate
    FROM information_schema.tables t
    LEFT JOIN pg_class c ON c.relname = t.table_name
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_schema, t.table_name
    LIMIT 100
  `);

  const tables: SchemaTable[] = [];

  for (const row of tablesResult.rows) {
    // Get columns for each table
    const colsResult = await client.queryObject<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [row.table_schema, row.table_name]);

    // Get primary key columns
    const pkResult = await client.queryObject<{ column_name: string }>(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
    `, [row.table_schema, row.table_name]);

    const pkCols = new Set(pkResult.rows.map((r) => r.column_name));

    tables.push({
      table_name: row.table_name,
      schema_name: row.table_schema,
      row_count_estimate: row.row_estimate,
      columns: colsResult.rows.map((c) => ({
        name: c.column_name,
        data_type: c.data_type,
        is_nullable: c.is_nullable === "YES",
        is_primary_key: pkCols.has(c.column_name),
        default_value: c.column_default,
      })),
    });
  }

  await client.end();
  return tables;
}
