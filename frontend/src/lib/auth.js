/**
 * Browser auth client.
 *
 * Login is handled by our own Express API (`/api/auth/*`). The returned JWT is
 * stored in localStorage and attached to every API request. No Supabase (or any
 * third-party auth) client is involved.
 */
const TOKEN_KEY = 'nova.auth.token';

const AUTH_BASE = '/api/auth';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage can be disabled; the in-memory session still works until reload */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function authRequest(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${AUTH_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    const error = new Error(
      'Could not reach the API. Start the backend on port 5001, then try again.'
    );
    error.status = 0;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const auth = {
  async signIn(email, password) {
    const data = await authRequest('/login', { method: 'POST', body: { email, password } });
    storeToken(data.token);
    return data;
  },

  async signUp(email, password) {
    const data = await authRequest('/signup', { method: 'POST', body: { email, password } });
    storeToken(data.token);
    return data;
  },

  /**
   * Restores the session on page load. Returns the user, or null when there is
   * no token or the token is no longer valid. Network failures are surfaced so
   * the UI can show a retry message instead of silently signing out.
   */
  async me() {
    const token = getToken();
    if (!token) return null;

    try {
      const data = await authRequest('/me', { token });
      return data.user;
    } catch (error) {
      if (error.status === 401) {
        // Expired or invalid token: drop it and let the UI show sign-in.
        clearToken();
        return null;
      }
      // 503/network errors are surfaced so the UI can explain the outage.
      throw error;
    }
  },

  async signOut() {
    const token = getToken();
    try {
      if (token) await authRequest('/logout', { method: 'POST', token });
    } catch {
      /* the JWT is stateless; clearing it locally is enough */
    } finally {
      clearToken();
    }
  },
};
