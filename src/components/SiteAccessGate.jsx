import { useEffect, useState } from 'react'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Sprout } from 'lucide-react'

const AUTH_ENDPOINT = '/api/site-auth'

function SiteAccessGate({ children }) {
  const [status, setStatus] = useState('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true
    fetch(AUTH_ENDPOINT, { credentials: 'same-origin' })
      .then((response) => active && setStatus(response.ok ? 'authenticated' : 'locked'))
      .catch(() => {
        if (active) {
          setError('Unable to check site access. Please try again.')
          setStatus('locked')
        }
      })
    return () => { active = false }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setStatus('submitting')
    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Incorrect password.')
      setPassword('')
      setStatus('authenticated')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('locked')
    }
  }

  if (status === 'authenticated') return children
  if (status === 'checking') {
    return (
      <main className="access-screen" aria-live="polite">
        <LoaderCircle className="access-spinner" aria-hidden="true" />
        <span>Checking access...</span>
      </main>
    )
  }

  return (
    <main className="access-screen">
      <section className="access-panel" aria-labelledby="access-title">
        <div className="access-brand">
          <span className="access-brand-mark" aria-hidden="true">
            <Sprout size={26} strokeWidth={2.4} />
          </span>
          <strong>MoveBreak</strong>
        </div>
        <div className="access-icon" aria-hidden="true"><LockKeyhole size={25} /></div>
        <h1 id="access-title">This site is protected</h1>
        <p>Enter the team access password to continue.</p>
        <form className="access-form" onSubmit={handleSubmit}>
          <label htmlFor="site-password">Access password</label>
          <div className="access-password-field">
            <input
              id="site-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={error ? 'access-error' : undefined}
              aria-invalid={Boolean(error)}
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {error && <p className="access-error" id="access-error" role="alert">{error}</p>}
          <button className="access-submit" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' && <LoaderCircle className="access-spinner" size={18} aria-hidden="true" />}
            {status === 'submitting' ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default SiteAccessGate
