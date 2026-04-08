export type ConnectionType = "mssql" | "mysql" | "postgresql" | "snowflake" | "mongodb" | "oracle";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "testing";

export interface ConnectionCapabilities {
  supports_cdc: boolean;
  supports_incremental: boolean;
  supports_parallel_reads: boolean;
  supports_transactions: boolean;
  max_connections: number;
}

export interface ConnectionPerformance {
  avg_latency_ms: number;
  avg_query_time_ms: number;
  requests_per_minute: number;
  error_rate: number;
}

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  database_name: string;
  schema_name?: string;
  warehouse_name?: string;
  username: string;
  ssl_enabled: boolean;
  status: ConnectionStatus;
  security_level: "standard" | "high";
  capabilities?: ConnectionCapabilities;
  performance?: ConnectionPerformance;
  selected_tables: string[];
  config: Record<string, unknown>;
  last_tested_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionFormData {
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  database_name: string;
  schema_name?: string;
  warehouse_name?: string;
  username: string;
  password: string;
  ssl_enabled: boolean;
  security_level: "standard" | "high";
  timeout_seconds: number;
  selected_tables?: string[];
  config?: Record<string, unknown>;
  uri?: string;
  file_path?: string;
}

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  mssql: "Microsoft SQL Server",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  snowflake: "Snowflake",
  mongodb: "MongoDB",
  oracle: "Oracle Database",
};

export const DEFAULT_PORTS: Record<ConnectionType, number> = {
  mssql: 1433,
  mysql: 3306,
  postgresql: 5432,
  snowflake: 443,
  mongodb: 27017,
  oracle: 1521,
};
