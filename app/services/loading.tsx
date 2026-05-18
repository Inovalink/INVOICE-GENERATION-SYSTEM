export default function ServicesLoading() {
  return (
    <div className="sk-page">
      <div className="sk-header-row">
        <div className="sk-line sk-line--title" />
        <div className="sk-btn" />
      </div>
      <div className="sk-cards-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="sk-card" key={i}>
            <div className="sk-line sk-line--wide" />
            <div className="sk-line sk-line--mid" />
            <div className="sk-line sk-line--short" />
            <div className="sk-line sk-line--title" style={{ width: '45%', height: '1.5rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
