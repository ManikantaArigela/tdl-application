const { synthesize } = require('../tts');

/**
 * Asterisk ARI adapter.
 *
 * The bot registers to sip.linphone.org as a normal SIP account, then asks
 * Asterisk to originate a call to `PJSIP/<sip-user>@linphone`. When the channel
 * enters Stasis we answer, play the cached TTS prompt, and listen for DTMF:
 *   1 = complete, 2 = snooze 15 minutes, 9 = stop all voice reminders.
 *
 * Everything is lazy: the app starts and runs with the console adapter when
 * Asterisk is not configured.
 */

const APP = process.env.ARI_APP || 'nova-voice';
const pending = new Map(); // eventId -> call context
const byChannel = new Map(); // channel id -> call context

let clientPromise = null;
let lastError = '';
let lastConnectedAt = null;

function ariUrl() {
  return (process.env.ARI_URL || 'http://127.0.0.1:8088').replace(/\/$/, '');
}

async function getClient() {
  if (clientPromise) return clientPromise;

  const ari = require('ari-client');
  clientPromise = ari
    .connect(ariUrl(), process.env.ARI_USER || 'nova', process.env.ARI_PASSWORD || '')
    .then(async (client) => {
      client.on('StasisStart', onStasisStart);
      client.on('ChannelDestroyed', onChannelDestroyed);
      client.on('WebSocketReconnecting', () => {
        lastError = 'ARI reconnecting';
      });
      await client.start(APP);
      lastConnectedAt = Date.now();
      lastError = '';
      return client;
    })
    .catch((error) => {
      clientPromise = null;
      lastError = error.message;
      throw error;
    });

  return clientPromise;
}

function finish(ctx, status) {
  if (!ctx || ctx.settled) return;
  ctx.settled = true;
  if (ctx.timer) clearTimeout(ctx.timer);
  if (ctx.ringTimer) clearTimeout(ctx.ringTimer);
  pending.delete(ctx.eventId);
  if (ctx.channelId) byChannel.delete(ctx.channelId);
  ctx.resolve({
    status,
    answered: Boolean(ctx.answeredAt),
    durationSec: ctx.answeredAt ? Math.round((Date.now() - ctx.answeredAt) / 1000) : 0,
    action: ctx.action || null,
  });
}

async function onStasisStart(event, channel) {
  const eventId = event?.args?.[0];
  const ctx = eventId ? pending.get(eventId) : null;

  if (!ctx) {
    // A stray channel in our Stasis app: never leave it hanging.
    channel.hangup().catch(() => {});
    return;
  }

  ctx.channel = channel;
  ctx.channelId = channel.id;
  byChannel.set(channel.id, ctx);

  channel.on('ChannelDtmfReceived', async (dtmfEvent) => {
    const digit = String(dtmfEvent?.digit || '');
    if (!digit) return;

    try {
      const action = ctx.onDtmf ? await ctx.onDtmf(digit) : null;
      if (action) ctx.action = action;
    } catch (error) {
      lastError = `DTMF handler: ${error.message}`;
    }

    if (['1', '2', '9'].includes(digit)) {
      // Let the service play its confirmation before the channel closes.
      setTimeout(() => channel.hangup().catch(() => {}), 600);
    }
  });

  // Do not keep an open channel forever, even if playback stalls.
  ctx.timer = setTimeout(() => {
    finish(ctx, 'answered');
    channel.hangup().catch(() => {});
  }, Number(process.env.VOICE_MAX_CALL_SECONDS || 45) * 1000);
  if (typeof ctx.timer.unref === 'function') ctx.timer.unref();

  try {
    await channel.answer();
    ctx.answeredAt = Date.now();
    if (ctx.ringTimer) clearTimeout(ctx.ringTimer);

    if (ctx.media) {
      await channel.play({ media: ctx.media });
    } else {
      // No TTS available: still make the call useful as a ring/alert.
      await channel.play({ media: 'sound:beep' });
    }
  } catch (error) {
    lastError = `answer/play: ${error.message}`;
  }
}

function onChannelDestroyed(event) {
  const ctx = byChannel.get(event?.channel?.id);
  if (!ctx) return;

  const cause = Number(event?.cause);
  const status = ctx.answeredAt
    ? 'answered'
    : [17, 18, 19, 21].includes(cause)
      ? 'no_answer'
      : 'failed';
  finish(ctx, status);
}

async function placeCall({ to, script, language = 'en', eventId, kind = 'reminder', onDtmf }) {
  const client = await getClient();

  let media = null;
  if (script) {
    const result = await synthesize({ text: script, language });
    media = result?.media || null;
  }

  const sipUser = String(to || '').split('@')[0];
  const template = process.env.VOICE_SIP_ENDPOINT_TEMPLATE;
  const endpoint = template
    ? template.replaceAll('{user}', sipUser).replaceAll('{sip}', String(to || ''))
    : `PJSIP/${sipUser}@${process.env.VOICE_SIP_TRUNK || 'linphone'}`;

  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const ctx = {
    eventId: eventId || `call_${Date.now()}`,
    kind,
    media,
    onDtmf,
    resolve: resolveDone,
    settled: false,
    answeredAt: null,
    channelId: null,
    timer: null,
    action: null,
  };
  pending.set(ctx.eventId, ctx);

  try {
    const originate = {
      endpoint,
      app: APP,
      appArgs: ctx.eventId,
      timeout: Number(process.env.VOICE_RING_SECONDS || 30),
    };
    // Leave caller ID to pjsip.conf unless explicitly overridden. Setting it to
    // a display name here can change the SIP From user and break Linphone auth.
    if (process.env.VOICE_CALLER_ID) originate.callerId = process.env.VOICE_CALLER_ID;

    const channel = await client.channels.originate(originate);

    ctx.channelId = channel.id;
    byChannel.set(channel.id, ctx);

    // ARI normally emits ChannelDestroyed for unanswered calls. This is a
    // belt-and-braces timeout in case that event is missed.
    ctx.ringTimer = setTimeout(
      () => {
        if (ctx.answeredAt) return;
        finish(ctx, 'no_answer');
        ctx.channel?.hangup().catch(() => {});
      },
      (Number(process.env.VOICE_RING_SECONDS || 30) + 10) * 1000
    );
    if (typeof ctx.ringTimer.unref === 'function') ctx.ringTimer.unref();

    return { id: channel.id, provider: 'ari', media, done };
  } catch (error) {
    pending.delete(ctx.eventId);
    lastError = error.message;
    throw error;
  }
}

function status() {
  return {
    provider: 'ari',
    configured: Boolean(process.env.ARI_URL),
    connected: Boolean(clientPromise),
    connectedAt: lastConnectedAt,
    app: APP,
    lastError,
  };
}

module.exports = { placeCall, status };
