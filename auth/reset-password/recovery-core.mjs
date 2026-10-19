export const minimumPasswordLength = 15;
export const validNewPassword = value => Array.from(value).length >= minimumPasswordLength;

export function readRecoveryLink(url) {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  if (fragment.has('token_hash') && parsed.searchParams.has('token_hash')) return null;
  const params = fragment.has('token_hash') ? fragment : parsed.searchParams;
  if (params.getAll('token_hash').length !== 1 || params.getAll('type').length !== 1 ||
      params.get('type') !== 'recovery' || !params.get('token_hash') || params.has('error')) {
    return null;
  }
  return params.get('token_hash');
}

// No browser storage, SDK auto-refresh, analytics or credential logging.
export function createRecoverySession(config, request = fetch, now = () => Date.now()) {
  let session = null;
  let phase = 'unverified';
  const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
  async function api(path, body, method = 'POST', token) {
    const response = await request(`${config.supabaseURL}/auth/v1/${path}`, {
      method, headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }
  return {
    async verify(tokenHash) {
      if (phase !== 'unverified' || !tokenHash) throw new Error('invalid-link');
      phase = 'verifying';
      try {
        const result = await api('verify', { token_hash: tokenHash, type: 'recovery' });
        if (!result.ok || !result.data.access_token || !Number.isFinite(result.data.expires_in)) {
          throw new Error('invalid-link');
        }
        session = { token: result.data.access_token, expires: now() + result.data.expires_in * 1000 };
        phase = 'ready';
      } catch { session = null; phase = 'invalid'; throw new Error('invalid-link'); }
    },
    async save(password) {
      if (!validNewPassword(password)) throw new Error('weak-password');
      if (phase !== 'ready' || !session || session.expires <= now()) {
        session = null; phase = 'invalid'; throw new Error('expired-link');
      }
      phase = 'saving';
      try {
        const result = await api('user', { password }, 'PUT', session.token);
        if (!result.ok) {
          if (result.status === 401 || result.status === 403) {
            session = null; phase = 'invalid'; throw new Error('expired-link');
          }
          phase = 'ready';
          if (result.data.code === 'weak_password' || result.data.code === 'same_password') {
            throw new Error(result.data.code === 'same_password' ? 'same-password' : 'weak-password');
          }
          throw new Error('save-failed');
        }
        const token = session.token;
        session = null; phase = 'complete';
        // Best-effort revoke this recovery browser session only. Never sign out other devices.
        try { await api('logout?scope=local', {}, 'POST', token); } catch {}
      } catch (error) { if (phase === 'saving') phase = 'ready'; throw error; }
    },
    async requestLink(email) {
      if (!email.includes('@')) throw new Error('invalid-email');
      const result = await api(`recover?redirect_to=${encodeURIComponent(config.resetPasswordURL)}`, { email });
      if (!result.ok) throw new Error(result.status === 429 ? 'rate-limit' : 'request-failed');
    },
    clear() { session = null; phase = 'invalid'; }
  };
}
