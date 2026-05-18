export default function DashboardLoading() {
  return (
    <div className="sk-page">
      <div className="sk-header-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <div className="sk-line sk-line--title" />
          <div className="sk-line sk-line--sub" />
        </div>
      </div>

      {/* Metric cards */}
      <div className="sk-cards-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="sk-card" key={i}>
            <div className="sk-line sk-line--short" />
            <div className="sk-line sk-line--title" style={{ width: '60%', height: '1.75rem' }} />
            <div className="sk-line sk-line--mid" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="sk-card" style={{ minHeight: '220px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="sk-card" style={{ flex: 1 }} />
          <div className="sk-card" style={{ flex: 1 }} />
        </div>
      </div>

      {/* Table */}
      <div className="sk-table">
        <div className="sk-table-row sk-table-header">
          {['Client', 'Invoice #', 'Amount', 'Status', 'Date'].map((h) => (
            <div className="sk-line sk-line--short" key={h} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="sk-table-row" key={i}>
            <div className="sk-line sk-line--wide" />
            <div className="sk-line sk-line--mid" />
            <div className="sk-line sk-line--short" />
            <div className="sk-line sk-line--short" />
            <div className="sk-line sk-line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}
