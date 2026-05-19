const metrics = [
  { label: "Total balance", value: "Ready for accounts" },
  { label: "Monthly income", value: "Ready for transactions" },
  { label: "Monthly expense", value: "Ready for budgets" }
] as const;

export function DashboardPlaceholder(): React.ReactElement {
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Money Tracker</h1>
        <span>Foundation ready</span>
      </header>

      <dl className="dashboard-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>

      <p className="status-line">Next task: auth foundation.</p>
    </main>
  );
}
