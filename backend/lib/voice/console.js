const crypto = require('crypto');

/**
 * Dry-run adapter. It logs the exact prompt a real call would speak, so the
 * scheduler, idempotency, quiet hours, and UI can be built and tested before a
 * SIP account exists. Selected with VOICE_PROVIDER=console (the default).
 */
async function placeCall({ to, script, kind = 'reminder', eventId = '' }) {
  const id = `console_${crypto.randomUUID()}`;
  console.log(`[voice:console] ${kind} -> ${to || '(no sip address)'} [${eventId}]`);
  console.log(`[voice:console] "${String(script || '').slice(0, 240)}"`);

  return {
    id,
    provider: 'console',
    simulated: true,
    done: Promise.resolve({ status: 'simulated', answered: false }),
  };
}

module.exports = { placeCall };
