import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock3, Phone, PhoneOff, Volume2, X } from 'lucide-react';

import { api } from '../api';
import { useStore } from '../store/useStore';

const LANGUAGE_TAG = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  'en-hi': 'en-IN',
};

function currentCallId() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('call') || '';
}

function currentAction() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('action') || '';
}

function replaceQuery(eventId, action) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (eventId) url.searchParams.set('call', eventId);
  else url.searchParams.delete('call');
  if (action) url.searchParams.set('action', action);
  else url.searchParams.delete('action');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function splitBilingual(text) {
  const value = String(text || '');
  const chunks =
    value.match(/[\u0900-\u097F][\u0900-\u097F\s.,!?;:'"()\-]*|[^\u0900-\u097F]+/g) || [value];
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      text: chunk,
      lang: /[\u0900-\u097F]/.test(chunk) ? 'hi-IN' : 'en-IN',
    }));
}

function speak(text, language, onEnd) {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    !('SpeechSynthesisUtterance' in window)
  ) {
    return false;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const parts =
    language === 'en-hi'
      ? splitBilingual(text)
      : [{ text: String(text || 'Task reminder'), lang: LANGUAGE_TAG[language] || 'en-IN' }];
  if (parts.length === 0) return false;

  const voices = synth.getVoices?.() || [];
  let remaining = parts.length;
  let finished = false;
  const finish = () => {
    remaining -= 1;
    if (remaining <= 0 && !finished) {
      finished = true;
      onEnd?.();
    }
  };

  for (const part of parts) {
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.lang = part.lang;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    const exact = voices.find((voice) => voice.lang === part.lang);
    const languageRoot = part.lang.split('-')[0];
    const fallback = voices.find((voice) => voice.lang?.startsWith(languageRoot));
    if (exact || fallback) utterance.voice = exact || fallback;

    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  }

  return true;
}

function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export default function CallOverlay() {
  const session = useStore((state) => state.session);
  const [call, setCall] = React.useState(null);
  const [phase, setPhase] = React.useState('idle');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const answerRef = React.useRef(null);
  const callIdRef = React.useRef('');
  const openingRef = React.useRef('');

  const close = React.useCallback(() => {
    stopSpeech();
    callIdRef.current = '';
    replaceQuery('', '');
    setCall(null);
    setPhase('idle');
    setBusy(false);
    setError('');
    setNotice('');
  }, []);

  const answerCall = React.useCallback(async (callData) => {
    if (!callData?.eventId) return;
    setBusy(true);
    setError('');
    try {
      const { call: answered } = await api.answerCall(callData.eventId);
      setCall((previous) => ({ ...previous, ...answered }));
      setPhase('speaking');
      const started = speak(answered.script, answered.language, () => setPhase('ended'));
      if (!started) {
        setNotice('This browser cannot speak the reminder. Read the text above.');
        setPhase('ended');
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not answer this call.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, []);

  const openCall = React.useCallback(
    async (eventId, action = '') => {
      if (!eventId) return;
      // A push can arrive at the same time as the local test-call event. Only
      // let one of them drive the overlay so an answer is not reset.
      if (openingRef.current === eventId) return;
      if (callIdRef.current === eventId && !openingRef.current) return;
      openingRef.current = eventId;
      callIdRef.current = eventId;
      replaceQuery(eventId, '');
      setBusy(true);
      setError('');
      setNotice('');

      try {
        const { call: next } = await api.getCall(eventId);
        setCall(next);

        if (action === 'snooze') {
          await api.actionCall(eventId, 'snooze');
          setNotice('Snoozed for 15 minutes.');
          setPhase('done');
          window.setTimeout(close, 1400);
          return;
        }

        setPhase('incoming');
        if (action === 'answer') await answerCall(next);
      } catch (requestError) {
        setError(requestError.message || 'Could not open this call.');
        setPhase('error');
      } finally {
        setBusy(false);
        openingRef.current = '';
      }
    },
    [answerCall, close]
  );

  const handleAction = React.useCallback(
    async (action) => {
      const eventId = callIdRef.current;
      if (!eventId) return;
      setBusy(true);
      setError('');
      try {
        await api.actionCall(eventId, action);
        stopSpeech();
        if (action === 'complete') setNotice('Task marked complete.');
        if (action === 'snooze') setNotice('Snoozed for 15 minutes.');
        if (action === 'opt_out') setNotice('Voice reminders are now off.');
        setPhase('done');
        // Refresh tasks/settings so the rest of the app reflects the action.
        useStore.getState().init?.();
        window.setTimeout(close, 1400);
      } catch (requestError) {
        setError(requestError.message || 'Could not update this reminder.');
      } finally {
        setBusy(false);
      }
    },
    [close]
  );

  const decline = React.useCallback(async () => {
    const eventId = callIdRef.current;
    if (!eventId) return;
    setBusy(true);
    await api.declineCall(eventId).catch(() => {});
    setBusy(false);
    close();
  }, [close]);

  React.useEffect(() => {
    if (!session) return undefined;

    const eventId = currentCallId();
    if (eventId) openCall(eventId, currentAction());

    const onWorkerMessage = (event) => {
      const payload = event.data?.payload;
      if (event.data?.type === 'nova:push' && payload?.data?.kind === 'voice-call') {
        openCall(payload.data.eventId);
      }
    };
    const onIncomingCall = (event) => {
      if (event.detail?.eventId) openCall(event.detail.eventId);
    };

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onWorkerMessage);
    }
    window.addEventListener('nova:incoming-call', onIncomingCall);

    return () => {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onWorkerMessage);
      }
      window.removeEventListener('nova:incoming-call', onIncomingCall);
    };
  }, [session, openCall]);

  React.useEffect(() => {
    if (call && phase === 'incoming') answerRef.current?.focus();
  }, [call, phase]);

  React.useEffect(() => {
    if (!call) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [call, close]);

  React.useEffect(() => () => stopSpeech(), []);

  const replay = () => {
    if (!call) return;
    setPhase('speaking');
    const started = speak(call.script, call.language, () => setPhase('ended'));
    if (!started) setPhase('ended');
  };

  if (!session) return null;

  const open = Boolean(call);
  const speaking = phase === 'speaking';
  const ended = phase === 'ended';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-call-title"
            className="panel-raised w-full max-w-sm rounded-3xl p-6"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <motion.span
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"
                  animate={
                    phase === 'incoming'
                      ? { scale: [1, 1.08, 1] }
                      : { scale: 1 }
                  }
                  transition={
                    phase === 'incoming'
                      ? { duration: 1.2, repeat: Infinity }
                      : { duration: 0.2 }
                  }
                >
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </motion.span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                    {phase === 'incoming' ? 'Incoming Nova call' : 'Nova call'}
                  </p>
                  <h2 id="nova-call-title" className="truncate text-lg font-semibold text-ink">
                    {call.todoText || 'Task reminder'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-faint transition hover:bg-line/60 hover:text-ink"
                onClick={close}
                aria-label="Close call"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 max-h-40 overflow-y-auto text-sm leading-relaxed text-muted">
              {call.script}
            </p>

            {phase === 'incoming' && (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  ref={answerRef}
                  type="button"
                  className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
                  onClick={() => answerCall(call)}
                  disabled={busy}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Answer
                </button>
                <button
                  type="button"
                  className="btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
                  onClick={decline}
                  disabled={busy}
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" />
                  Decline
                </button>
              </div>
            )}

            {speaking && (
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-accent">
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Speaking the reminder…
              </div>
            )}

            {(speaking || ended) && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="btn-ghost flex flex-col items-center gap-1 px-2 py-2 text-[11px]"
                  onClick={() => handleAction('complete')}
                  disabled={busy}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Complete
                </button>
                <button
                  type="button"
                  className="btn-ghost flex flex-col items-center gap-1 px-2 py-2 text-[11px]"
                  onClick={() => handleAction('snooze')}
                  disabled={busy}
                >
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Snooze 15m
                </button>
                <button
                  type="button"
                  className="btn-ghost flex flex-col items-center gap-1 px-2 py-2 text-[11px]"
                  onClick={() => handleAction('opt_out')}
                  disabled={busy}
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" />
                  Stop calls
                </button>
              </div>
            )}

            {ended && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Call ended</span>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={replay}
                  disabled={busy}
                >
                  Replay
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-4 text-xs text-muted" role="status">
                {notice}
              </p>
            )}

            {phase === 'error' && (
              <button type="button" className="btn-ghost mt-4 w-full px-4 py-2 text-sm" onClick={close}>
                Close
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
