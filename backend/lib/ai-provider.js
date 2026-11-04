/**
 * Provider-agnostic AI "brain".
 *
 * The app ships with Gemini as the quality-first default, Groq as a very fast
 * free fallback, and OpenRouter free models as a last resort. All keys stay on
 * the server. A provider is only used when its API key is present.
 *
 * Set AI_PROVIDER=auto (default), gemini, groq, or openrouter to control the
 * preferred order. With `auto`, every configured provider is tried in order so
 * one rate-limited free tier does not take the AI features down.
 */

const gemini = require('./gemini');
const openaiCompatible = require('./openai-compatible');

const PROVIDER_IDS = ['gemini', 'groq', 'openrouter'];

const LABELS = {
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function providerConfig(id) {
  if (id === 'gemini') {
    return {
      id,
      label: LABELS.gemini,
      configured: gemini.isConfigured(),
      model: gemini.getModel(),
      fallbackModel: gemini.getFallbackModel(),
    };
  }

  if (id === 'groq') {
    return {
      id,
      label: LABELS.groq,
      configured: Boolean(process.env.GROQ_API_KEY),
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      fallbackModel: process.env.GROQ_FALLBACK_MODEL || DEFAULT_GROQ_FALLBACK_MODEL,
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    };
  }

  return {
    id: 'openrouter',
    label: LABELS.openrouter,
    configured: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
    fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    extraHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://github.com/',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Nova Notes',
    },
  };
}

/** Requested provider first, then the other configured providers as fallbacks. */
function providerOrder() {
  const requested = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (!PROVIDER_IDS.includes(requested)) return PROVIDER_IDS;
  return [requested, ...PROVIDER_IDS.filter((id) => id !== requested)];
}

function configuredProviders() {
  return providerOrder().filter((id) => providerConfig(id).configured);
}

function notConfiguredError() {
  const error = new Error(
    'AI is not configured. Add a free key to backend/.env: GEMINI_API_KEY (recommended), GROQ_API_KEY, or OPENROUTER_API_KEY, then restart the server.'
  );
  error.status = 503;
  return error;
}

function fileProviderError() {
  const error = new Error(
    'PDF and image attachments need Gemini. Add GEMINI_API_KEY to backend/.env, or attach a text file instead.'
  );
  error.status = 503;
  return error;
}

function publicError(error) {
  const message = error?.providerMessage || error?.message || '';
  if (/not configured/i.test(message)) return error;

  if (/invalid api key|incorrect api key|unauthorized|authentication|api key/i.test(message)) {
    const friendly = new Error(
      'The AI provider rejected its API key. Check GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in backend/.env.'
    );
    friendly.status = 502;
    friendly.providerMessage = message;
    return friendly;
  }

  if (error?.status === 429) {
    const friendly = new Error(
      'AI usage is temporarily limited on the free tier. Please try again in a minute.'
    );
    friendly.status = 429;
    friendly.retryable = true;
    friendly.providerMessage = message;
    return friendly;
  }

  if (error?.status >= 500) {
    const timedOut = error.status === 504 || /took too long/i.test(message);
    const friendly = new Error(
      timedOut
        ? 'The AI took too long to respond. Try a shorter topic or file.'
        : /high demand|overloaded|temporarily|try again later|capacity|unavailable/i.test(message)
        ? 'The AI model is busy right now. Please try again in a moment.'
        : 'The AI service is temporarily unavailable. Please try again in a moment.'
    );
    friendly.status = error.status;
    friendly.retryable = true;
    friendly.providerMessage = message;
    return friendly;
  }

  return error;
}

async function callProvider(id, { prompt, files = [] }) {
  const config = providerConfig(id);

  if (id === 'gemini') {
    return gemini.generateJson({ prompt, files });
  }

  if (files.length > 0) throw fileProviderError();

  return openaiCompatible.generateJson({
    baseUrl: config.baseUrl,
    apiKey: process.env[id === 'groq' ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY'],
    models: [config.model, config.fallbackModel],
    prompt,
    provider: config.label,
    extraHeaders: config.extraHeaders,
  });
}

/**
 * @param {object} options
 * @param {string} options.prompt
 * @param {Array<{mimeType: string, data: string}>} [options.files]
 * @returns {Promise<object>} parsed JSON object
 */
async function generateJson({ prompt, files = [] }) {
  const hasFiles = files.length > 0;
  const configured = configuredProviders();

  if (configured.length === 0) throw notConfiguredError();

  // Only Gemini can read inline PDFs/images in this app. Text files are folded
  // into the prompt by the browser before they reach the API.
  const providers = hasFiles
    ? configured.includes('gemini')
      ? ['gemini']
      : []
    : configured;

  if (providers.length === 0) throw fileProviderError();

  let lastError = null;

  for (let index = 0; index < providers.length; index += 1) {
    const id = providers[index];
    const label = LABELS[id];
    try {
      return await callProvider(id, { prompt, files });
    } catch (error) {
      lastError = error;
      const next = providers[index + 1];
      if (next) {
        const reason = error?.providerMessage || error?.message || 'unknown error';
        console.warn(`[ai] ${label} failed (${reason}); trying ${LABELS[next]}.`);
        // A tiny pause keeps a burst of fallback requests from hammering the
        // next free tier with the same 429 burst.
        await sleep(150);
      }
    }
  }

  if (lastError) throw publicError(lastError);

  const error = new Error('The AI service is temporarily unavailable. Please try again.');
  error.status = 503;
  throw error;
}

function status() {
  const configured = configuredProviders();
  const primary = configured[0] || null;
  // Keep a model string in the public status even when no key is configured so
  // clients can show the default without treating it as "ready".
  const primaryConfig = providerConfig(primary || providerOrder()[0]);

  return {
    configured: configured.length > 0,
    mode: String(process.env.AI_PROVIDER || 'auto').toLowerCase(),
    provider: primary,
    providerLabel: primary ? LABELS[primary] : null,
    model: primaryConfig.model,
    fallbackModel: primaryConfig.fallbackModel || null,
    providers: PROVIDER_IDS.map((id) => {
      const config = providerConfig(id);
      return {
        id,
        label: config.label,
        configured: config.configured,
        model: config.model,
        fallbackModel: config.fallbackModel || null,
      };
    }),
  };
}

module.exports = {
  generateJson,
  status,
  configuredProviders,
  providerConfig,
};
