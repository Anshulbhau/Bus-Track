import { useAuth } from '../context/AuthContext'

interface AccessDeniedProps {
  onSignOut?: () => void
}

export default function AccessDenied({ onSignOut }: AccessDeniedProps) {
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    onSignOut?.()
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(135deg, rgba(30,20,40,0.95) 0%, rgba(20,15,35,0.98) 100%)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '20px',
          padding: '48px 40px',
          textAlign: 'center',
          boxShadow:
            '0 0 0 1px rgba(239,68,68,0.08), 0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(239,68,68,0.06)',
          backdropFilter: 'blur(20px)',
          animation: 'accessDeniedSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%)',
            border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 28px',
            boxShadow: '0 0 30px rgba(239,68,68,0.15)',
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(239,68,68)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '22px',
            fontWeight: '700',
            color: 'rgb(239,68,68)',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
            lineHeight: '1.3',
          }}
        >
          Administrator Access Required
        </h1>

        {/* Divider */}
        <div
          style={{
            width: '48px',
            height: '3px',
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
            borderRadius: '2px',
            margin: '0 auto 20px',
          }}
        />

        {/* Message */}
        <p
          style={{
            fontSize: '14.5px',
            color: 'rgba(148,163,184,0.9)',
            lineHeight: '1.7',
            marginBottom: '36px',
          }}
        >
          Your account does not have administrator privileges and cannot access
          the admin portal. Please contact the system administrator if you
          believe this is an error.
        </p>

        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '100px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'rgba(239,68,68,0.85)',
            marginBottom: '28px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="rgb(239,68,68)"
          >
            <circle cx="12" cy="12" r="6" />
          </svg>
          Access Denied
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '13px 24px',
            borderRadius: '12px',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.08) 100%)',
            color: 'rgb(252,165,165)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(185,28,28,0.16) 100%)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(239,68,68,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.08) 100%)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Sign Out & Return to Login
        </button>

        {/* Footer note */}
        <p
          style={{
            marginTop: '20px',
            fontSize: '12px',
            color: 'rgba(100,116,139,0.7)',
          }}
        >
          Safar Setu Admin Portal · Unauthorized access is prohibited
        </p>
      </div>

      <style>{`
        @keyframes accessDeniedSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
