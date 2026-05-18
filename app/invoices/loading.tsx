export default function InvoicesLoading() {
  return (
    <div className="sk-page">
      <div className="sk-header-row">
        <div className="sk-line sk-line--title" />
        <div className="sk-btn" />
      </div>
      <div className="sk-table">
        <div className="sk-table-row sk-table-header">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="sk-line sk-line--short" key={i} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
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
