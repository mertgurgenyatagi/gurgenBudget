type RingPageProps = {
  label: string
  tone: string
}

export function RingPage({ label, tone }: RingPageProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 28,
        background: tone,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 18px 40px -18px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.15)',
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'oklch(21% .037 134)',
        }}
      >
        {label}
      </span>
    </div>
  )
}
