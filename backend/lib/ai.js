/**
 * Prompt construction and defensive normalization for Gemini responses.
 *
 * Model output is untrusted: every field is type-checked, clamped, and given a
 * safe default before it reaches a repository.
 */

const { PRIORITIES, REPEATS } = require('./sanitize');

const MAX_SOURCE_CHARS = 40_000;
const MAX_NOTES = 3;
const MAX_TASKS = 12;

const truncate = (value, max) =>
  typeof value === 'string' ? value.slice(0, max) : '';

const pad = (value) => `${value}`.padStart(2, '0');

const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Store date-only values at local noon so timezone conversion cannot move the day. */
function toNoonIso(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const normalizeTime = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${match[2]}`;
};

const normalizePriority = (value, index) => {
  if (PRIORITIES.has(value)) return value;
  if (index < 3) return 'high';
  if (index < 7) return 'medium';
  return 'low';
};

const normalizeRepeat = (value) => (REPEATS.has(value) ? value : 'none');

function normalizePlan(raw = {}) {
  // Some models wrap the payload in an extra object; unwrap it defensively.
  const source =
    raw && typeof raw === 'object' && raw.plan && typeof raw.plan === 'object' ? raw.plan : raw;
  const noteItems = Array.isArray(source.notes) ? source.notes : [];
  const taskItems = Array.isArray(source.tasks) ? source.tasks : [];

  const notes = noteItems
    .map((note) => {
      const tags = Array.isArray(note?.tags)
        ? note.tags
            .filter((tag) => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      if (!tags.includes('ai-plan')) tags.push('ai-plan');

      return {
        title: truncate((note?.title ?? '').trim(), 120) || 'Study plan',
        content: truncate(note?.content ?? '', 20_000),
        tags: tags.slice(0, 6),
      };
    })
    .filter((note) => note.content)
    .slice(0, MAX_NOTES);

  const tasks = taskItems
    .map((task, index) => ({
      text: truncate((task?.text ?? '').trim(), 400),
      priority: normalizePriority(task?.priority, index),
      dueDate: toNoonIso(task?.dueDate),
      dueTime: normalizeTime(task?.dueTime),
      repeat: normalizeRepeat(task?.repeat),
    }))
    .filter((task) => task.text)
    .slice(0, MAX_TASKS);

  return {
    title: truncate((source.title ?? '').trim(), 120) || 'Generated plan',
    summary: truncate((source.summary ?? '').trim(), 2_000),
    notes,
    tasks,
  };
}

function normalizeContent(raw = {}) {
  const value =
    typeof raw.content === 'string'
      ? raw.content
      : typeof raw.markdown === 'string'
      ? raw.markdown
      : '';
  return truncate(value.trim(), 40_000);
}

function normalizeSummary(raw = {}) {
  const value = typeof raw.summary === 'string' ? raw.summary : raw.content;
  return truncate(typeof value === 'string' ? value.trim() : '', 12_000);
}

const PLAN_SCHEMA = `{
  "title": "short plan title",
  "summary": "2-3 sentence overview of the plan",
  "notes": [
    { "title": "note title", "content": "Markdown study notes", "tags": ["topic"] }
  ],
  "tasks": [
    {
      "text": "concrete action",
      "priority": "low | medium | high",
      "dueDate": "YYYY-MM-DD or null",
      "dueTime": "HH:MM or null",
      "repeat": "none | daily | weekly"
    }
  ]
}`;

function buildPlanPrompt({ topic, fileName }) {
  const today = localDateKey();
  const source = topic
    ? `Topic / instructions from the user:\n${truncate(topic, MAX_SOURCE_CHARS)}`
    : '';
  const attachment = fileName
    ? `An attachment named "${fileName}" is included with this request. Read it and base the plan on its content.`
    : '';

  return `You are TDL's planning assistant for students and knowledge workers.
Today is ${today} (local date).

Create a clear, realistic plan from the topic or attached file.

${source}
${attachment}

Rules:
- Reply with ONLY a JSON object, no markdown fences, matching this schema:
${PLAN_SCHEMA}
- Produce 1-3 notes in Markdown. Structure them for studying: short headings, bullet points, key terms in bold, and a few review questions.
- Produce 4-10 tasks. Each task must be a single concrete action that fits one sitting.
- Spread dueDate values across the next 7 days starting today. Use dueTime between 08:00 and 21:00 when a time makes sense, otherwise null.
- Use repeat "none" unless the task is genuinely recurring (e.g. daily reading, weekly review).
- Never invent facts that are not supported by the topic or file. If the input is a file, cite its key ideas accurately.`;
}

function buildEnhancePrompt({ title, content }) {
  return `You are a study-notes editor. Rewrite the note below so a student can revise from it quickly.

Keep the author's meaning and facts. Do not add unsupported claims.
Return ONLY JSON: { "content": "the improved note in Markdown" }.
Use:
- a short intro line
- clear ## headings
- compact bullet points
- **bold** key terms
- a final "## Review questions" section with 3-5 questions

Title: ${truncate(title, 300) || 'Untitled'}
Note:
${truncate(content, 30_000)}`;
}

function buildSummarizeNotePrompt({ title, content }) {
  return `Summarize the note below for a student.

Return ONLY JSON: { "summary": "markdown summary" }.
Include:
- 3-6 bullet points with the most important ideas
- a final line starting with "**Key takeaway:**"

Title: ${truncate(title, 300) || 'Untitled'}
Note:
${truncate(content, 30_000)}`;
}

function buildSummarizeAllPrompt({ notes }) {
  const source = notes
    .slice(0, 40)
    .map(
      (note, index) =>
        `### Note ${index + 1}: ${truncate(note.title, 200) || 'Untitled'}\n${truncate(
          note.content,
          4_000
        )}`
    )
    .join('\n\n');

  return `Create a study brief from the collection of notes below.

Return ONLY JSON: { "summary": "markdown" }.
Structure:
- "## Overview" with 2-3 sentences
- "## Key points" with deduplicated bullets grouped by theme
- "## Open questions" with anything the notes leave unresolved

Notes:
${truncate(source, MAX_SOURCE_CHARS)}`;
}

module.exports = {
  buildPlanPrompt,
  buildEnhancePrompt,
  buildSummarizeNotePrompt,
  buildSummarizeAllPrompt,
  normalizePlan,
  normalizeContent,
  normalizeSummary,
  toNoonIso,
};
