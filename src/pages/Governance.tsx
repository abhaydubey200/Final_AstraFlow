const Governance = () => (
  <div className="p-6 lg:p-8 space-y-6">
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground">Governance</h1>
      <p className="text-sm text-muted-foreground mt-1">Security, RBAC, and compliance</p>
    </div>
    <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-2xl">🛡️</span>
      </div>
      <h3 className="font-display font-semibold text-foreground">Data Governance</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Role-based access control, encryption policies, and audit trails coming in Phase 3.
      </p>
    </div>
  </div>
);

export default Governance;
