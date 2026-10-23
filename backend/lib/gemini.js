/**
 * Minimal Gemini client.
 *
 * The API key never reaches the browser: the frontend talks to our Express
 * routes and this module talks to Google's Generative Language API.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const getModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

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
    const error = new Error(
      'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.'
    );
    error.status = 503;
    throw error;
  }

  const parts = [{ text: prompt }];
  for (const file of files) {
    if (!file?.data || !file?.mimeType) continue;
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let response;
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(getModel())}:generateContent`,
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
  } catch (err) {
    if (err.name === 'AbortError') {
      const error = new Error('Gemini took too long to respond. Try a shorter input.');
      error.status = 504;
      throw error;
    }
    const error = new Error(`Could not reach Gemini: ${err.message}`);
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.error?.message || `Gemini request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status === 400 ? 502 : response.status;
    throw error;
  }

  const data = await response.json().catch(() => null);
  return parseJson(extractText(data));
}

module.exports = { isConfigured, getModel, generateJson, parseJson };
