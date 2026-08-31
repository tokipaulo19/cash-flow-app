function StatusBadge({ status }) {
  const normalized = String(status || 'SAFE').toLowerCase()
  return <span className={`status-badge status-${normalized}`}>{status}</span>
}

export default StatusBadge
