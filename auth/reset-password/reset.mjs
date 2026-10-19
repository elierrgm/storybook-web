import { accountConfig } from './config.mjs';
import { readRecoveryLink, readRecoverySession, validNewPassword, createRecoverySession } from './recovery-core.mjs';
const byID = id => document.getElementById(id);
let tokenHash = readRecoveryLink(location.href);
let incomingSession = readRecoverySession(location.href);
// Remove credential/error parameters before any request. No third-party scripts run here.
history.replaceState(null, '', location.pathname);
const recovery = createRecoverySession(accountConfig);
const status = byID('status');
function invalid(message) {
  byID('verify').hidden = true;
  byID('password-form').hidden = true;
  byID('password').value = '';
  byID('request').hidden = false;
  status.textContent = message;
}
if (!tokenHash && !incomingSession) invalid('This reset link is missing, expired or invalid. Request a new link below.');
byID('continue').addEventListener('click', async () => {
  byID('continue').disabled = true;
  status.textContent = 'Verifying your reset link…';
  const token = tokenHash, session = incomingSession; tokenHash = null; incomingSession = null;
  try {
    if (token) await recovery.verify(token);
    else await recovery.verifySession(session);
    byID('verify').hidden = true;
    byID('password-form').hidden = false;
    byID('intro').textContent = 'Choose a long password you haven’t used elsewhere.';
    status.textContent = '';
    byID('password').focus();
  } catch { invalid('This reset link has expired or was already used. Request a new link below.'); }
});
byID('password').addEventListener('input', () => {
  const met = validNewPassword(byID('password').value);
  byID('check').textContent = met ? '✓' : '○';
  byID('requirement').classList.toggle('met', met);
  byID('save').disabled = !met;
});
byID('visibility').addEventListener('click', () => {
  const input = byID('password'), button = byID('visibility');
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(reveal));
});
byID('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = byID('password');
  if (!validNewPassword(input.value) || byID('save').disabled) return;
  byID('save').disabled = true; input.disabled = true; byID('visibility').disabled = true;
  status.textContent = 'Saving your password…';
  try {
    await recovery.save(input.value);
    input.value = ''; input.type = 'password';
    byID('password-form').hidden = true; byID('intro').hidden = true;
    byID('title').textContent = 'Password updated'; byID('complete').hidden = false;
    status.textContent = '';
  } catch (error) {
    if (error.message === 'expired-link') {
      invalid('Your reset session expired. Request a new link below.');
    } else {
      status.textContent = error.message === 'same-password' ? 'Choose a password different from your current one.' :
        (error.message === 'weak-password' ? 'Choose a stronger password with at least 15 characters.' :
         'We couldn’t save your password. Check your connection and try again.');
      byID('save').disabled = !validNewPassword(input.value);
    }
  } finally { input.disabled = false; byID('visibility').disabled = false; }
});
byID('request-form').addEventListener('submit', async event => {
  event.preventDefault(); byID('send').disabled = true;
  try {
    await recovery.requestLink(byID('email').value.trim());
    status.textContent = 'If an account exists for this email, we’ve sent a reset link. Check your inbox and spam folder.';
  } catch (error) {
    status.textContent = error.message === 'rate-limit' ? 'Too many requests. Please wait a few minutes before trying again.' :
      'We couldn’t send a link. Check your connection and try again.';
  } finally { byID('send').disabled = false; }
});
addEventListener('pagehide', () => { recovery.clear(); tokenHash = null; incomingSession = null; byID('password').value = ''; });
addEventListener('pageshow', event => {
  if (event.persisted) invalid('For your security, request a fresh reset link to continue.');
});

if (window.top !== window.self) {
  recovery.clear(); tokenHash = null; incomingSession = null;
  invalid('Open this reset page directly from your email to continue.');
  byID('request').hidden = true;
}
