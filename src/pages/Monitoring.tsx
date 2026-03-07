const Monitoring = () => (
  <div className="p-6 lg:p-8 space-y-6">
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground">Monitoring</h1>
      <p className="text-sm text-muted-foreground mt-1">Pipeline health, metrics, and alerts</p>
    </div>
    <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <h3 className="font-display font-semibold text-foreground">Monitoring Dashboard</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Grafana and Prometheus integration coming in Phase 2. Real-time metrics, alerting, and pipeline health monitoring.
      </p>
    </div>
  </div>
);

export default Monitoring;
