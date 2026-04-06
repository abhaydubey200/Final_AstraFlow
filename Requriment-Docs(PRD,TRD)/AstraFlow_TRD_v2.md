# AstraFlow — Technical Requirements Document (TRD)
**Version:** 2.0.0 — Production Grade  
**Status:** Pre-Build Final  
**Author:** Abhay | AstraFlow Core  
**Date:** April 2026  
**Constraint:** 100% Free & Open Source — Zero licensing cost, Zero compromise on power

---

## WHAT CHANGED FROM v1 → v2

| Gap Identified | Fix Applied |
|---|---|
| In-memory full data load → OOM at scale | Stream + chunk-based execution engine |
| No checkpointing → full restart on failure | Node-level checkpoint state in PostgreSQL |
| No data validation layer | `validate_schema` node + type-coercion engine |
| Transform layer too shallow | Added Join, Aggregation, Derived Column nodes |
| Connection pooling not designed | Per-driver pool config with lifecycle management |
| Worker concurrency undefined | Queue priority + concurrency slots per pipeline |
| Data preview missing in builder | Preview API on every node mid-DAG |
| Missing DB indexes | Full index strategy defined |
| No structured logging | Winston (Node) + Loguru (Python) with correlation IDs |
| No metrics layer | Built-in `/metrics` API + Prometheus-ready hooks |

---

## 1. Technology Stack (Final — No Changes from v1)

| Layer | Technology | License |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | MIT |
| DAG Canvas | React Flow | MIT |
| State | Zustand | MIT |
| Data Fetching | React Query + Axios | MIT |
| Styling | Tailwind CSS | MIT |
| Backend API | Node.js 20 LTS + Fastify | MIT |
| ORM | Prisma | Apache 2.0 |
| Job Queue | BullMQ | MIT |
| Cache / Pub-Sub | Redis 7 OSS | BSD |
| Primary DB | PostgreSQL 16 | PostgreSQL License (free) |
| Execution Engine | Python 3.11 + FastAPI | MIT |
| File Storage | MinIO (self-hosted) | AGPL (self-hosted = free) |
| Auth | JWT (RS256) + bcrypt | MIT |
| Encryption | Node.js `crypto` (built-in) | — |
| Logging | Winston + Loguru | MIT |
| Container | Docker + Docker Compose | Apache 2.0 |
| Proxy | Nginx | BSD |

**Total licensing cost: $0**

---

## 2. System Architecture (v2 — Upgraded)

### 2.1 Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                            │
│  React 18 + React Flow + Zustand + React Query + Tailwind        │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ DAG Canvas│ │ Run Logs  │ │ Data Preview │ │  Monitoring │ │
│  │(React Flow│ │(WebSocket)│ │  (per node)  │ │  Dashboard  │ │
│  └───────────┘ └───────────┘ └──────────────┘ └─────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + WSS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CONTROL PLANE (Fastify API)                      │
│                                                                   │
│  Auth │ Connections │ Pipelines │ Runs │ Preview │ Scheduler     │
│  CRUD │ Pool Mgmt   │ DAG CRUD  │ Logs │ API     │ BullMQ cron   │
│                                                                   │
│  Security Layer:                                                  │
│  JWT auth → schema validation → rate limit → handler             │
└───────┬──────────────────────┬──────────────────────────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐   ┌──────────────────────────────────────────────┐
│ PostgreSQL 16 │   │              Redis 7 (OSS)                    │
│               │   │                                               │
│ pipelines     │   │  BullMQ Queues:                              │
│ connections   │   │   pipeline-executions (priority queue)        │
│ pipeline_runs │   │   preview-jobs (separate, lightweight)        │
│ run_steps     │   │                                               │
│ run_logs      │   │  Pub/Sub Channels:                           │
│ checkpoints   │   │   run:{id}:logs (live log stream)             │
│ schedules     │   │   run:{id}:step (step status updates)         │
│ audit_log     │   │                                               │
└───────────────┘   │  Cache Keys:                                  │
                    │   dashboard:metrics (TTL 30s)                 │
                    │   conn:{id}:schema (TTL 300s)                 │
                    │   preview:{node_hash} (TTL 60s)               │
                    └───────────────┬───────────────────────────────┘
                                    │ workers dequeue
                      ┌─────────────┴──────────────┐
                      ▼                             ▼
         ┌────────────────────────┐   ┌─────────────────────────────┐
         │   Node.js Worker       │   │    Python Worker (FastAPI)   │
         │                        │   │                              │
         │  Orchestration layer:  │   │  Heavy compute layer:        │
         │  - DAG topo sort       │   │  - Pandas transforms         │
         │  - Step dispatch       │   │  - Large CSV ingestion       │
         │  - Checkpoint R/W      │   │  - Join operations           │
         │  - Log emission        │   │  - Aggregations              │
         │  - Retry logic         │   │  - Schema validation         │
         │                        │   │  - Type coercion             │
         │  Handles:              │   │                              │
         │  - DB→DB (streaming)   │   │  Chunked streaming:          │
         │  - Schema ops          │   │  - Never loads full dataset  │
         │  - Simple transforms   │   │  - 10k rows per chunk        │
         └──────────┬─────────────┘   └──────────────┬──────────────┘
                    │                                 │
                    ▼                                 ▼
         ┌────────────────────────────────────────────────────┐
         │             CONNECTION POOL LAYER                   │
         │                                                     │
         │  PostgreSQL Pool   MySQL Pool   Snowflake Pool      │
         │  (pg-pool)         (mysql2)     (snowflake-sdk)     │
         │  max: 10           max: 10      max: 5              │
         │  idle: 5min        idle: 5min   idle: 2min          │
         └─────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     MinIO (File Store)       │
                    │  - Uploaded CSVs/JSONs        │
                    │  - Exported output files      │
                    │  - Pipeline DAG backups       │
                    │  - Checkpoint blobs (large)   │
                    └─────────────────────────────┘
```

---

### 2.2 Service Map

| Service | Port | Replicas (MVP) | Responsibility |
|---|---|---|---|
| `astra-frontend` | 3000 | 1 | React UI |
| `astra-api` | 4000 | 1 (→ 2+ later) | Control plane |
| `astra-worker-node` | internal | 2 | Orchestration + fast execution |
| `astra-worker-python` | 5000 | 1 (→ 2+ later) | Heavy transforms |
| `postgres` | 5432 | 1 | Metadata store |
| `redis` | 6379 | 1 | Queue + cache + pub/sub |
| `minio` | 9000/9001 | 1 | File storage |
| `nginx` | 80/443 | 1 | Reverse proxy + SSL |

---

## 3. Database Schema (v2 — Complete + Indexed)

```sql
-- ================================================================
-- EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- query monitoring

-- ================================================================
-- CONNECTIONS
-- ================================================================
CREATE TABLE connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  type          VARCHAR(50)  NOT NULL,
  -- type values: postgresql | mysql | mssql | oracle | snowflake | mongodb | csv | json
  config        JSONB        NOT NULL,  -- AES-256-GCM encrypted blob (see §8)
  status        VARCHAR(20)  NOT NULL DEFAULT 'untested',
  -- status values: healthy | error | untested
  error_message TEXT,                  -- last test error if status = error
  last_tested   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- PIPELINES
-- ================================================================
CREATE TABLE pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  dag_config      JSONB        NOT NULL,  -- full node/edge graph (see §6)
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
  -- status values: draft | active | paused | archived
  version         INTEGER      NOT NULL DEFAULT 1,
  version_history JSONB        NOT NULL DEFAULT '[]',
  -- stores last 5 dag_config snapshots: [{ version, dag_config, saved_at }]
  tags            TEXT[]       DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ================================================================
-- PIPELINE RUNS
-- ================================================================
CREATE TABLE pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  pipeline_version INTEGER     NOT NULL,  -- snapshot version when run was triggered
  triggered_by    VARCHAR(20)  NOT NULL,  -- manual | schedule | api
  status          VARCHAR(20)  NOT NULL DEFAULT 'queued',
  -- status: queued | running | success | failed | cancelled | partial
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  rows_processed  BIGINT       DEFAULT 0,
  error_message   TEXT,
  retry_count     INTEGER      DEFAULT 0,
  parent_run_id   UUID         REFERENCES pipeline_runs(id), -- for retries
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_pipeline_id    ON pipeline_runs(pipeline_id, created_at DESC);
CREATE INDEX idx_runs_status         ON pipeline_runs(status) WHERE status IN ('queued', 'running');

-- ================================================================
-- RUN STEPS (per-node execution state)
-- ================================================================
CREATE TABLE run_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID         NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  node_id         VARCHAR(100) NOT NULL,  -- matches DAG node id
  node_type       VARCHAR(50)  NOT NULL,
  node_label      VARCHAR(255),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- status: pending | running | success | failed | skipped
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  rows_in         BIGINT,
  rows_out        BIGINT,
  error_message   TEXT,
  error_stack     TEXT,
  execution_order INTEGER      NOT NULL  -- topological sort position
);

CREATE INDEX idx_steps_run_id        ON run_steps(run_id, execution_order);
CREATE INDEX idx_steps_status        ON run_steps(run_id, status);

-- ================================================================
-- RUN LOGS (granular log lines, streamed from workers)
-- ================================================================
CREATE TABLE run_logs (
  id              BIGSERIAL PRIMARY KEY,
  run_id          UUID         NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  step_id         UUID         REFERENCES run_steps(id) ON DELETE CASCADE,
  level           VARCHAR(10)  NOT NULL,  -- DEBUG | INFO | WARN | ERROR
  message         TEXT         NOT NULL,
  metadata        JSONB,                  -- optional: { rows_chunk, memory_mb, etc. }
  logged_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_run_id         ON run_logs(run_id, logged_at);
CREATE INDEX idx_logs_step_id        ON run_logs(step_id, logged_at);
-- Partial index for errors only (fast error lookup)
CREATE INDEX idx_logs_errors         ON run_logs(run_id, logged_at) WHERE level = 'ERROR';

-- Auto-partition run_logs by month (future — set up partitioning when > 10M rows)

-- ================================================================
-- CHECKPOINTS (v2 NEW — enables node-level retry)
-- ================================================================
CREATE TABLE run_checkpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID         NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  node_id         VARCHAR(100) NOT NULL,
  -- Checkpoint stores the output of a completed node
  -- Small data (<1MB): stored inline in JSONB
  -- Large data: stored in MinIO, path stored here
  data_type       VARCHAR(20)  NOT NULL,  -- inline | minio
  data_inline     JSONB,                  -- used when data_type = inline
  data_minio_path TEXT,                   -- used when data_type = minio
  row_count       BIGINT,
  schema_snapshot JSONB,                  -- { columns: [{name, type}] }
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, node_id)
);

CREATE INDEX idx_checkpoints_run     ON run_checkpoints(run_id, node_id);

-- ================================================================
-- SCHEDULES
-- ================================================================
CREATE TABLE schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  cron_expr       VARCHAR(100) NOT NULL,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  miss_count      INTEGER      DEFAULT 0,  -- missed runs during downtime
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id)
);

-- ================================================================
-- AUDIT LOG
-- ================================================================
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  action          VARCHAR(100) NOT NULL,
  -- e.g. connection.create | pipeline.run | schedule.toggle
  entity_type     VARCHAR(50),
  entity_id       UUID,
  payload         JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity        ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_created       ON audit_log(created_at DESC);

-- ================================================================
-- SYSTEM CONFIG (key-value store for platform settings)
-- ================================================================
CREATE TABLE system_config (
  key             VARCHAR(100) PRIMARY KEY,
  value           JSONB        NOT NULL,
  description     TEXT,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO system_config(key, value, description) VALUES
  ('log_retention_days', '30', 'Days to retain run logs'),
  ('max_concurrent_runs', '5', 'Max parallel pipeline executions'),
  ('preview_row_limit', '100', 'Max rows returned in data preview'),
  ('chunk_size', '10000', 'Rows per processing chunk in execution engine');
```

---

## 4. Connection Pool Layer (Properly Designed)

Every driver maintains its own pool. The pool is initialized once at API startup and reused across all requests and workers.

```typescript
// packages/api/src/lib/pool-manager.ts

import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';

interface PoolConfig {
  max: number;           // max connections in pool
  min: number;           // min idle connections
  idleTimeoutMs: number; // evict idle connections after N ms
  acquireTimeoutMs: number; // throw if no connection available after N ms
}

const POOL_DEFAULTS: PoolConfig = {
  max: 10,
  min: 2,
  idleTimeoutMs: 300_000,   // 5 minutes
  acquireTimeoutMs: 10_000, // 10 seconds
};

// Pool registry: keyed by connection ID
const pgPools = new Map<string, PgPool>();
const mysqlPools = new Map<string, mysql.Pool>();

export async function getPool(connectionId: string, config: DecryptedConfig) {
  switch (config.type) {
    case 'postgresql': {
      if (!pgPools.has(connectionId)) {
        pgPools.set(connectionId, new PgPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          max: POOL_DEFAULTS.max,
          idleTimeoutMillis: POOL_DEFAULTS.idleTimeoutMs,
          connectionTimeoutMillis: POOL_DEFAULTS.acquireTimeoutMs,
          ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        }));
      }
      return pgPools.get(connectionId)!;
    }
    case 'mysql': {
      if (!mysqlPools.has(connectionId)) {
        mysqlPools.set(connectionId, mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          connectionLimit: POOL_DEFAULTS.max,
          idleTimeout: POOL_DEFAULTS.idleTimeoutMs,
          connectTimeout: POOL_DEFAULTS.acquireTimeoutMs,
        }));
      }
      return mysqlPools.get(connectionId)!;
    }
    // ... snowflake, mongodb, etc.
  }
}

// Call on connection DELETE to release pool
export async function destroyPool(connectionId: string) {
  const pgPool = pgPools.get(connectionId);
  if (pgPool) { await pgPool.end(); pgPools.delete(connectionId); }

  const mysqlPool = mysqlPools.get(connectionId);
  if (mysqlPool) { await mysqlPool.end(); mysqlPools.delete(connectionId); }
}
```

---

## 5. Driver Interface (Standardized — v2)

Every connector implements this interface. This is what makes the system extensible without changing the execution engine.

```typescript
// packages/worker/src/drivers/interface.ts

export interface DriverConfig {
  type: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  // file-specific
  filePath?: string;
  fileType?: 'csv' | 'json';
}

export interface ColumnMeta {
  name: string;
  type: string;        // normalized: string | number | boolean | date | json
  nullable: boolean;
  primaryKey?: boolean;
}

export interface SchemaInfo {
  tables: string[];
}

export interface TableSchema {
  table: string;
  columns: ColumnMeta[];
  rowCount?: number;   // estimated, not exact
}

// CRITICAL: All data flows as Node.js Readable streams
// Never as full arrays — this is the fix for in-memory OOM
export interface IDriver {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;                    // for test connection

  // Schema ops
  getSchema(): Promise<SchemaInfo>;
  getTableSchema(table: string): Promise<TableSchema>;

  // READ — returns async generator, yields chunks of rows
  // chunkSize: how many rows per chunk (default 10,000)
  streamQuery(
    sql: string,
    params: unknown[],
    chunkSize: number
  ): AsyncGenerator<Record<string, unknown>[]>;

  // READ convenience: full table stream
  streamTable(
    table: string,
    chunkSize: number
  ): AsyncGenerator<Record<string, unknown>[]>;

  // WRITE — batch insert/upsert
  batchInsert(
    table: string,
    rows: Record<string, unknown>[],
    options: { writeMode: 'insert' | 'upsert'; primaryKey?: string }
  ): Promise<{ inserted: number; updated: number }>;

  // Preview (limit enforced at driver level)
  previewTable(
    table: string,
    limit: number
  ): Promise<Record<string, unknown>[]>;
}
```

---

## 6. Pipeline DAG — JSON Schema (v2)

```typescript
// Full TypeScript interface for DAG config
interface DAGConfig {
  schemaVersion: '2.0';
  nodes: DAGNode[];
  edges: DAGEdge[];
}

interface DAGNode {
  id: string;           // unique within pipeline, stable across edits
  type: NodeType;
  label: string;        // user-facing name
  position: { x: number; y: number };
  config: NodeConfig;   // type-specific (see below)
}

interface DAGEdge {
  id: string;
  source: string;       // node id
  target: string;       // node id
  sourceHandle?: string;
  targetHandle?: string;
}

// ================================================================
// NODE TYPE REGISTRY
// ================================================================

type NodeType =
  // Sources
  | 'source_db_table'
  | 'source_query'
  | 'source_file'
  // Transforms
  | 'transform_filter'
  | 'transform_select'
  | 'transform_rename'
  | 'transform_sql'
  | 'transform_join'         // v2 NEW
  | 'transform_aggregate'    // v2 NEW
  | 'transform_derive'       // v2 NEW
  | 'transform_validate'     // v2 NEW — schema validation gate
  // Destinations
  | 'destination_db_table'
  | 'destination_file';

// ================================================================
// NODE CONFIG TYPES
// ================================================================

interface SourceDBTableConfig {
  connectionId: string;
  table: string;
  mode: 'full_refresh' | 'incremental';
  incrementalKey?: string;      // e.g. 'updated_at'
  incrementalLastValue?: string; // stored after each successful run
  chunkSize?: number;           // default 10000
  whereClause?: string;         // optional filter at source
}

interface SourceQueryConfig {
  connectionId: string;
  sql: string;
  chunkSize?: number;
}

interface TransformFilterConfig {
  condition: string;    // e.g. "status = 'active' AND amount > 0"
}

interface TransformSelectConfig {
  columns: string[];
}

interface TransformRenameConfig {
  mappings: { from: string; to: string }[];
}

interface TransformSQLConfig {
  sql: string;          // references input as 'input' table
}

// v2 NEW — Join node
interface TransformJoinConfig {
  rightConnectionId: string;
  rightTable: string;
  joinType: 'inner' | 'left' | 'right' | 'full';
  leftKey: string;
  rightKey: string;
  selectRight?: string[];   // which columns to bring from right side
}

// v2 NEW — Aggregation node
interface TransformAggregateConfig {
  groupBy: string[];
  aggregations: {
    column: string;
    function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
    alias: string;
  }[];
}

// v2 NEW — Derived column node
interface TransformDeriveConfig {
  derivations: {
    name: string;
    expression: string;   // e.g. "price * quantity" or "UPPER(name)"
  }[];
}

// v2 NEW — Schema validation gate (stops pipeline if invalid)
interface TransformValidateConfig {
  rules: {
    column: string;
    checks: ('not_null' | 'positive' | 'unique' | 'is_email' | 'is_date')[];
  }[];
  onFailure: 'stop' | 'warn' | 'drop_rows';
}

interface DestinationDBTableConfig {
  connectionId: string;
  table: string;
  writeMode: 'insert' | 'upsert' | 'overwrite';
  primaryKey?: string;          // required for upsert
  createIfNotExists?: boolean;
  columnMapping?: { from: string; to: string }[];
}
```

---

## 7. Execution Engine (v2 — Stream + Checkpoint Architecture)

### 7.1 Core Principle

```
❌ v1 (broken at scale):
source.fetchAll() → array in memory → transform(array) → write(array)

✅ v2 (production):
source.stream() → chunk[10k] → transform(chunk) → write(chunk) → next chunk
```

No full dataset ever lives in memory. This handles 100M+ rows with flat memory usage.

### 7.2 Execution Flow (Step-by-Step)

```
API: POST /pipelines/:id/run
  │
  ├─ 1. Create pipeline_run record (status: queued)
  ├─ 2. Snapshot current dag_config onto run record
  ├─ 3. Enqueue job to BullMQ with { runId, pipelineId }
  └─ 4. Return { runId } immediately (non-blocking)

BullMQ Worker picks up job
  │
  ├─ 5. Load pipeline_run + dag_config from PostgreSQL
  ├─ 6. Topological sort nodes → ordered execution plan
  ├─ 7. Check existing checkpoints (for retry runs)
  │     → skip nodes that already have a checkpoint
  │
  └─ 8. Execute nodes in order:
         for each node:
           ├─ Create run_step record (status: running)
           ├─ Emit log: "Starting node {label}"
           ├─ Check if checkpoint exists → skip if yes
           ├─ Execute node handler (see §7.3)
           │    ├─ Streams data through
           │    ├─ Emits progress logs every N chunks
           │    └─ Passes output to next node via temp channel
           ├─ On success:
           │    ├─ Update run_step (status: success, rows_in, rows_out)
           │    └─ Write checkpoint (inline or MinIO)
           └─ On failure:
                ├─ Update run_step (status: failed, error_message, error_stack)
                ├─ Emit error log
                ├─ If retry_count < max_retries: re-enqueue with checkpoint
                └─ If max retries exceeded: mark run FAILED, stop
```

### 7.3 Node Handler Interface

```typescript
// packages/worker/src/engine/node-handler.interface.ts

export interface ExecutionContext {
  runId: string;
  stepId: string;
  nodeId: string;
  chunkSize: number;
  log: (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: object) => Promise<void>;
  emitProgress: (rowsProcessed: number) => void;
  getCheckpoint: (nodeId: string) => Promise<Checkpoint | null>;
  writeCheckpoint: (nodeId: string, data: unknown, schema: ColumnMeta[]) => Promise<void>;
}

// Input/output are always async generators (streams)
export interface INodeHandler {
  execute(
    input: AsyncGenerator<Row[]> | null,   // null for source nodes
    config: unknown,
    context: ExecutionContext
  ): AsyncGenerator<Row[]>;  // returns stream for next node
}
```

### 7.4 Source Node Handler Example (Streaming)

```typescript
// packages/worker/src/handlers/source-db-table.handler.ts

export class SourceDBTableHandler implements INodeHandler {
  async *execute(
    input: null,
    config: SourceDBTableConfig,
    ctx: ExecutionContext
  ): AsyncGenerator<Row[]> {
    const driver = await DriverRegistry.get(config.connectionId);
    let totalRows = 0;

    // Incremental load: fetch watermark from last run
    let whereClause = config.whereClause || '';
    if (config.mode === 'incremental' && config.incrementalKey && config.incrementalLastValue) {
      whereClause += ` AND ${config.incrementalKey} > '${config.incrementalLastValue}'`;
      await ctx.log('INFO', `Incremental mode: fetching rows since ${config.incrementalLastValue}`);
    }

    const sql = `SELECT * FROM ${config.table} ${whereClause ? 'WHERE ' + whereClause : ''}`;

    // Stream chunks — never load full table
    for await (const chunk of driver.streamQuery(sql, [], ctx.chunkSize)) {
      totalRows += chunk.length;
      ctx.emitProgress(totalRows);
      await ctx.log('INFO', `Fetched chunk: ${totalRows} rows processed`);
      yield chunk;  // pass chunk to next node
    }

    await ctx.log('INFO', `Source complete. Total rows: ${totalRows}`);
  }
}
```

### 7.5 Transform Node Handler Example (Pass-Through Stream)

```typescript
// packages/worker/src/handlers/filter.handler.ts

export class FilterTransformHandler implements INodeHandler {
  async *execute(
    input: AsyncGenerator<Row[]>,
    config: TransformFilterConfig,
    ctx: ExecutionContext
  ): AsyncGenerator<Row[]> {
    // Build filter function from condition string
    // Safe evaluation via a restricted expression parser (not eval())
    const filterFn = buildFilterFunction(config.condition);

    let totalIn = 0;
    let totalOut = 0;

    for await (const chunk of input) {
      totalIn += chunk.length;
      const filtered = chunk.filter(filterFn);
      totalOut += filtered.length;

      if (filtered.length > 0) {
        yield filtered;
      }

      await ctx.log('INFO', `Filter: ${totalIn} in → ${totalOut} out`);
    }
  }
}
```

### 7.6 Destination Node Handler Example (Chunked Write)

```typescript
// packages/worker/src/handlers/destination-db-table.handler.ts

export class DestinationDBTableHandler implements INodeHandler {
  async *execute(
    input: AsyncGenerator<Row[]>,
    config: DestinationDBTableConfig,
    ctx: ExecutionContext
  ): AsyncGenerator<Row[]> {
    const driver = await DriverRegistry.get(config.connectionId);
    let totalWritten = 0;

    for await (const chunk of input) {
      // Apply column mapping if configured
      const mapped = config.columnMapping
        ? applyColumnMapping(chunk, config.columnMapping)
        : chunk;

      // Write chunk (insert or upsert)
      const result = await driver.batchInsert(config.table, mapped, {
        writeMode: config.writeMode,
        primaryKey: config.primaryKey,
      });

      totalWritten += result.inserted + result.updated;
      await ctx.log('INFO',
        `Written chunk: ${result.inserted} inserted, ${result.updated} updated. Total: ${totalWritten}`
      );

      yield chunk;  // pass through for potential downstream nodes
    }
  }
}
```

### 7.7 Checkpoint System (Node-Level Retry)

```typescript
// When retrying a failed run:
// 1. Load existing checkpoints for the run
// 2. Skip all nodes with a checkpoint
// 3. Resume from the failed node (or its immediate predecessor)

async function executeWithCheckpoint(
  node: DAGNode,
  input: AsyncGenerator<Row[]>,
  ctx: ExecutionContext
): Promise<AsyncGenerator<Row[]>> {
  const existing = await ctx.getCheckpoint(node.id);

  if (existing) {
    // Node already completed in a previous attempt — replay from checkpoint
    ctx.log('INFO', `Node ${node.id} skipped (checkpoint found)`);
    return checkpointToStream(existing);  // re-emit checkpoint data as stream
  }

  // Execute normally and checkpoint output
  const handler = NodeHandlerRegistry.get(node.type);
  const output = handler.execute(input, node.config, ctx);
  return checkpointingStream(output, node.id, ctx);
}

// Wraps a stream to save output to checkpoint while passing through
async function* checkpointingStream(
  source: AsyncGenerator<Row[]>,
  nodeId: string,
  ctx: ExecutionContext
): AsyncGenerator<Row[]> {
  const buffer: Row[] = [];

  for await (const chunk of source) {
    buffer.push(...chunk);
    yield chunk;
  }

  // After full stream consumed, write checkpoint
  if (buffer.length <= 50_000) {
    // Small: store inline in PostgreSQL
    await ctx.writeCheckpoint(nodeId, buffer, 'inline');
  } else {
    // Large: write to MinIO as JSON/Parquet
    const path = await uploadToMinio(buffer, nodeId, ctx.runId);
    await ctx.writeCheckpoint(nodeId, path, 'minio');
  }
}
```

---

## 8. Data Preview API (v2 NEW)

Preview is available on every node in the DAG Builder — not just source nodes. This is the "killer feature" that makes AstraFlow developer-first.

### 8.1 How It Works

```
User clicks "Preview" on a node in DAG Canvas
  │
  ├─ Frontend sends: POST /pipelines/:id/preview
  │   with: { upToNodeId: "node-3" }
  │
  ├─ API enqueues a lightweight preview job (separate queue: "preview-jobs")
  │   Preview jobs:
  │   - Use limit: 200 rows max
  │   - No checkpointing
  │   - No destination writes
  │   - Timeout: 30 seconds
  │
  ├─ Preview job runs source → transforms up to target node
  │   (stops before destination nodes)
  │
  ├─ Result cached in Redis for 60s (keyed by hash of node config)
  │
  └─ Frontend polls GET /pipelines/:id/preview/:jobId
       → returns { columns, rows, inferredSchema, validationSummary }
```

### 8.2 Preview Response Schema

```typescript
interface PreviewResult {
  jobId: string;
  status: 'pending' | 'ready' | 'error';
  data?: {
    columns: { name: string; type: string; nullable: boolean }[];
    rows: Record<string, unknown>[];    // max 200
    totalRowsInSample: number;          // how many rows were sampled
    inferredSchema: ColumnMeta[];       // AstraFlow's type inference
    validationSummary?: {               // if validate node present upstream
      passed: number;
      failed: number;
      issues: { column: string; rule: string; count: number }[];
    };
  };
  error?: string;
  cachedAt?: string;
}
```

---

## 9. Queue Design (Concurrency + Priority)

### 9.1 Queue Configuration

```typescript
// packages/worker/src/queues/index.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';

const connection = { host: process.env.REDIS_HOST, port: 6379, password: process.env.REDIS_PASSWORD };

// Main execution queue — heavy, long-running
export const pipelineQueue = new Queue('pipeline-executions', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// Preview queue — lightweight, short TTL
export const previewQueue = new Queue('preview-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

// Worker concurrency: 3 pipelines max in parallel
export const pipelineWorker = new Worker(
  'pipeline-executions',
  processPipelineJob,
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
    limiter: {
      max: 10,          // max 10 jobs per duration window
      duration: 60_000, // per minute
    },
  }
);

// Preview worker: higher concurrency, short timeout
export const previewWorker = new Worker(
  'preview-jobs',
  processPreviewJob,
  {
    connection,
    concurrency: 5,
  }
);
```

### 9.2 Job Priority

```typescript
// High priority: user-triggered manual runs
await pipelineQueue.add('run', jobData, { priority: 1 });

// Normal priority: scheduled runs
await pipelineQueue.add('run', jobData, { priority: 2 });

// Low priority: retry runs
await pipelineQueue.add('run', jobData, { priority: 3 });
```

---

## 10. Credential Encryption (AES-256-GCM)

```typescript
// packages/api/src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ASTRA_ENCRYPTION_KEY!;  // 64-char hex = 32 bytes

if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error('ASTRA_ENCRYPTION_KEY must be 64 hex chars. Run: openssl rand -hex 32');
}

const KEY = Buffer.from(KEY_HEX, 'hex');

export interface EncryptedBlob {
  iv: string;    // 32-char hex
  tag: string;   // 32-char hex
  data: string;  // hex-encoded ciphertext
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const blob: EncryptedBlob = {
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    data: encrypted.toString('hex'),
  };

  return JSON.stringify(blob);
}

export function decrypt(ciphertext: string): string {
  const { iv, tag, data }: EncryptedBlob = JSON.parse(ciphertext);
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// Usage:
// Store: connections.config = encrypt(JSON.stringify(rawCredentials))
// Read:  const creds = JSON.parse(decrypt(connection.config))
```

---

## 11. Structured Logging (Correlation IDs)

Every log line carries a `correlationId` so you can trace a request from API → worker → Python worker in one query.

```typescript
// packages/api/src/lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { service: 'astra-api' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Every request gets a correlationId
// Fastify plugin:
fastify.addHook('onRequest', (req, reply, done) => {
  req.correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  reply.header('x-correlation-id', req.correlationId);
  done();
});

// Worker log emission (also writes to DB)
export async function emitLog(
  runId: string,
  stepId: string | null,
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: object
): Promise<void> {
  // 1. Structured log to file/console
  logger.log(level.toLowerCase(), message, { runId, stepId, ...meta });

  // 2. Write to run_logs table (queryable via UI)
  await db.run_logs.create({ data: { runId, stepId, level, message, metadata: meta } });

  // 3. Publish to Redis for live streaming
  await redis.publish(`run:${runId}:logs`, JSON.stringify({
    level, message, stepId, loggedAt: new Date().toISOString(), ...meta
  }));
}
```

---

## 12. Metrics API (Built-in, Prometheus-Ready)

```typescript
// GET /api/v1/metrics — returns platform health
// GET /api/v1/metrics/prometheus — Prometheus text format (future)

interface PlatformMetrics {
  queues: {
    pipelineExecutions: { waiting: number; active: number; completed: number; failed: number };
    previewJobs: { waiting: number; active: number };
  };
  database: {
    poolSize: number;
    idleConnections: number;
    pendingAcquires: number;
  };
  runs: {
    last24h: { total: number; success: number; failed: number; successRate: number };
    avgDurationMs: number;
  };
  system: {
    uptimeSeconds: number;
    memoryMb: number;
    nodeVersion: string;
    apiVersion: string;
  };
}

// Dashboard metrics are cached in Redis for 30s
// Key: dashboard:metrics  TTL: 30
```

---

## 13. API Security Layer

Every route passes through this chain:

```
Request
  │
  ├─ 1. Nginx rate limit (100 req/min per IP)
  ├─ 2. JWT verification (RS256)
  ├─ 3. Fastify JSON Schema validation (per-route)
  ├─ 4. @fastify/rate-limit (100 req/min per token)
  ├─ 5. @fastify/helmet (security headers)
  └─ 6. Route handler
```

```typescript
// Fastify security plugins
await fastify.register(import('@fastify/helmet'));
await fastify.register(import('@fastify/cors'), {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});
await fastify.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.id || req.ip,
});

// Route-level schema validation example:
fastify.post('/connections', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'type', 'config'],
      properties: {
        name:   { type: 'string', minLength: 1, maxLength: 255 },
        type:   { type: 'string', enum: ['postgresql', 'mysql', 'mssql', 'oracle', 'snowflake', 'mongodb', 'csv', 'json'] },
        config: { type: 'object' },
      },
      additionalProperties: false,
    },
  },
}, createConnectionHandler);
```

---

## 14. Frontend Architecture (v2)

### 14.1 New Components Added

```
src/
├── components/
│   ├── pipeline/
│   │   ├── nodes/
│   │   │   ├── SourceDBTableNode.tsx
│   │   │   ├── FilterNode.tsx
│   │   │   ├── JoinNode.tsx          ← v2 NEW
│   │   │   ├── AggregateNode.tsx     ← v2 NEW
│   │   │   ├── DeriveNode.tsx        ← v2 NEW
│   │   │   ├── ValidateNode.tsx      ← v2 NEW
│   │   │   └── DestinationNode.tsx
│   │   ├── NodeConfigPanel.tsx       ← right sidebar, per-node config
│   │   ├── PreviewPanel.tsx          ← v2 NEW: inline data preview
│   │   ├── DAGValidator.ts           ← client-side DAG validation
│   │   └── PipelineCanvas.tsx        ← React Flow wrapper
│   └── monitoring/
│       ├── RunTimeline.tsx           ← node-level execution timeline
│       ├── LiveLogStream.tsx         ← WebSocket log viewer
│       └── ErrorHighlight.tsx        ← v2 NEW: red node on failure
```

### 14.2 Error Highlighting on Nodes

```typescript
// When a run fails, fetch which node failed
// Apply 'failed' class to that node in React Flow

const nodeStatuses = useRunStepStatuses(runId);

const nodesWithStatus = nodes.map(node => ({
  ...node,
  className: nodeStatuses[node.id] === 'failed'  ? 'node-failed'
           : nodeStatuses[node.id] === 'running' ? 'node-running'
           : nodeStatuses[node.id] === 'success' ? 'node-success'
           : '',
}));
```

### 14.3 Pipeline Debug Mode

Debug mode allows step-by-step manual execution with preview at each step.

```typescript
// Toggle: Debug Mode ON/OFF in pipeline builder toolbar

// In debug mode:
// 1. Run stops at each node after completion
// 2. Preview panel shows output of completed node
// 3. User clicks "Continue" to proceed to next node
// 4. User can abort at any node

interface DebugSession {
  runId: string;
  currentNodeId: string;
  status: 'paused' | 'stepping' | 'complete';
  completedNodes: string[];
  previews: Record<string, PreviewResult>;  // nodeId → preview
}
```

---

## 15. Docker Compose (Complete — Production Grade)

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - frontend

  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    environment:
      - VITE_API_URL=http://localhost/api
      - VITE_WS_URL=ws://localhost/ws
    restart: unless-stopped

  api:
    build:
      context: ./packages/api
      dockerfile: Dockerfile
    env_file: .env
    environment:
      - NODE_ENV=production
      - PORT=4000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker-node:
    build:
      context: ./packages/worker
      dockerfile: Dockerfile
    env_file: .env
    environment:
      - WORKER_CONCURRENCY=3
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2    # run 2 worker instances

  worker-python:
    build:
      context: ./packages/python-worker
      dockerfile: Dockerfile
    env_file: .env
    environment:
      - PORT=5000
      - CHUNK_SIZE=10000
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       astraflow
      POSTGRES_USER:     astra
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U astra -d astraflow"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER:     ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9001:9001"   # Console (dev only — remove in prod)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  pg_data:
  redis_data:
  minio_data:
```

---

## 16. Environment Variables (Complete)

```bash
# ── DATABASE ──────────────────────────────────────────
DATABASE_URL=postgresql://astra:${PG_PASSWORD}@postgres:5432/astraflow
PG_PASSWORD=<strong-random-password>

# ── REDIS ─────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<strong-random-password>

# ── SECURITY ──────────────────────────────────────────
# Generate: openssl rand -hex 32
ASTRA_ENCRYPTION_KEY=<64-char-hex>

# Generate: openssl rand -hex 64
JWT_SECRET=<128-char-random>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ── MINIO ─────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=${MINIO_USER}
MINIO_SECRET_KEY=${MINIO_PASSWORD}
MINIO_BUCKET_FILES=astraflow-files
MINIO_BUCKET_CHECKPOINTS=astraflow-checkpoints
MINIO_USER=<username>
MINIO_PASSWORD=<strong-password>

# ── WORKERS ───────────────────────────────────────────
WORKER_CONCURRENCY=3
CHUNK_SIZE=10000
MAX_PREVIEW_ROWS=200
PREVIEW_TIMEOUT_MS=30000
PYTHON_WORKER_URL=http://worker-python:5000

# ── APP ───────────────────────────────────────────────
NODE_ENV=production
API_PORT=4000
LOG_LEVEL=info
LOG_RETENTION_DAYS=30
ALLOWED_ORIGINS=http://localhost:3000

# ── ADMIN (first run only) ────────────────────────────
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
```

---

## 17. Build Order (Sprint-Level)

### Sprint 1 — Foundation (Week 1–2)
- [ ] Monorepo setup with pnpm workspaces
- [ ] Docker Compose: PG + Redis + MinIO all healthy
- [ ] Prisma schema + all migrations applied
- [ ] Fastify API: health endpoint, JWT auth, CORS, helmet
- [ ] React app: routing, auth pages, protected routes
- [ ] Pool manager initialized on API startup
- [ ] Winston logger with correlationId in all routes

### Sprint 2 — Connections (Week 3)
- [ ] Driver interface + all 7 drivers implemented
- [ ] Connection CRUD API (encrypt/decrypt on write/read)
- [ ] Test connection endpoint (ping + auth)
- [ ] Schema browser endpoint (tables + columns)
- [ ] Table preview endpoint (limit 100)
- [ ] Frontend: Connections list + new/edit modal

### Sprint 3 — Pipeline Builder (Week 4–5)
- [ ] Pipeline CRUD API + DAG JSON schema validation
- [ ] All node config types defined (TypeScript interfaces)
- [ ] React Flow canvas with all node types
- [ ] Node config panel (right sidebar, per-type forms)
- [ ] Client-side DAG validation (cycle detection, completeness)
- [ ] Save + version history
- [ ] "Unsaved changes" guard

### Sprint 4 — Execution Engine (Week 6–7)
- [ ] BullMQ queue setup (pipeline-executions + preview-jobs)
- [ ] Node.js worker: topological sort + node dispatch
- [ ] All node handlers (source, transforms, destination)
- [ ] Streaming chunk architecture (not in-memory)
- [ ] Checkpoint write/read system
- [ ] Python worker: FastAPI + pandas transforms + join/aggregate
- [ ] Log emission (DB + Redis pub/sub)
- [ ] Retry from checkpoint

### Sprint 5 — Monitoring + Preview (Week 8)
- [ ] Run history API + frontend page
- [ ] Run detail view (step timeline + error trace)
- [ ] WebSocket server (live log streaming)
- [ ] Live log viewer in frontend
- [ ] Error node highlighting in DAG canvas
- [ ] Preview API (per-node, cached)
- [ ] Preview panel in pipeline builder
- [ ] Dashboard metrics API (cached, real-time)

### Sprint 6 — Scheduler + Polish (Week 9–10)
- [ ] BullMQ repeatable jobs for cron schedules
- [ ] Cron expression validation + human-readable preview
- [ ] Missed run tracking
- [ ] Data catalog (schema + preview)
- [ ] Pipeline debug mode (step-through)
- [ ] Settings page (config, retention, system status)
- [ ] End-to-end test: MySQL → Filter → Join → Snowflake

---

## 18. What This Scales To (Without Rewriting)

| Scale Point | How AstraFlow handles it |
|---|---|
| 100M+ row tables | Chunk-based streaming — flat memory usage |
| 50 concurrent pipelines | BullMQ concurrency config + more workers |
| Pipeline failures | Checkpoint system — retry from failed node only |
| Slow transforms | Delegate to Python worker — add replicas |
| Large file uploads | MinIO — stream upload, no RAM load |
| High log volume | PostgreSQL partitioning on run_logs by month |
| Multi-user (Phase 4) | Add `org_id` column to all tables — schema already ready |
| Observability | Prometheus endpoint already hooked — add Grafana |
| Big data (Phase 5) | Python worker → swap pandas for PySpark — same interface |

---

*End of TRD v2.0.0 — Production Grade*
