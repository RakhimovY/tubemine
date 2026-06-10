export default function Loading() {
  return (
    <div className="dashboard-page history-page">
      <section
        className="history-card"
        aria-busy="true"
        aria-label="Loading analysis"
        style={{ marginBottom: "var(--space-7)" }}
      >
        <div className="skeleton-row">
          <div className="skel-thumb" />
          <div className="skel-lines">
            <div className="skel-line" />
            <div className="skel-line tiny" />
          </div>
          <div className="skel-line short" />
        </div>
        <div className="skeleton-row">
          <div className="skel-thumb" />
          <div className="skel-lines">
            <div className="skel-line" />
            <div className="skel-line tiny" />
          </div>
          <div className="skel-line short" />
        </div>
        <div className="skeleton-row">
          <div className="skel-thumb" />
          <div className="skel-lines">
            <div className="skel-line" />
            <div className="skel-line tiny" />
          </div>
          <div className="skel-line short" />
        </div>
      </section>
    </div>
  )
}
