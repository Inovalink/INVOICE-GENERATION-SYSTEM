export default function TasksLoading() {
  return (
    <div className="sk-page">
      <div className="sk-header-row">
        <div className="sk-line sk-line--title" />
        <div className="sk-btn" />
      </div>
      <div className="sk-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="sk-list-row" key={i}>
            <div className="sk-avatar" style={{ borderRadius: '6px', width: '1.5rem', height: '1.5rem' }} />
            <div className="sk-list-body">
              <div className="sk-line sk-line--wide" />
              <div className="sk-line sk-line--short" />
            </div>
            <div className="sk-line sk-line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}
