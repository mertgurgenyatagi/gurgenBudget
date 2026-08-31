export function Dashboard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 28,
        background: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 18px 40px -18px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.15)',
      }}
    >
      <span
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '-.02em',
          color: 'var(--onink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ₺284
      </span>
      <span
        style={{
          marginTop: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--b-muted)',
        }}
      >
        Today
      </span>
    </div>
  )
}
