#!/usr/bin/env node
/**
 * Voice smoke test. Run this on the Oracle VM after Asterisk and ffmpeg are
 * installed:
 *
 *   npm run voice:smoke
 *   npm run voice:smoke -- --call alice@sip.linphone.org
 *
 * It never touches MongoDB, so it is safe before the first deploy.
 */
const { spawn } = require('child_process');

const voice = require('../lib/voice');
const { synthesize } = require('../lib/tts');

function checkFfmpeg() {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const callIndex = args.indexOf('--call');
  const target = callIndex >= 0 ? args[callIndex + 1] : '';

  console.log('Voice status:', JSON.stringify(voice.status(), null, 2));

  const hasFfmpeg = await checkFfmpeg();
  console.log(`ffmpeg: ${hasFfmpeg ? 'found' : 'MISSING (required for 8 kHz WAV prompts)'}`);

  if (hasFfmpeg) {
    const sample = await synthesize({
      text: 'This is Nova. Your reminder system is ready.',
      language: 'en',
    });
    console.log('TTS sample:', sample ? sample.path : 'failed (see warning above)');
  }

  if (!target) {
    console.log('\nDry check complete. Add --call name@sip.linphone.org to place a real call.');
    return;
  }

  console.log(`\nCalling ${target} ...`);
  const result = await voice.placeCall({
    to: target,
    script:
      'Hello. This is Nova. If you can hear this, the SIP trunk, TTS, and playback are working. Press 1 to end.',
    language: 'en',
    eventId: `smoke_${Date.now()}`,
    kind: 'smoke',
    onDtmf: async (digit) => {
      console.log(`DTMF received: ${digit}`);
      return digit === '1' ? 'completed' : null;
    },
  });

  console.log(`Call started: ${result.provider} ${result.id}`);

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ status: 'timeout' }), 75_000);
    if (typeof timer.unref === 'function') timer.unref();
  });
  const outcome = await Promise.race([result.done, timeout]);
  if (timer) clearTimeout(timer);
  console.log('Call outcome:', outcome);
  // The ARI WebSocket stays open; this is a one-shot CLI.
  process.exit(0);
}

main().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});
