export type ConnectionType = "mssql" | "mysql" | "postgresql" | "snowflake";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "testing";

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  database_name: string;
  username: string;
  ssl_enabled: boolean;
  status: ConnectionStatus;
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
  username: string;
  password: string;
  ssl_enabled: boolean;
}

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  mssql: "Microsoft SQL Server",
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  snowflake: "Snowflake",
};

export const DEFAULT_PORTS: Record<ConnectionType, number> = {
  mssql: 1433,
  mysql: 3306,
  postgresql: 5432,
  snowflake: 443,
};
