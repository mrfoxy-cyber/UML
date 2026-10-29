const byId = id => document.getElementById(id);
let session;
function status(message, kind = '') {
  byId('status').textContent = message;
  byId('status').className = `status ${kind}`;
}
function connected(login) {
  byId('dot').classList.add('connected');
  byId('disconnect').hidden = false;
  byId('connect').firstChild.textContent = 'Replace connection ';
  status(`Connected as ${login || 'your GitHub account'}. Ready to read snapshots.`, 'success');
}
async function post(path) {
  const response = await fetch(path, { method: 'POST', headers: { 'X-Uml-Session': session.sessionKey } });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    throw new Error(failure.error || 'The connection request failed. Try again.');
  }
  return response.json();
}
byId('connect').addEventListener('click', async () => {
  byId('connect').disabled = true;
  byId('disconnect').disabled = true;
  status('Complete the Windows credential prompt, then wait for GitHub verification.');
  try {
    const result = await post('/api/connect');
    if (result.cancelled) status('Connection cancelled. Your saved connection has not changed.');
    else connected(result.login);
  } catch (error) { status(error.message, 'error'); }
  finally { byId('connect').disabled = false; byId('disconnect').disabled = false; }
});
byId('disconnect').addEventListener('click', async () => {
  byId('disconnect').disabled = true;
  byId('connect').disabled = true;
  try {
    await post('/api/disconnect');
    byId('dot').classList.remove('connected');
    byId('disconnect').hidden = true;
    byId('connect').firstChild.textContent = 'Connect securely ';
    status('Saved connection removed from this computer. You can revoke the token on GitHub.');
  } catch (error) { status(error.message, 'error'); }
  finally { byId('disconnect').disabled = false; byId('connect').disabled = false; }
});
async function initialize() {
  try {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Unable to load this connection. Restart the login command.');
    session = await response.json();
    byId('repository').textContent = session.repository;
    byId('create').href = session.creationUrl;
    byId('create').classList.remove('disabled');
    byId('connect').disabled = false;
    if (session.connected) connected(session.login);
    else status('No saved connection. Create a dedicated token to get started.');
  } catch (error) { status(error.message, 'error'); }
}
initialize();
