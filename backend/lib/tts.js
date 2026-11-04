const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Free TTS for SIP calls.
 *
 * Edge TTS (via msedge-tts) needs no API key. Asterisk wants 8 kHz mono
 * 16-bit PCM WAV, so ffmpeg converts the MP3 once and the result is cached by
 * a hash of the exact prompt + voice. Repeated reminders cost no CPU and no
 * network.
 */

const VOICES = {
  en: 'en-IN-NeerjaNeural',
  hi: 'hi-IN-SwaraNeural',
  te: 'te-IN-ShrutiNeural',
  // Bilingual prompts are built by the caller; this is the fallback voice.
  'en-hi': 'en-IN-NeerjaNeural',
};

const CACHE_DIR = process.env.TTS_CACHE_DIR || path.join(__dirname, '..', 'var', 'tts');
const SOUNDS_DIR = process.env.ASTERISK_SOUNDS_DIR || '';
const SOUND_PREFIX = process.env.ASTERISK_SOUND_PREFIX || 'nova';

const sha1 = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 24);

function voiceFor(language) {
  return VOICES[language] || VOICES.en;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Mirrors a cached WAV into Asterisk's sounds tree, when configured. */
async function copyToSounds(wavPath, hash) {
  if (!SOUNDS_DIR) return false;
  let published = true;
  // Channel language settings vary, so publish under both the root and `en`.
  for (const sub of [SOUND_PREFIX, path.join('en', SOUND_PREFIX)]) {
    const targetDir = path.join(SOUNDS_DIR, sub);
    const target = path.join(targetDir, `${hash}.wav`);
    if (fs.existsSync(target)) {
      await fsp.chmod(target, 0o644).catch(() => {});
      continue;
    }
    try {
      await fsp.mkdir(targetDir, { recursive: true });
      // systemd's UMask=0077 would otherwise create 0700/0600 files that the
      // Asterisk user cannot read. These are non-secret cached prompts.
      await fsp.chmod(targetDir, 0o755).catch(() => {});
      await fsp.copyFile(wavPath, target);
      await fsp.chmod(target, 0o644).catch(() => {});
    } catch (error) {
      published = false;
      console.warn(`[tts] could not copy prompt to Asterisk: ${error.message}`);
    }
  }
  return published;
}

/**
 * Returns `{ media, path }` where `media` is ready for ARI
 * (`sound:nova/<hash>`), or null when TTS is unavailable.
 */
async function synthesize({ text, language = 'en' }) {
  const prompt = String(text ?? '').trim().slice(0, 900);
  if (!prompt) return null;

  const voice = voiceFor(language);
  const hash = sha1(`${voice}|${prompt}`);
  const wavPath = path.join(CACHE_DIR, `${hash}.wav`);

  if (fs.existsSync(wavPath)) {
    const published = await copyToSounds(wavPath, hash);
    return { media: published ? `sound:${SOUND_PREFIX}/${hash}` : null, path: wavPath };
  }

  let MsEdgeTTS;
  let OUTPUT_FORMAT;
  try {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts'));
  } catch {
    console.warn('[tts] msedge-tts is not installed; skipping synthesis.');
    return null;
  }

  try {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(prompt);
    const mp3 = await collect(audioStream);

    const mp3Path = path.join(CACHE_DIR, `${hash}.mp3`);
    await fsp.writeFile(mp3Path, mp3);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3Path, '-ar', '8000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath]);
    await fsp.unlink(mp3Path).catch(() => {});

    const published = await copyToSounds(wavPath, hash);
    return { media: published ? `sound:${SOUND_PREFIX}/${hash}` : null, path: wavPath };
  } catch (error) {
    console.warn(`[tts] synthesis failed: ${error.message}`);
    return null;
  }
}

module.exports = { synthesize, voiceFor, VOICES };
