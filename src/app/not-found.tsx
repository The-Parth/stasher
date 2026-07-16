export default function NotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', animation: 'fadeIn 400ms ease' }}>
        <span style={{ fontSize: '3rem', opacity: 0.25 }}>⊗</span>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Page not found</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>The page you&apos;re looking for doesn&apos;t exist.</p>
        </div>
        <a href="/" className="btn btn-secondary btn-sm">← Back home</a>
      </div>
    </div>
  );
}
