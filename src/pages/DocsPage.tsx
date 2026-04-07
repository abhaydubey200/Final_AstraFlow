import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BookOpen, LayoutDashboard, GitBranch, Database, ScrollText,
  Activity, Layers, Shield, Bell, Settings, ChevronRight,
  Search, ArrowLeft, Zap, Play, Plus, Edit, Trash2, Download,
  Lock, Key, Globe, Mail, Clock, CheckCircle, Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DocSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  content: React.ReactNode;
}

const sections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          AstraETL is a modern ETL (Extract, Transform, Load) platform for building, managing, and monitoring data pipelines.
          This guide walks you through every feature.
        </p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Quick Start</h3>
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          <li><strong className="text-foreground">Sign up / Log in</strong> — Create an account or sign in at the authentication page. You'll need to verify your email before accessing the platform.</li>
          <li><strong className="text-foreground">Create a Connection</strong> — Navigate to <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-display">Connections</code> and add your database credentials (PostgreSQL, MySQL, SQL Server, or Snowflake).</li>
          <li><strong className="text-foreground">Build a Pipeline</strong> — Go to <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-display">Pipelines → New Pipeline</code> to visually design your data flow using the drag-and-drop canvas.</li>
          <li><strong className="text-foreground">Run & Monitor</strong> — Execute your pipeline manually or set a schedule, then monitor results from the Dashboard and Monitoring pages.</li>
        </ol>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-4">
          <p className="text-xs text-foreground font-medium">💡 Tip</p>
          <p className="text-xs text-muted-foreground mt-1">Start with a single connection and a simple pipeline to get familiar with the interface before building complex workflows.</p>
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Dashboard provides an at-a-glance overview of your pipeline health and system status.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Key Metrics</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><Activity className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <span><strong className="text-foreground">Active Pipelines</strong> — Number of pipelines currently in "active" status, with total count.</span></li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" /> <span><strong className="text-foreground">Success Rate</strong> — Percentage of successful runs within the selected time range.</span></li>
          <li className="flex items-start gap-2"><Trash2 className="w-4 h-4 text-destructive mt-0.5 shrink-0" /> <span><strong className="text-foreground">Failed Runs</strong> — Count of failed pipeline executions in the period.</span></li>
          <li className="flex items-start gap-2"><Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> <span><strong className="text-foreground">Avg Latency</strong> — Average execution time for completed runs.</span></li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Time Range Filter</h3>
        <p className="text-sm text-muted-foreground">Use the <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-display">24h / 7d / 30d</code> toggle in the top-right to filter metrics by time period.</p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Overview Panel</h3>
        <p className="text-sm text-muted-foreground">Shows total rows processed, number of connections, total pipelines, and total runs across all time.</p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Recent Pipeline Runs</h3>
        <p className="text-sm text-muted-foreground">A table of the 8 most recent runs showing pipeline name, status, duration, rows processed, and when it ran. Click any row to navigate to the pipeline detail page.</p>
      </div>
    ),
  },
  {
    id: "pipelines",
    title: "Pipelines",
    icon: GitBranch,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Pipelines are the core of AstraETL. Each pipeline defines a series of connected nodes that extract, transform, and load data.
        </p>

        <h3 className="text-sm font-semibold text-foreground">Pipeline List</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Search</strong> — Filter pipelines by name using the search bar.</li>
          <li>• <strong className="text-foreground">Status Filters</strong> — Filter by All, Active, Draft, Error, or Inactive.</li>
          <li>• <strong className="text-foreground">Sort</strong> — Sort by Last Updated, Name, or Created date.</li>
          <li>• <strong className="text-foreground">View Modes</strong> — Toggle between Table view and Grid (card) view.</li>
          <li>• <strong className="text-foreground">Bulk Actions</strong> — Select multiple pipelines using checkboxes for bulk deletion.</li>
        </ul>

        <h3 className="text-sm font-semibold text-foreground mt-6">Pipeline Actions</h3>
        <p className="text-sm text-muted-foreground">Hover over a pipeline row/card and click the <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-display">⋮</code> menu to access:</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground ml-4">
          <li className="flex items-center gap-2"><Eye className="w-3.5 h-3.5" /> View Details</li>
          <li className="flex items-center gap-2"><Play className="w-3.5 h-3.5" /> Run Now — Trigger an immediate execution</li>
          <li className="flex items-center gap-2"><Edit className="w-3.5 h-3.5" /> Edit — Open the visual pipeline builder</li>
          <li className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> Duplicate — Create a copy of the pipeline</li>
          <li className="flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Delete — Permanently remove the pipeline</li>
        </ul>

        <h3 className="text-sm font-semibold text-foreground mt-6">Pipeline Builder (Visual Editor)</h3>
        <p className="text-sm text-muted-foreground">Click <strong className="text-foreground">New Pipeline</strong> or <strong className="text-foreground">Edit</strong> to open the visual pipeline builder:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Canvas</strong> — An SVG-based drag-and-drop workspace where you place and connect nodes.</li>
          <li>• <strong className="text-foreground">Toolbar</strong> — Quick-add buttons for different node types (Source, Transform, Load, Validate).</li>
          <li>• <strong className="text-foreground">Drag-to-Connect</strong> — Draw edges between node ports to define the data flow (DAG).</li>
          <li>• <strong className="text-foreground">Node Inspector</strong> — Click any node to open the inspector sidebar (desktop) or bottom sheet (mobile) to configure its properties.</li>
          <li>• <strong className="text-foreground">Zoom & Grid</strong> — Scroll to zoom, nodes snap to a grid for neat layouts.</li>
        </ul>

        <h3 className="text-sm font-semibold text-foreground mt-6">Pipeline Detail Page</h3>
        <p className="text-sm text-muted-foreground">Click a pipeline name to view its detail page with four tabs:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Overview</strong> — Success rate, avg duration, total rows moved, configuration details, and visual pipeline flow diagram.</li>
          <li>• <strong className="text-foreground">Run History</strong> — Table of all runs with expandable rows showing task-level execution logs (Extract → Transform → Load stages).</li>
          <li>• <strong className="text-foreground">Schedule</strong> — Configure Manual, Hourly, Daily, or Cron-based scheduling. View next/last run times.</li>
          <li>• <strong className="text-foreground">Settings</strong> — Retry policy (max retries, interval), execution timeout, notification preferences, and danger zone (delete pipeline).</li>
        </ul>
      </div>
    ),
  },
  {
    id: "connections",
    title: "Connections",
    icon: Database,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Connections define how AstraETL communicates with your databases. You must create and test a connection before using it in a pipeline.
        </p>

        <h3 className="text-sm font-semibold text-foreground">Supported Database Types</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "PostgreSQL", port: 5432 },
            { name: "MySQL", port: 3306 },
            { name: "SQL Server (MSSQL)", port: 1433 },
            { name: "Snowflake", port: 443 },
          ].map((db) => (
            <div key={db.name} className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-muted/10">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-foreground">{db.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Port {db.port}</span>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-foreground mt-6">Creating a Connection</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Click <strong className="text-foreground">New Connection</strong>.</li>
          <li>Select the database type.</li>
          <li>Fill in the connection details: name, host, port, database name, username, and password.</li>
          <li>Optionally enable <strong className="text-foreground">SSL/TLS</strong> encryption.</li>
          <li>Set the <strong className="text-foreground">Timeout</strong> (5–300 seconds, default 30s) to control how long to wait before timing out.</li>
          <li>Click <strong className="text-foreground">Test Connection</strong> to verify connectivity.</li>
          <li>If the test succeeds, click <strong className="text-foreground">Save Connection</strong>.</li>
        </ol>
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 mt-2">
          <p className="text-xs text-foreground font-medium">⚠️ Important</p>
          <p className="text-xs text-muted-foreground mt-1">Passwords are <strong>not stored</strong> in the database for security. You must re-enter the password each time you edit or test an existing connection.</p>
        </div>

        <h3 className="text-sm font-semibold text-foreground mt-6">Connection Status</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• <span className="text-success font-medium">Connected</span> — Last test was successful.</li>
          <li>• <span className="text-muted-foreground font-medium">Disconnected</span> — Never tested or manually reset.</li>
          <li>• <span className="text-destructive font-medium">Error</span> — Last test failed (check credentials or network).</li>
        </ul>

        <h3 className="text-sm font-semibold text-foreground mt-6">Schema Discovery</h3>
        <p className="text-sm text-muted-foreground">After connecting, you can discover the database schema to browse tables, columns, data types, and row count estimates.</p>
      </div>
    ),
  },
  {
    id: "execution-logs",
    title: "Execution Logs",
    icon: ScrollText,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Execution Logs page provides a detailed history of all pipeline runs with task-level log inspection.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Features</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Search</strong> — Find runs by pipeline name or run ID.</li>
          <li>• <strong className="text-foreground">Status Filter</strong> — Filter by All, Success, Running, or Failed.</li>
          <li>• <strong className="text-foreground">Date Range</strong> — Filter by Today, Last 7 days, Last 30 days, or All time.</li>
          <li>• <strong className="text-foreground">Expandable Runs</strong> — Click any run to expand and view stage-level logs (Extract, Transform, Load).</li>
          <li>• <strong className="text-foreground">Log Levels</strong> — Logs are color-coded: <span className="text-muted-foreground">INFO</span>, <span className="text-warning">WARN</span>, <span className="text-destructive">ERROR</span>.</li>
          <li>• <strong className="text-foreground">Export CSV</strong> — Download all filtered runs as a CSV file for offline analysis.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Pipeline Stage Indicator</h3>
        <p className="text-sm text-muted-foreground">When you expand a run, a visual indicator shows the health of each stage with green (success) or red (error) dots before you dive into individual log entries.</p>
      </div>
    ),
  },
  {
    id: "monitoring",
    title: "Monitoring",
    icon: Activity,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Monitoring page provides real-time health dashboards and charts for pipeline performance over the last 24 hours.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Metric Cards</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Total Runs (24h)</strong> — All runs in the last 24 hours.</li>
          <li>• <strong className="text-foreground">Success Rate</strong> — Percentage of successful runs.</li>
          <li>• <strong className="text-foreground">Avg Execution Time</strong> — Mean duration of completed runs.</li>
          <li>• <strong className="text-foreground">Data Processed</strong> — Total rows moved.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Charts</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Data Throughput</strong> — Hourly area chart showing rows processed per hour.</li>
          <li>• <strong className="text-foreground">Avg Execution Time</strong> — Weekly bar chart showing average run duration by day of week.</li>
          <li>• <strong className="text-foreground">Run Status Distribution</strong> — Donut chart showing Success / Failed / Running / Pending breakdown.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Recent Alerts</h3>
        <p className="text-sm text-muted-foreground">Shows the 5 most recent failed runs with error messages and timestamps. Links to the full Execution Logs page.</p>
      </div>
    ),
  },
  {
    id: "data-catalog",
    title: "Data Catalog",
    icon: Layers,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The Data Catalog is a read-only browser for exploring your pipelines and connections metadata.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Pipelines Tab</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Lists all pipelines with their node count and status.</li>
          <li>• Expand any pipeline to see its schedule, creation/update dates, description, and node flow diagram.</li>
          <li>• Each node shows its type (Source, Transform, Load, Validate) and label.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Connections Tab</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Tabular view of all connections showing name, type, host:port, database, status, and SSL status.</li>
          <li>• Use the search bar to filter by name.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "alerts",
    title: "Alerts & Notifications",
    icon: Bell,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Set up automated alerts for pipeline events and manage notifications in one place.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Notifications Tab</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• View all in-app notifications triggered by alert rules.</li>
          <li>• Notifications are color-coded by severity: <span className="text-destructive">Error</span>, <span className="text-success">Success</span>, <span className="text-warning">Warning</span>, <span className="text-primary">Info</span>.</li>
          <li>• Mark individual notifications as read, or use <strong className="text-foreground">Mark all as read</strong>.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Alert Rules Tab</h3>
        <p className="text-sm text-muted-foreground">Create rules that trigger notifications when specific events occur:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Rule Types:</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>– <strong>Pipeline Failure</strong> — Triggers when a pipeline run fails.</li>
              <li>– <strong>Pipeline Success</strong> — Triggers when a pipeline run succeeds.</li>
              <li>– <strong>Any Completion</strong> — Triggers on any terminal status.</li>
            </ul>
          </li>
          <li>• <strong className="text-foreground">Scope</strong> — Apply to a specific pipeline or all pipelines.</li>
          <li>• <strong className="text-foreground">Email Notifications</strong> — Optionally add an email address to receive alerts via email in addition to in-app notifications.</li>
          <li>• <strong className="text-foreground">Enable/Disable</strong> — Toggle rules on or off without deleting them.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Configure platform-wide settings across four sections.
        </p>
        <h3 className="text-sm font-semibold text-foreground">General</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Platform Name</strong> — Customize the application display name.</li>
          <li>• <strong className="text-foreground">Default Timezone</strong> — Set the timezone for scheduling and display.</li>
          <li>• <strong className="text-foreground">Data Retention</strong> — Configure how many days of execution data to retain.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Security</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• <strong className="text-foreground">Encryption</strong> — View TLS 1.2+ (in transit) and AES-256 (at rest) status.</li>
          <li>• <strong className="text-foreground">Session Timeout</strong> — Set session timeout in minutes.</li>
          <li>• <strong className="text-foreground">API Keys</strong> — View, generate, and revoke API keys for programmatic access.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Notifications</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Toggle email alerts for pipeline failures and successes.</li>
          <li>• Configure a webhook URL (e.g., Slack) for external notifications.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">About</h3>
        <p className="text-sm text-muted-foreground">View the current version, license, and system health status for all backend services.</p>
      </div>
    ),
  },
  {
    id: "authentication",
    title: "Authentication",
    icon: Lock,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          AstraETL uses email-based authentication with email verification.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Sign Up</h3>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
          <li>Navigate to the login page.</li>
          <li>Switch to the <strong className="text-foreground">Sign Up</strong> tab.</li>
          <li>Enter your display name, email, and password.</li>
          <li>Check your email for a verification link.</li>
          <li>Click the link to verify, then log in.</li>
        </ol>
        <h3 className="text-sm font-semibold text-foreground mt-6">Sign In</h3>
        <p className="text-sm text-muted-foreground">Enter your email and password. Sessions persist until you sign out.</p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Reset Password</h3>
        <p className="text-sm text-muted-foreground">Click <strong className="text-foreground">Forgot password?</strong> on the login page. You'll receive an email with a link to set a new password.</p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Sign Out</h3>
        <p className="text-sm text-muted-foreground">Click the <strong className="text-foreground">Sign Out</strong> button at the bottom of the sidebar.</p>
      </div>
    ),
  },
  {
    id: "navigation",
    title: "Navigation & UI",
    icon: Globe,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          AstraETL uses a collapsible sidebar for navigation with all major sections accessible from one place.
        </p>
        <h3 className="text-sm font-semibold text-foreground">Sidebar</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• The sidebar shows all navigation items with icons and labels.</li>
          <li>• Click the <strong className="text-foreground">chevron button</strong> at the bottom to collapse/expand the sidebar.</li>
          <li>• Your email is displayed at the bottom when expanded.</li>
          <li>• On mobile, the sidebar opens as a slide-over panel via the hamburger menu.</li>
        </ul>
        <h3 className="text-sm font-semibold text-foreground mt-6">Theme</h3>
        <p className="text-sm text-muted-foreground">AstraETL supports light and dark themes. Use the theme toggle in the top navigation bar to switch.</p>
        <h3 className="text-sm font-semibold text-foreground mt-6">Notification Bell</h3>
        <p className="text-sm text-muted-foreground">The bell icon in the top bar shows unread notification count. Click it to view recent notifications inline or navigate to the full Alerts page.</p>
      </div>
    ),
  },
];

const DocsPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("getting-started");
  const [search, setSearch] = useState("");

  const filteredSections = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">User Guide</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete documentation for AstraETL</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar TOC */}
        <div className="w-56 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <nav className="space-y-0.5">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs transition-colors text-left",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <section.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          {currentSection && (
            <div className="rounded-lg border border-border bg-card p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <currentSection.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-lg font-display font-bold text-foreground">{currentSection.title}</h2>
              </div>
              {currentSection.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
