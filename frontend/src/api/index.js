import { getToken, clearToken } from '../lib/auth';

const API_BASE = '/api';

// The store listens for this so an expired token flips the UI back to sign-in.
const UNAUTHORIZED_EVENT = 'nova:unauthorized';

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('Could not reach the API. Start the backend on port 5001, then retry.');
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Request failed ${res.status}`);
    error.status = res.status;
    error.retryable = Boolean(err.retryable);
    throw error;
  }
  return res.json();
}

export const api = {
  // Notes
  getNotes: () => request('/notes'),
  createNote: (note) => request('/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id, note) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(note) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  // Todos
  getTodos: () => request('/todos'),
  createTodo: (todo) => request('/todos', { method: 'POST', body: JSON.stringify(todo) }),
  updateTodo: (id, todo) => request(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(todo) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
  reorderTodos: (todos) => request('/todos/reorder', { method: 'PUT', body: JSON.stringify({ todos }) }),

  // AI (Gemini runs server-side; the key never reaches the browser)
  getAIStatus: () => request('/ai/status'),
  generatePlan: (payload) => request('/ai/plan', { method: 'POST', body: JSON.stringify(payload) }),
  enhanceNote: (payload) =>
    request('/ai/notes/enhance', { method: 'POST', body: JSON.stringify(payload) }),
  summarizeNotes: (payload) =>
    request('/ai/notes/summarize', { method: 'POST', body: JSON.stringify(payload) }),
};
