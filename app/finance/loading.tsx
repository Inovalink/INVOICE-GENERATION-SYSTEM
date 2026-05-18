export default function FinanceLoading() {
  return (
    <div className="sk-page">
      <div className="sk-header-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <div className="sk-line sk-line--title" />
          <div className="sk-line sk-line--sub" />
        </div>
      </div>
      <div className="sk-cards-row">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="sk-card" key={i}>
            <div className="sk-line sk-line--short" />
            <div className="sk-line sk-line--title" style={{ width: '60%', height: '1.75rem' }} />
            <div className="sk-line sk-line--mid" />
          </div>
        ))}
      </div>
      <div className="sk-card" style={{ minHeight: '260px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="sk-card" style={{ minHeight: '180px' }} />
        <div className="sk-card" style={{ minHeight: '180px' }} />
      </div>
    </div>
  );
}
