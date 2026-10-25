import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import Brand from './Brand';

const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const MIN_PASSWORD_LENGTH = 8;

const ASIDE_POINTS = [
  {
    icon: StickyNote,
    title: 'Notes that save themselves',
    copy: 'Write freely. Everything autosaves and stays searchable.',
  },
  {
    icon: ListChecks,
    title: 'Tasks that stay in view',
    copy: 'Priorities, due dates, and a today view that stays honest.',
  },
  {
    icon: Sparkles,
    title: 'AI help when you need it',
    copy: 'Turn a topic or PDF into notes and clear next steps.',
  },
];

export default function AuthScreen({ initialMode = 'signin', onBack }) {
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);
  const authNotice = useStore((s) => s.authNotice);
  const clearAuthMessages = useStore((s) => s.clearAuthMessages);

  const [mode, setMode] = React.useState(initialMode);
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas p-3 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-pop-pink/20 blur-3xl"
      />

      <div className="relative grid w-full max-w-[1060px] overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-frame sm:rounded-[2.25rem] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#26086E] p-9 text-white lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-8 top-8 h-28 w-28 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 top-24 h-24 w-24 rotate-12 rounded-[1.75rem] bg-pop-yellow"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-pop-pink/70 blur-3xl"
          />

          <div className="relative">
            <Brand size="lg" inverted />
          </div>

          <div className="relative mt-12">
            <h2 className="max-w-sm text-[2.55rem] font-semibold leading-[1.02] tracking-[-0.055em]">
              A calmer place for your thoughts.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              Capture ideas, plan the day, and let AI handle the messy part. One workspace,
              no app-hopping.
            </p>

            <ul className="mt-8 space-y-4">
              {ASIDE_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        {point.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/55">
                        {point.copy}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-pop-yellow" aria-hidden="true" />
              Private by default
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/55">
              Each account can only read its own notes and tasks.
            </p>
          </div>
        </aside>

        <div className="p-5 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-lavender hover:text-accent"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back
              </button>
            ) : (
              <span />
            )}
            <Brand size="sm" className="lg:hidden" />
          </div>

          <div className="mx-auto mt-7 w-full max-w-md sm:mt-10">
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
              {isSignup ? 'Make room for what matters.' : 'Good to see you again.'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {isSignup
                ? 'Create your workspace for notes, tasks, and AI planning.'
                : 'Sign in to pick up where you left off.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block text-xs font-semibold text-ink"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
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
                    className="input py-3 pl-10"
                    placeholder="you@example.com"
                    disabled={authBusy}
                    aria-invalid={Boolean(formError || authError)}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-xs font-semibold text-ink"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input py-3 pl-10 pr-11"
                    placeholder={
                      isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'
                    }
                    disabled={authBusy}
                    aria-invalid={Boolean(formError || authError)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="icon-btn absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2"
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
                    className="mb-1.5 block text-xs font-semibold text-ink"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <ShieldCheck
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      className="input py-3 pl-10"
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
                  className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
                >
                  {formError || authError}
                </p>
              )}

              {authNotice && (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm text-ink"
                >
                  {authNotice}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm"
                disabled={authBusy}
              >
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

            <div className="mt-5 border-t border-line pt-5 text-sm text-muted">
              {isSignup ? 'Already have an account?' : 'New to TDL?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
                className="font-semibold text-accent hover:underline"
              >
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-faint">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Private by default. Your account only sees its own data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
