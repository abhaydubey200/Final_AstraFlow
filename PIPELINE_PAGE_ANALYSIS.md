# 🎯 PIPELINE UI FRONTEND ANALYSIS - COMPLETE TECHNICAL BLUEPRINT

**Date:** 2026-04-08  
**Analyst:** Senior Frontend + Data Platform Architect  
**Scope:** Pipeline Page Complete Frontend Audit  
**Status:** ✅ Analysis Complete - Backend Ready

---

## 1. 🧱 PIPELINE UI ARCHITECTURE

### **Routing Structure**
```
/pipelines              → Pipelines.tsx (List View)
/pipelines/new          → PipelineBuilderPage.tsx (Create Mode)
/pipelines/:id          → PipelineDetail.tsx (Detail View)
/pipelines/:id/edit     → PipelineBuilderPage.tsx (Edit Mode)
```

### **Component Hierarchy**
```
App.tsx
└── AppLayout
    └── Pages
        ├── Pipelines.tsx (List/Grid View)
        ├── PipelineBuilderPage.tsx (Builder Wrapper)
        │   └── PipelineBuilder.tsx (Main Canvas Container)
        │       ├── Toolbar.tsx (Node Type Buttons + Zoom)
        │       ├── Canvas.tsx (SVG DAG Canvas)
        │       │   ├── CanvasNode.tsx (Individual Node)
        │       │   └── CanvasEdge.tsx (Connections)
        │       └── NodeInspector.tsx (Config Panel)
        │           ├── SourceNodeConfig.tsx
        │           ├── TransformNodeConfig.tsx
        │           ├── FilterNodeConfig.tsx
        │           ├── ValidateNodeConfig.tsx
        │           ├── LoadNodeConfig.tsx
        │           └── ColumnMappingConfig.tsx
        └── PipelineDetail.tsx (Detail/Run View)
            ├── VersionHistory.tsx
            ├── ExecutionTimeline.tsx
            └── WorkerStatusCard.tsx
```

### **State Management**
- **Library:** React Query (TanStack Query) for server state
- **Local State:** React hooks (useState, useCallback, useMemo, useEffect)
- **Canvas State:** Custom hook `useCanvasState` (nodes, edges, selection, zoom, pan)
- **No Redux/Zustand** - Pure React Query + component state pattern

---

## 2. 🎨 CANVAS / DAG BUILDER

### **Library Used**
- **CUSTOM SVG-BASED** (NOT React Flow)
- Built from scratch using native SVG + React
- Implements custom drag/drop, zoom/pan, edge drawing

### **Canvas Features**
- Grid-snapping (20px grid)
- Infinite canvas with pan/zoom (0.3x - 2x zoom)
- Mouse wheel zoom with preventDefault
- Drag nodes with snap-to-grid
- Port-based edge creation (click output port → click input port)
- Double-click edge to delete
- Background grid pattern

### **Node Structure**
```typescript
interface BuilderNode {
  id: string;                    // e.g. "n1234567890"
  type: NodeType;                // "source" | "transform" | "filter" | "join" | "aggregate" | "validate" | "load"
  label: string;                 // Display name
  x: number;                     // Canvas X position (snapped to grid)
  y: number;                     // Canvas Y position
  config: Record<string, unknown>; // Node-specific configuration
  status?: "pending" | "running" | "success" | "failed"; // Runtime status
}
```

### **Edge Structure**
```typescript
interface BuilderEdge {
  from: string;  // Source node ID
  to: string;    // Target node ID
}
```

### **Node Layout**
- **Width:** 140px
- **Height:** 52px
- **Ports:** Input (top center), Output (bottom center)
- **Port Radius:** 6px
- **Auto-placement:** Nodes placed in 4-column grid when added

### **Drag & Drop Behavior**
1. Mouse down on node → capture offset
2. Mouse move → update position with `snapToGrid()`
3. Mouse up → finalize position
4. Canvas panning: Click background + drag
5. Wiring: Click port → drag → release on another port

---

## 3. 🧩 NODE TYPES (COMPLETE LIST)

### **3.1 SOURCE Node**
- **Type:** `"source"`
- **Purpose:** Data extraction from databases/files
- **Config Fields:**
  - `connection_id` (string) - Bridge connection
  - `source_mode` ("table" | "query" | "file")
  - **Table Mode:**
    - `source_warehouse` (string, optional - Snowflake)
    - `source_database` (string)
    - `source_schema` (string)
    - `source_table` (string)
    - `source_columns` (JSON array of columns)
  - **Query Mode:**
    - `sql_query` (string) - Custom SQL
  - **File Mode:**
    - `storage_bucket` (string)
    - `file_path` (string)
    - `file_format` ("csv" | "json" | "parquet")
  - `extraction_mode` ("full_load" | "incremental")
- **UI Features:**
  - Connection dropdown (from `/connections` API)
  - ResourcePicker (hierarchical warehouse → database → schema → table)
  - DataPreview (modal with sample data)
  - Mode toggle buttons

### **3.2 TRANSFORM Node**
- **Type:** `"transform"`
- **Purpose:** Data transformation logic
- **Config Fields:**
  - `transform_mode` ("sql" | "js")
  - `logic` (string) - SQL or JavaScript code
- **UI Features:**
  - Mode toggle (SQL vs JavaScript)
  - Code textarea with syntax hints
  - Placeholder templates
- **Validation:** None (free-form code)

### **3.3 FILTER Node**
- **Type:** `"filter"`
- **Purpose:** Row-level filtering
- **Config Fields:**
  - `conditions` (JSON string of array)
    ```typescript
    interface Condition {
      id: string;
      column: string;
      operator: "=" | ">" | "<" | "LIKE" | "IN";
      value: string;
    }
    ```
- **UI Features:**
  - Add/remove conditions
  - Column name input
  - Operator dropdown
  - Value input
- **Validation:** Free-form (no schema validation)

### **3.4 VALIDATE Node**
- **Type:** `"validate"`
- **Purpose:** Data quality checks
- **Config Fields:**
  - `rules` (JSON string of array)
    ```typescript
    interface Rule {
      id: string;
      column: string;
      check: "not_null" | "regex" | "min_max" | "data_type";
      value?: string; // For regex or min_max
    }
    ```
  - `on_failure` ("stop" | "skip" | "error_table")
- **UI Features:**
  - Add/remove rules
  - Column name input
  - Check type dropdown
  - Constraint value (conditional)
  - Failure strategy dropdown
- **Validation:** Free-form rules

### **3.5 LOAD Node**
- **Type:** `"load"`
- **Purpose:** Data loading to destination
- **Config Fields:**
  - `target_connection_id` (string)
  - `load_mode` ("existing" | "auto")
  - **Existing Mode:**
    - `target_warehouse` (string, optional)
    - `target_database` (string)
    - `target_schema` (string)
    - `target_table` (string)
    - `target_columns` (JSON array)
  - **Auto Mode:**
    - `new_table_name` (string)
    - `target_schema` (string, default "public")
  - `write_mode` ("append" | "overwrite" | "upsert")
  - `column_mappings` (JSON object: source → target)
- **UI Features:**
  - Connection dropdown
  - Mode toggle (Existing Table vs Auto-Create)
  - ResourcePicker (for existing tables)
  - ColumnMappingConfig (visual mapping UI)
    - Auto-mapping button (fuzzy matching)
    - Type compatibility indicators
    - Drag-to-map interface
  - Write mode dropdown
  - DataPreview

### **3.6 JOIN Node** ⚠️
- **Type:** `"join"`
- **Purpose:** Multi-source joining
- **Config Fields:** ❌ NOT IMPLEMENTED
- **UI Component:** ❌ MISSING
- **Status:** Type defined in `types.ts` but NO config component exists

### **3.7 AGGREGATE Node** ⚠️
- **Type:** `"aggregate"`
- **Purpose:** Aggregations (GROUP BY)
- **Config Fields:** ❌ NOT IMPLEMENTED
- **UI Component:** ❌ MISSING
- **Status:** Type defined in `types.ts` but NO config component exists

---

## 4. 🔄 STATE MANAGEMENT

### **Pipeline State Location**
```typescript
// Pipeline list state
usePipelines() → React Query cache ["pipelines"]

// Single pipeline state  
usePipeline(id) → React Query cache ["pipelines", id]

// Canvas state (local)
useCanvasState(initialNodes, initialEdges) → Component state
  - nodes (BuilderNode[])
  - edges (BuilderEdge[])
  - selectedNode (string | null)
  - zoom (number)
  - pan ({ x, y })
```

### **Node/Edge Management**
```typescript
// Add node
addNode(type: NodeType) → Creates node with auto-ID, auto-position

// Update node
updateNode(id, updates) → Shallow merge config

// Delete node
deleteNode(id) → Removes node + all connected edges

// Add edge
addEdge(from, to) → Validates no duplicates, no self-loops

// Delete edge
deleteEdge(from, to) → Removes specific edge
```

### **Sync with Backend**
- **On Save:** Maps `BuilderNode[]` → `PipelineNode[]`
  ```typescript
  {
    id: n.id,
    node_type: n.type,
    label: n.label,
    config_json: n.config,     // Entire config object
    position_x: n.x,
    position_y: n.y,
    order_index: i
  }
  ```
- **On Load:** Maps `PipelineNode[]` → `BuilderNode[]`
  ```typescript
  {
    id: n.id,
    type: n.node_type,
    label: n.label,
    x: n.position_x,
    y: n.position_y,
    config: n.config_json as Record<string, unknown>
  }
  ```

---

## 5. 📡 API INTEGRATION

### **Pipeline APIs**

| Endpoint | Method | Purpose | Payload | Response |
|----------|--------|---------|---------|----------|
| `/pipelines` | GET | List all pipelines | Query: `limit`, `offset` | `Pipeline[]` |
| `/pipelines` | POST | Create pipeline | `{ pipeline, nodes, edges }` | `{ id: string }` |
| `/pipelines/:id` | GET | Get single pipeline | - | `PipelineWithNodes` |
| `/pipelines/:id` | PUT | Update pipeline | `{ name?, nodes?, edges?, execution_mode? }` | `Pipeline` |
| `/pipelines/:id` | DELETE | Delete pipeline | - | `{ status: "deleted" }` |
| `/pipelines/:id/duplicate` | POST | Duplicate pipeline | `{}` | `{ id: string }` |
| `/pipelines/:id/run` | POST | Trigger pipeline run | `{ source?, destination? }` | `{ run_id, status }` |
| `/pipelines/:id/validate` | POST | Validate pipeline DAG | - | `ValidationResult` |
| `/pipelines/:id/versions` | GET | Get version history | - | `Version[]` |
| `/pipelines/runs` | GET | List runs | Query: `pipeline_id?` | `PipelineRun[]` |
| `/pipelines/runs/:run_id` | GET | Get run details | - | `PipelineRun` |
| `/pipelines/runs/:run_id/tasks` | GET | Get run tasks | - | `RunTask[]` |
| `/pipelines/runs/:run_id/logs` | GET | Get execution logs | Query: `stage?`, `log_level?` | `ExecutionLog[]` |
| `/pipelines/runs/:run_id/worker-jobs` | GET | Get worker jobs | - | `WorkerJob[]` |

### **Connection APIs (Used by Nodes)**

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/connections` | GET | List connections | Source, Load nodes |
| `/connections/discover` | POST | Discover warehouses/databases/schemas/tables | ResourcePicker |
| `/connections/preview-data` | POST | Preview table data | DataPreview |
| `/connections/test` | POST | Test connection | Connection wizard |

### **Payload Structures**

#### **Create Pipeline**
```typescript
{
  pipeline: {
    name: string;
    description: string;
    status: "draft" | "active";
    schedule_type: "manual" | "hourly" | "daily" | "cron";
    schedule_config: Record<string, unknown>;
    execution_mode: "linear" | "DAG";
  },
  nodes: Array<{
    id: string;           // Frontend temp ID
    node_type: NodeType;
    label: string;
    config_json: Record<string, unknown>;
    position_x: number;
    position_y: number;
    order_index: number;
  }>,
  edges: Array<{
    source_node_id: string;
    target_node_id: string;
  }>
}
```

#### **Update Pipeline**
```typescript
{
  name?: string;
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  execution_mode?: "linear" | "DAG";
  schedule_type?: ScheduleType;
  schedule_config?: Record<string, unknown>;
}
```

#### **Trigger Run**
```typescript
{
  source?: Record<string, unknown>;      // Optional, fallback to node config
  destination?: Record<string, unknown>; // Optional, fallback to node config
}
```

---

## 6. ▶️ EXECUTION FLOW (CURRENT)

### **Run Trigger Flow**
1. **User clicks "Run" button** in `PipelineBuilder.tsx` or `PipelineDetail.tsx`
2. **Frontend validation:**
   - Calls `/pipelines/:id/validate` (optional, proceeds even if fails)
   - Checks for `pipelineId` (must be saved first)
3. **API call:** `POST /pipelines/:id/run`
   - Payload: `{ source?, destination? }` (usually empty, backend infers from nodes)
4. **Backend:**
   - Creates `pipeline_runs` record with `status: "running"`
   - Enqueues first stage job (usually "extract")
   - Returns `{ run_id, status: "running" }`
5. **Frontend:**
   - Invalidates React Query cache for runs
   - Shows toast: "Pipeline execution started"
   - Sets `activeRunId` for real-time polling

### **Real-time Updates**
```typescript
// Auto-polling with React Query
useRunTasks(runId)  → Polls every 2s if tasks are pending/running
usePipelineRuns()   → Polls every 3s if any run is "running"
```

### **Task Status Updates**
- Backend updates `pipeline_task_runs` table
- Frontend polls `/pipelines/runs/:run_id/tasks`
- Canvas nodes update `status` prop:
  - `pending` → Gray
  - `running` → Yellow, animated pulse
  - `success` → Green
  - `failed` → Red

### **Current Execution: REAL**
- ✅ Real backend execution via FastAPI + Supabase
- ✅ Worker service enqueues jobs
- ✅ Task runner processes stages
- ⚠️ Connector execution depends on connection setup
- ⚠️ Mock mode available via `USE_MOCK_DB=true`

---

## 7. 📊 MONITORING / LOGS UI

### **Run Status UI**
**Location:** `PipelineDetail.tsx` → "Run History" tab

**Features:**
- Run list with expand/collapse
- Status badges (success, failed, running, pending)
- Start time, end time, duration
- Rows processed count
- Per-run task breakdown
- Real-time updates (3s polling)

### **Logs Panel**
**Component:** `ExecutionLogs.tsx` page (separate route)

**Features:**
- Run ID filter
- Log level filter (INFO, WARN, ERROR, DEBUG)
- Stage filter
- Search by message
- Real-time streaming (3s polling)
- Color-coded log levels
- Timestamp display

**Data Source:**
```typescript
useExecutionLogs({ runId, stage?, logLevel?, search? })
  → GET /pipelines/runs/:run_id/logs
  → Returns ExecutionLog[]
```

### **Real-time Updates**
- ✅ Polling-based (React Query `refetchInterval`)
- ❌ NOT WebSocket-based
- Interval: 2-3 seconds for active runs
- Auto-stops polling when run completes

### **Worker Status**
**Component:** `WorkerStatusCard.tsx`

**Features:**
- Worker heartbeat status
- CPU/RAM usage
- Active task count
- Last heartbeat timestamp
- Real-time polling (5s)

**Data Source:**
```typescript
useWorkerStatus()
  → GET /monitoring/worker-status
  → Returns WorkerHeartbeat[]
```

---

## 8. ⚠️ GAPS / ISSUES

### **8.1 MISSING NODE IMPLEMENTATIONS**
❌ **JOIN node** - Type exists, NO config component  
❌ **AGGREGATE node** - Type exists, NO config component

**Impact:** Users can drag these nodes onto canvas but cannot configure them → Will fail at runtime

**Recommendation:** Either:
1. Remove from Toolbar until implemented
2. Implement config components (high priority)

### **8.2 SCHEMA VALIDATION**
⚠️ **No frontend schema validation**
- Source/Load nodes: Free-form column names
- Filter/Validate: No column validation against source schema
- Transform: No syntax checking (SQL/JS)

**Current behavior:**
- User can type any column name
- Errors only caught at execution time
- No autocomplete or suggestions

**Recommendation:** 
- Add real-time column schema fetching from connections
- Implement autocomplete for column names
- Add syntax highlighting for SQL/JS

### **8.3 COLUMN MAPPING ISSUES**
⚠️ **Auto-mapping is fuzzy**
- Uses simple string matching (includes, exact match)
- No type safety enforcement (warns but allows mismatches)
- No smart suggestions based on actual data

**Recommendation:**
- Enhance auto-mapping algorithm
- Add ML-based column matching
- Enforce type compatibility rules

### **8.4 DATA PREVIEW**
⚠️ **Mock data only**
```typescript
// DataPreview.tsx line 39-48
await new Promise(r => setTimeout(r, 1500));  // FAKE DELAY
const mockRows = Array.from({ length: 15 }).map(...); // MOCK DATA
```

**Impact:** Users see fake data instead of real table samples

**Recommendation:**
- Implement Supabase Edge Function for data preview
- Or proxy through backend `/connections/preview-data`
- Add proper error handling for connection failures

### **8.5 EXECUTION MODE**
⚠️ **Hardcoded to DAG mode**
```typescript
// PipelineBuilder.tsx line 89
execution_mode: 'DAG'  // Always DAG, even for linear pipelines
```

**Impact:** Linear pipelines forced into DAG execution

**Recommendation:**
- Add mode toggle (Linear vs DAG)
- Auto-detect based on edge structure
- Enforce DAG validation before run

### **8.6 EDGE VALIDATION**
❌ **No cycle detection in frontend**
- Users can create circular dependencies
- Only caught by backend `/validate` API
- No visual feedback during edge creation

**Recommendation:**
- Implement frontend DAG validator
- Block edge creation if cycle detected
- Visual error highlight

### **8.7 RESOURCE PICKER ISSUES**
⚠️ **Complex nested state**
- Async loading of warehouse → database → schema → table
- State management brittle (expanded nodes, loading states)
- Search only works on tables (not schemas/databases)

**Recommendation:**
- Simplify to dropdown cascade
- Add debounced search across all levels
- Cache discovered resources

### **8.8 HARDCODED VALUES**
```typescript
// Canvas.tsx - Grid size hardcoded
GRID_SIZE = 20

// NodeInspector - Magic numbers
width: 320px (w-80)

// DataPreview - Mock limit
50 records (hardcoded)
```

**Recommendation:** Move to configuration file

### **8.9 TYPE SAFETY**
⚠️ **Loose typing on `config`**
```typescript
config: Record<string, unknown>  // Too permissive
```

**Impact:** No type checking on node configurations

**Recommendation:**
- Create discriminated union types per node
- Add Zod/Yup validation schemas
- Generate TypeScript types from backend schemas

### **8.10 ERROR HANDLING**
⚠️ **Inconsistent error handling**
- Some API calls use toast, some don't
- Generic error messages
- No retry logic
- No offline detection

**Recommendation:**
- Standardize error handling middleware
- Add retry with exponential backoff
- Implement optimistic UI updates

---

## 9. 🔗 BACKEND REQUIREMENTS (DERIVED)

### **9.1 Required Data Models**

#### **pipelines**
```sql
id UUID PRIMARY KEY
name TEXT NOT NULL
description TEXT
status TEXT CHECK (status IN ('active', 'inactive', 'draft', 'error'))
schedule_type TEXT CHECK (schedule_type IN ('manual', 'hourly', 'daily', 'cron'))
schedule_config JSONB
execution_mode TEXT CHECK (execution_mode IN ('linear', 'DAG'))
created_by UUID
created_at TIMESTAMP
updated_at TIMESTAMP
last_run_at TIMESTAMP
next_run_at TIMESTAMP
```

#### **pipeline_nodes**
```sql
id UUID PRIMARY KEY
pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE
node_type TEXT CHECK (node_type IN ('source', 'transform', 'filter', 'join', 'aggregate', 'validate', 'load'))
label TEXT NOT NULL
config_json JSONB NOT NULL
position_x INTEGER
position_y INTEGER
order_index INTEGER
```

#### **pipeline_edges**
```sql
id UUID PRIMARY KEY
pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE
source_node_id UUID REFERENCES pipeline_nodes(id) ON DELETE CASCADE
target_node_id UUID REFERENCES pipeline_nodes(id) ON DELETE CASCADE
```

#### **pipeline_runs**
```sql
id UUID PRIMARY KEY
pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE
status TEXT CHECK (status IN ('success', 'failed', 'running', 'pending', 'cancelled'))
environment TEXT
start_time TIMESTAMP NOT NULL
end_time TIMESTAMP
finished_at TIMESTAMP
rows_processed INTEGER DEFAULT 0
last_successful_stage TEXT
error_message TEXT
metadata JSONB
```

#### **pipeline_task_runs**
```sql
id UUID PRIMARY KEY
pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE
node_id UUID REFERENCES pipeline_nodes(id)
stage TEXT NOT NULL
status TEXT CHECK (status IN ('success', 'failed', 'running', 'pending', 'retrying'))
start_time TIMESTAMP
end_time TIMESTAMP
retry_count INTEGER DEFAULT 0
error_message TEXT
```

#### **execution_logs**
```sql
id UUID PRIMARY KEY
run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE
stage TEXT NOT NULL
log_level TEXT CHECK (log_level IN ('INFO', 'WARN', 'ERROR', 'DEBUG'))
message TEXT NOT NULL
timestamp TIMESTAMP DEFAULT NOW()
```

#### **pipeline_versions**
```sql
id UUID PRIMARY KEY
pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE
version INTEGER NOT NULL
config_json JSONB NOT NULL
created_at TIMESTAMP DEFAULT NOW()
```

### **9.2 Required API Endpoints**

✅ **Already Implemented:**
- All endpoints listed in Section 5 exist in backend
- FastAPI router at `backend/api/pipeline_router.py`
- Service layer at `backend/services/pipeline_service.py`

❌ **Missing/Incomplete:**
1. `/connections/preview-data` - Mock data only
2. `/pipelines/:id/validate` - Needs cycle detection
3. Real-time WebSocket support (currently polling)

### **9.3 Required Payload Formats**

All formats documented in Section 5 match backend expectations.

**Key Validations Needed:**
1. DAG cycle detection (backend has `DAGValidator`)
2. Node config schema validation per type
3. Column existence validation (requires schema cache)
4. Connection credential validation

### **9.4 Required Response Formats**

All responses follow standard format:
```typescript
{
  success: boolean;
  data: T;
  message?: string;
}
```

Or legacy direct response (both supported by frontend).

---

## 10. 🧠 FINAL SUMMARY

### **What Frontend EXPECTS Backend to Do**

1. **Pipeline CRUD:**
   - ✅ Create pipeline with nodes/edges in single transaction
   - ✅ Update pipeline (metadata + nodes/edges)
   - ✅ Delete pipeline (cascade nodes/edges)
   - ✅ List pipelines with pagination
   - ✅ Get single pipeline with nodes/edges joined
   - ✅ Duplicate pipeline (copy nodes/edges)

2. **Execution Engine:**
   - ✅ Trigger run via `/pipelines/:id/run`
   - ✅ Create run record with status "running"
   - ✅ Enqueue jobs for worker service
   - ✅ Update task status in `pipeline_task_runs`
   - ✅ Write logs to `execution_logs`
   - ✅ Update run status on completion
   - ⚠️ Extract source/dest config from nodes if not provided

3. **Validation:**
   - ✅ DAG cycle detection
   - ⚠️ Node config schema validation (missing)
   - ⚠️ Column name validation against schema (missing)
   - ⚠️ Connection credential validation (partial)

4. **Resource Discovery:**
   - ✅ Warehouse → Database → Schema → Table hierarchy
   - ✅ Connection-based authentication
   - ⚠️ Table data preview (mock in frontend)
   - ⚠️ Column metadata with types (partial)

5. **Monitoring:**
   - ✅ List runs with filters
   - ✅ Get run details
   - ✅ Get run tasks (per-node status)
   - ✅ Get execution logs with filters
   - ✅ Worker heartbeat status
   - ⚠️ Real-time WebSocket (using polling instead)

### **What is Already Well Designed**

✅ **Excellent Architecture:**
- Clean separation: Pages → Components → Hooks → API Client
- React Query for server state (auto-caching, deduplication)
- Reusable components (ResourcePicker, DataPreview, NodeInspector)
- Type-safe interfaces for Pipeline, Node, Edge
- Custom SVG canvas (lightweight, no heavy dependencies)

✅ **Strong UX:**
- Grid-snapping for professional look
- Visual node status (color-coded by state)
- Port-based wiring (intuitive DAG creation)
- Inline node configuration (no modal hell)
- Auto-save with optimistic updates
- Real-time status polling

✅ **Backend Integration:**
- All major APIs properly hooked
- Error handling with toast notifications
- Loading states for all async operations
- Query invalidation on mutations

### **What is Missing**

❌ **Critical Gaps:**
1. JOIN and AGGREGATE node implementations
2. Real data preview (currently mock)
3. Frontend DAG cycle detection
4. Column schema validation
5. Transform code syntax validation

⚠️ **Nice-to-Have Improvements:**
1. WebSocket for real-time updates (replace polling)
2. Column autocomplete from schema
3. Visual error highlighting on invalid edges
4. Undo/redo for canvas operations
5. Node templates/presets
6. Export/import pipeline as JSON
7. Pipeline diff view for versions
8. Collaboration (multi-user editing)
9. Performance metrics (execution time trends)
10. Cost estimation per pipeline run

---

## 📋 BACKEND ACTION ITEMS

### **Priority 1: Critical**
1. ✅ Verify all APIs return expected formats
2. ✅ Ensure DAG validation works correctly
3. ⚠️ Implement `/connections/preview-data` (real data)
4. ⚠️ Add node config schema validation
5. ⚠️ Extract source/dest from nodes automatically

### **Priority 2: High**
1. ⚠️ Implement JOIN node execution logic
2. ⚠️ Implement AGGREGATE node execution logic
3. ⚠️ Add column metadata to schema discovery
4. ⚠️ Add SQL syntax validation for transform nodes
5. ⚠️ Improve error messages (field-specific)

### **Priority 3: Medium**
1. ⚠️ Add WebSocket support for real-time updates
2. ⚠️ Add pipeline execution cost tracking
3. ⚠️ Add performance metrics collection
4. ⚠️ Implement incremental load logic
5. ⚠️ Add data quality metrics

### **Priority 4: Nice-to-Have**
1. Pipeline templates API
2. Multi-user collaboration (locking)
3. AI-powered column mapping suggestions
4. Execution time prediction
5. Resource usage optimization

---

## ✅ SIGN-OFF

**Frontend Analysis:** COMPLETE  
**Backend Requirements:** EXTRACTED  
**Missing Components:** DOCUMENTED  
**Next Steps:** Backend implementation based on this blueprint

**Analyst Signature:** _Senior Frontend + Data Platform Architect_  
**Date:** 2026-04-08

---

**END OF ANALYSIS**
