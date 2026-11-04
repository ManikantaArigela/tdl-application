/**
 * Small OpenAI-compatible chat client.
 *
 * Groq and OpenRouter both expose `/chat/completions` with a bearer token, so
 * one implementation covers both. The response is untrusted: we extract the
 * first message and parse JSON defensively before returning it.
 */

const DEFAULT_TIMEOUT_MS = 90_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function providerError(status, message, retryable = false, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.providerMessage = message;
  Object.assign(error, extra);
  return error;
}

/** Models sometimes wrap JSON in ``` fences or prose; pull out the first object. */
function parseJson(text, provider = 'AI') {
  if (!text) throw providerError(502, `${provider} returned an empty response.`);

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const slice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  try {
    return JSON.parse(slice);
  } catch {
    throw providerError(502, `${provider} returned a response that was not valid JSON. Try again.`);
  }
}

function timeoutMs() {
  const value = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

async function requestModel({ baseUrl, apiKey, model, prompt, extraHeaders = {}, provider }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise JSON API. Return only one valid JSON object. Do not wrap it in markdown fences or add commentary.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);
    return { response, body };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw providerError(
        504,
        `${provider} took too long to respond. Try a shorter input.`,
        true,
        { timeout: true }
      );
    }
    throw providerError(502, `Could not reach ${provider}: ${err.message}`, true, {
      network: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(500 * 2 ** attempt, 4000) + Math.round(Math.random() * 150);
}

/**
 * @param {object} options
 * @param {string} options.baseUrl  e.g. https://api.groq.com/openai/v1
 * @param {string} options.apiKey
 * @param {string[]} options.models  Primary first, then fallbacks.
 * @param {string} options.prompt
 * @param {string} options.provider  Human-readable provider name for errors.
 * @param {object} [options.extraHeaders]
 * @returns {Promise<object>} parsed JSON object
 */
async function generateJson({
  baseUrl,
  apiKey,
  models,
  prompt,
  provider = 'AI',
  extraHeaders = {},
}) {
  if (!apiKey) {
    throw providerError(
      503,
      `${provider} is not configured. Add its API key to backend/.env and restart the server.`
    );
  }

  const uniqueModels = [...new Set(models.filter(Boolean))];
  let lastError = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let result;
      try {
        result = await requestModel({ baseUrl, apiKey, model, prompt, extraHeaders, provider });
      } catch (error) {
        lastError = error;
        if (error.timeout) throw error;
        if (attempt === 0 && error.retryable) {
          const delay = retryDelay(null, attempt);
          console.warn(`[${provider}] ${model} could not be reached; retrying in ${delay}ms.`);
          await sleep(delay);
          continue;
        }
        break;
      }

      const { response, body } = result;
      if (response.ok) {
        const text = body?.choices?.[0]?.message?.content;
        return parseJson(text, provider);
      }

      const message =
        body?.error?.message || `${provider} request failed with status ${response.status}.`;
      const retryable = RETRYABLE_STATUS.has(response.status);
      lastError = providerError(
        response.status === 400 || response.status === 401 || response.status === 403
          ? 502
          : response.status,
        message,
        retryable
      );

      if (retryable && attempt === 0) {
        const delay = retryDelay(response, attempt);
        console.warn(`[${provider}] ${model} returned ${response.status}; retrying in ${delay}ms.`);
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  throw lastError || providerError(503, `${provider} is temporarily unavailable.`);
}

module.exports = { generateJson, parseJson, providerError };
