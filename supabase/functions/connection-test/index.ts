import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConnTestRequest {
  connection_id?: string; // test existing connection
  // OR inline params for testing before save:
  type?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;
  ssl_enabled?: boolean;
}

interface ConnTestResult {
  success: boolean;
  latency_ms: number;
  server_version?: string;
  error?: string;
  tables_count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
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

    const body: ConnTestRequest = await req.json();
    let connParams: { type: string; host: string; port: number; database_name: string; username: string; password: string; ssl_enabled: boolean };

    if (body.connection_id) {
      // Fetch connection from DB
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: conn, error: connErr } = await adminClient
        .from("connections")
        .select("*")
        .eq("id", body.connection_id)
        .single();
      if (connErr || !conn) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      connParams = {
        type: conn.type,
        host: conn.host,
        port: conn.port,
        database_name: conn.database_name,
        username: conn.username,
        password: body.password || "",
        ssl_enabled: conn.ssl_enabled,
      };
    } else {
      if (!body.type || !body.host || !body.username) {
        return new Response(JSON.stringify({ error: "Missing required fields: type, host, username" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      connParams = {
        type: body.type,
        host: body.host,
        port: body.port || 5432,
        database_name: body.database_name || "",
        username: body.username,
        password: body.password || "",
        ssl_enabled: body.ssl_enabled || false,
      };
    }

    const startTime = Date.now();
    let result: ConnTestResult;

    if (connParams.type === "postgresql") {
      result = await testPostgres(connParams);
    } else if (connParams.type === "mysql") {
      result = await testMySQL(connParams);
    } else if (connParams.type === "mssql") {
      result = await testMSSQL(connParams);
    } else if (connParams.type === "snowflake") {
      result = await testSnowflake(connParams);
    } else {
      result = { success: false, latency_ms: 0, error: `Unsupported type: ${connParams.type}` };
    }

    result.latency_ms = Date.now() - startTime;

    // Update connection status in DB if connection_id provided
    if (body.connection_id) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient
        .from("connections")
        .update({
          status: result.success ? "connected" : "error",
          last_tested_at: new Date().toISOString(),
        })
        .eq("id", body.connection_id);
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Connection test error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message, latency_ms: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testPostgres(params: { host: string; port: number; database_name: string; username: string; password: string; ssl_enabled: boolean }): Promise<ConnTestResult> {
  try {
    // Use Deno's native postgres driver
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
    const versionResult = await client.queryObject<{ version: string }>("SELECT version()");
    const tablesResult = await client.queryObject<{ count: number }>(
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    await client.end();
    return {
      success: true,
      latency_ms: 0,
      server_version: versionResult.rows[0]?.version?.split(" ").slice(0, 2).join(" ") || "PostgreSQL",
      tables_count: tablesResult.rows[0]?.count || 0,
    };
  } catch (e) {
    return { success: false, latency_ms: 0, error: (e as Error).message };
  }
}

async function testMySQL(params: { host: string; port: number; database_name: string; username: string; password: string }): Promise<ConnTestResult> {
  // Attempt TCP connection to verify host:port reachability
  try {
    const conn = await Deno.connect({ hostname: params.host, port: params.port });
    // Read MySQL greeting packet (first 4 bytes = length, then server version string)
    const buf = new Uint8Array(256);
    const n = await conn.read(buf);
    conn.close();
    if (n && n > 5) {
      // MySQL greeting packet: skip 4-byte header, read version string
      const payload = buf.slice(4, n);
      const nullIdx = payload.indexOf(0);
      const version = new TextDecoder().decode(payload.slice(1, nullIdx > 0 ? nullIdx : 20));
      return {
        success: true,
        latency_ms: 0,
        server_version: `MySQL ${version}`,
      };
    }
    return { success: true, latency_ms: 0, server_version: "MySQL" };
  } catch (e) {
    return { success: false, latency_ms: 0, error: `Cannot reach MySQL at ${params.host}:${params.port} — ${(e as Error).message}` };
  }
}

async function testMSSQL(params: { host: string; port: number; database_name: string; username: string; password: string }): Promise<ConnTestResult> {
  // TCP connectivity check for MSSQL
  try {
    const conn = await Deno.connect({ hostname: params.host, port: params.port });
    conn.close();
    return {
      success: true,
      latency_ms: 0,
      server_version: "SQL Server (TCP reachable)",
    };
  } catch (e) {
    return { success: false, latency_ms: 0, error: `Cannot reach SQL Server at ${params.host}:${params.port} — ${(e as Error).message}` };
  }
}

async function testSnowflake(params: { host: string; port: number; database_name: string; username: string; password: string }): Promise<ConnTestResult> {
  // Snowflake uses HTTPS REST API — test connectivity via fetch
  try {
    const accountUrl = params.host.includes(".") ? `https://${params.host}` : `https://${params.host}.snowflakecomputing.com`;
    const resp = await fetch(`${accountUrl}/api/v2/login-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          ACCOUNT_NAME: params.host.split(".")[0],
          LOGIN_NAME: params.username,
          PASSWORD: params.password,
        },
      }),
    });
    const data = await resp.json();
    if (data.success) {
      return { success: true, latency_ms: 0, server_version: "Snowflake" };
    }
    return { success: false, latency_ms: 0, error: data.message || "Snowflake auth failed" };
  } catch (e) {
    return { success: false, latency_ms: 0, error: `Snowflake connection failed — ${(e as Error).message}` };
  }
}
