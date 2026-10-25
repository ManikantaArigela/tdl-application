/**
 * Minimal Gemini client.
 *
 * The API key never reaches the browser: the frontend talks to our Express
 * routes and this module talks to Google's Generative Language API.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 90_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const getModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

const getFallbackModel = () => process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryBaseDelay() {
  const value = Number(process.env.GEMINI_RETRY_BASE_MS);
  return Number.isFinite(value) && value >= 0 ? value : 700;
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(retryBaseDelay() * 2 ** attempt, 4000) + Math.round(Math.random() * 150);
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('').trim();
}

/** Models sometimes wrap JSON in ``` fences or prose; pull out the first object. */
function parseJson(text) {
  if (!text) throw new Error('Gemini returned an empty response.');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const slice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  try {
    return JSON.parse(slice);
  } catch {
    throw new Error('Gemini returned a response that was not valid JSON. Try again.');
  }
}

function providerError(status, message, retryable = false, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.providerMessage = message;
  Object.assign(error, extra);
  return error;
}

function publicError(error) {
  const message = error?.providerMessage || error?.message || '';
  if (/not configured/i.test(message)) return error;

  if (error?.status === 429) {
    const friendly = providerError(
      429,
      'AI usage is temporarily limited. Please try again in a minute.',
      true
    );
    friendly.providerMessage = message;
    return friendly;
  }

  if (error?.status >= 500) {
    const timedOut = error.status === 504 || /took too long/i.test(message);
    const friendly = providerError(
      error.status,
      timedOut
        ? 'The AI took too long to respond. Try a shorter topic or file.'
        : /high demand|overloaded|temporarily|try again later|capacity|unavailable/i.test(message)
        ? 'The AI model is busy right now. Please try again in a moment.'
        : 'The AI service is temporarily unavailable. Please try again in a moment.',
      true
    );
    friendly.providerMessage = message;
    return friendly;
  }

  return error;
}

async function requestModel({ apiKey, model, parts }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    const body = response.ok ? null : await response.json().catch(() => null);
    return { response, body };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw providerError(
        504,
        'Gemini took too long to respond. Try a shorter input.',
        true,
        { timeout: true }
      );
    }
    throw providerError(502, `Could not reach Gemini: ${err.message}`, true, {
      network: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {object} options
 * @param {string} options.prompt  Instruction text sent before any attachments.
 * @param {Array<{mimeType: string, data: string}>} [options.files]
 *        Base64 inline attachments (PDFs, images, plain text).
 * @returns {Promise<object>} parsed JSON object
 */
async function generateJson({ prompt, files = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw providerError(
      503,
      'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.'
    );
  }

  const parts = [{ text: prompt }];
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
  }

  const primaryModel = getModel();
  const fallbackModel = getFallbackModel();
  const models = [primaryModel];
  if (fallbackModel && fallbackModel !== primaryModel) models.push(fallbackModel);

  let lastError = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const attempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let result;

      try {
        result = await requestModel({ apiKey, model, parts });
      } catch (error) {
        lastError = error;
        if (error.timeout) throw publicError(error);

        if (attempt < attempts - 1) {
          const delay = retryDelay(null, attempt);
          console.warn(`[gemini] ${model} could not be reached; retrying in ${delay}ms.`);
          await sleep(delay);
          continue;
        }
        break;
      }

      const { response, body } = result;

      if (response.ok) {
        const data = await response.json().catch(() => null);
        return parseJson(extractText(data));
      }

      const providerMessage =
        body?.error?.message || `Gemini request failed with status ${response.status}.`;
      const retryable = RETRYABLE_STATUS.has(response.status);
      lastError = providerError(
        response.status === 400 || response.status === 401 || response.status === 403
          ? 502
          : response.status,
        providerMessage,
        retryable
      );

      if (retryable && attempt < attempts - 1) {
        const delay = retryDelay(response, attempt);
        console.warn(`[gemini] ${model} returned ${response.status}; retrying in ${delay}ms.`);
        await sleep(delay);
        continue;
      }

      if (retryable && modelIndex < models.length - 1) {
        console.warn(`[gemini] ${model} unavailable; trying ${models[modelIndex + 1]}.`);
        break;
      }

      throw publicError(lastError);
    }
  }

  throw publicError(
    lastError ||
      providerError(503, 'The AI service is temporarily unavailable. Please try again.')
  );
}

module.exports = { isConfigured, getModel, getFallbackModel, generateJson, parseJson };
