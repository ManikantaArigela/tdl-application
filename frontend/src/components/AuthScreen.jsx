import React from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../store/useStore';

const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const MIN_PASSWORD_LENGTH = 8;

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-2xl leading-none text-ink">TDL</span>
    </div>
  );
}

export default function AuthScreen() {
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);
  const authNotice = useStore((s) => s.authNotice);
  const clearAuthMessages = useStore((s) => s.clearAuthMessages);

  const [mode, setMode] = React.useState('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState(null);

  const isSignup = mode === 'signup';

  const switchMode = (next) => {
    setMode(next);
    setFormError(null);
    setConfirm('');
    clearAuthMessages();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);

    if (!emailLooksValid(email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (isSignup && password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    if (isSignup) {
      const result = await signUp(email, password);
      if (result?.needsConfirmation) {
        setMode('signin');
        setPassword('');
        setConfirm('');
      }
      return;
    }

    await signIn(email, password);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-warning/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="panel-raised p-7 sm:p-8">
          <BrandMark />

          <h1 className="mt-7 text-3xl text-ink">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {isSignup
              ? 'Your notes and tasks are private to your account.'
              : 'Sign in to pick up where you left off.'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-muted">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                  disabled={authBusy}
                  aria-invalid={Boolean(formError || authError)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-xs font-medium text-muted">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                  aria-hidden="true"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input px-10"
                  placeholder={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
                  disabled={authBusy}
                  aria-invalid={Boolean(formError || authError)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="icon-btn absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {isSignup && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="mb-1.5 block text-xs font-medium text-muted"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <ShieldCheck
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="input pl-10"
                    placeholder="Repeat your password"
                    disabled={authBusy}
                    aria-invalid={Boolean(formError)}
                  />
                </div>
              </div>
            )}

            {(formError || authError) && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-ink"
              >
                {formError || authError}
              </p>
            )}

            {authNotice && (
              <p
                role="status"
                aria-live="polite"
                className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-ink"
              >
                {authNotice}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={authBusy}>
              {authBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
              {authBusy
                ? isSignup
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignup
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-5 text-sm">
            <span className="text-muted">
              {isSignup ? 'Already have an account?' : 'New to TDL?'}
            </span>
            <button
              type="button"
              onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
              className="font-medium text-accent hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-faint">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Private by default — each account can only read its own data.
        </p>
      </div>
    </div>
  );
}
