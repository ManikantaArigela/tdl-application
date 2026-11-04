const consoleAdapter = require('./console');

const providerName = () => String(process.env.VOICE_PROVIDER || 'console').toLowerCase();

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
  return consoleAdapter.placeCall(options);
}

module.exports = { placeCall, status, providerName };
