const consoleAdapter = require('./console');

const providerName = () => String(process.env.VOICE_PROVIDER || 'console').toLowerCase();

/** SIP verification is only needed for transports that dial a SIP address. */
const requiresSip = () => !['inapp'].includes(providerName());

const isInApp = () => providerName() === 'inapp';

function status() {
  const provider = providerName();
  if (provider === 'ari') {
    // Required lazily so the app runs without ari-client in minimal installs.
    try {
      return require('./ari').status();
    } catch (error) {
      return { provider: 'ari', configured: false, connected: false, lastError: error.message };
    }
  }
  if (provider === 'inapp') {
    return require('./inapp').status();
  }

  return {
    provider: 'console',
    configured: true,
    connected: false,
    simulated: true,
    sipDomain: process.env.SIP_DOMAIN || 'sip.linphone.org',
  };
}

async function placeCall(options) {
  if (providerName() === 'ari') {
    return require('./ari').placeCall(options);
  }
  if (providerName() === 'inapp') {
    return require('./inapp').placeCall(options);
  }
  return consoleAdapter.placeCall(options);
}

function getSession(eventId) {
  if (providerName() !== 'inapp') return null;
  return require('./inapp').getSession(eventId);
}

function answer(eventId) {
  if (providerName() !== 'inapp') return null;
  return require('./inapp').answer(eventId);
}

function decline(eventId) {
  if (providerName() !== 'inapp') return false;
  return require('./inapp').decline(eventId);
}

function action(eventId, actionName) {
  if (providerName() !== 'inapp') return false;
  return require('./inapp').action(eventId, actionName);
}

module.exports = {
  placeCall,
  status,
  providerName,
  requiresSip,
  isInApp,
  getSession,
  answer,
  decline,
  action,
};
